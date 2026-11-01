/**
 * In-Browser AI Copilot Service
 * Extracts cleaned semantic DOM from web tabs via isolated worlds and streams intelligence back via IPC.
 */

import { WebContents } from 'electron';

export class AIService {
  private apiKey: string;
  private model: string;

  constructor(apiKey = process.env.GEMINI_API_KEY || '', model = 'gemini-2.0-flash') {
    this.apiKey = apiKey.trim();
    this.model = model;
  }

  public setApiKey(key: string) {
    this.apiKey = key.trim();
  }

  /**
   * Safely extracts and cleans the DOM inside an isolated JavaScript world (worldId: 999).
   * Web page scripts cannot intercept or observe this extraction.
   */
  public async extractCleanPageContent(webContents: WebContents): Promise<{ title: string; url: string; content: string }> {
    const extractionScript = `
      (() => {
        try {
          const clone = document.body.cloneNode(true);

          // Strip non-semantic, decorative, and noisy elements
          const removeSelectors = [
            'script', 'style', 'noscript', 'svg', 'canvas',
            'nav', 'footer', 'iframe', '[aria-hidden="true"]',
            '.ad', '.ads', '.advertisement', '#cookie-banner', '.cookie-consent'
          ];
          clone.querySelectorAll(removeSelectors.join(',')).forEach(el => el.remove());

          // Collect substantial text blocks (paragraphs, headers, list items)
          const textBlocks = [];
          const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null);
          let node;
          while ((node = walker.nextNode())) {
            const val = node.nodeValue.trim();
            if (val.length > 25) {
              textBlocks.push(val);
            }
          }

          return {
            title: document.title || 'Untitled Page',
            url: window.location.href,
            content: textBlocks.join('\\n\\n').slice(0, 30000) // Budget ~7k tokens
          };
        } catch (e) {
          return {
            title: document.title || 'Untitled',
            url: window.location.href,
            content: document.body.innerText.slice(0, 15000)
          };
        }
      })()
    `;

    return await webContents.executeJavaScriptInIsolatedWorld(999, [
      { code: extractionScript }
    ]);
  }

  /**
   * Streams response from Google Gemini API via native fetch
   */
  public async streamAnalysis(
    pageContext: { title: string; url: string; content: string },
    userPrompt: string | undefined,
    onChunk: (text: string, isComplete: boolean, error?: string) => void
  ) {
    if (!this.apiKey) {
      // Graceful offline mock if user hasn't configured an API key yet
      onChunk(
        `### Page Overview: ${pageContext.title}\n\n` +
        `**Extracted Context:** \`${pageContext.url}\`\n\n` +
        `> **Note:** To enable live Gemini AI generation, add your API key in settings or pass \`GEMINI_API_KEY\` to your environment.\n\n` +
        `**Extracted Snapshot Preview:**\n\n` +
        pageContext.content.slice(0, 600) + '...',
        true
      );
      return;
    }

    try {
      const systemInstruction = 
        "You are Aether Copilot, an elite in-browser AI research assistant. " +
        "Synthesize facts accurately from the provided webpage content. " +
        "Be concise, structured, direct, and avoid conversational fluff.";

      const prompt = userPrompt
        ? `Page: "${pageContext.title}" (${pageContext.url})\n\nContent:\n${pageContext.content}\n\nUser Question: ${userPrompt}`
        : `Page: "${pageContext.title}" (${pageContext.url})\n\nContent:\n${pageContext.content}\n\nProvide: 1. Executive Summary (3 bullets)\n2. Key Insights & Metrics\n3. Actionable Takeaways.`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `API returned status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response stream body unavailable.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const textChunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textChunk) {
                onChunk(textChunk, false);
              }
            } catch (err) {
              // Ignore partial stream parse errors
            }
          }
        }
      }

      onChunk('', true);
    } catch (err: any) {
      onChunk('', true, err.message || 'Stream generation failed.');
    }
  }
}
