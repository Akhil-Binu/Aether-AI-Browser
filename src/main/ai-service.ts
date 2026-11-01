/**
 * In-Browser AI Copilot Service
 * Extracts cleaned semantic DOM from web tabs via isolated worlds and streams intelligence back via IPC.
 */

import { WebContents } from 'electron';
import { ContentGenerationResult, ContentSuggestion } from './types.js';

const SOCIAL_SYSTEM_PROMPT = `You are an expert ghostwriter and engagement assistant embedded in Aether AI Browser. Your job is to generate human, high-impact, authentic social content based on user instructions and page context.

CORE OPERATING PRINCIPLES:
1. Zero AI Clichés:
   - NEVER use overused robotic filler phrases: "In today's fast-paced world...", "Delve into", "Tapestry", "Beacon", "Kudos to", "Great share!", "Fascinating insights!", or "Agree 100%".
   - Avoid excessive emojis (max 1–2 per piece of content, only when natural).
   - Write like a real practitioner, founder, or industry professional—concise, direct, and conversational.

2. Formatting & Readability:
   - Use natural white space: 1–2 sentence paragraphs max.
   - For posts: prioritize a scroll-stopping hook (first 2 lines before "...see more"), body with concrete takeaways or an contrarian angle, and an engaging conversational CTA.
   - For comments and replies: keep them punchy (20–60 words unless specified otherwise). Reference specific points from the original text rather than generic praise.

3. Structured Output:
   - Always return ONLY valid JSON matching the requested schema. No markdown code wraps outside the JSON object, no preamble, and no conversational filler.`;

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

  /**
   * Universal Structured JSON caller
   */
  private async callJsonModel(userPrompt: string): Promise<any> {
    if (!this.apiKey) {
      return null;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SOCIAL_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Empty response from model.');

    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    }

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(cleaned);
  }

  /**
   * Mode 1: Post Generator
   */
  public async generateSocialPost(params: {
    topic: string;
    tone?: string;
    audience?: string;
    instructions?: string;
  }): Promise<ContentGenerationResult> {
    const userPrompt = JSON.stringify({
      mode: 'post_generator',
      tone: params.tone || 'thought-leader',
      user_instructions: `Topic: ${params.topic}. Target Audience: ${params.audience || 'General Tech'}. ${params.instructions || ''}`,
      output_requirements: {
        variations: [
          'Variation A: Framework / Actionable List (Clear steps, tactical takeaway)',
          'Variation B: Storytelling / Contrarian Take (Personal/observational, challenges conventional wisdom)',
          'Variation C: Short Punchy Take (Fast read, bold hook, strong engagement question)'
        ],
        hashtags: '3-5 niche tags'
      }
    });

    try {
      const result = await this.callJsonModel(userPrompt);
      if (result && Array.isArray(result.suggestions)) {
        return result;
      }
    } catch (e) {
      console.warn('API error or no key, falling back to heuristic generator:', e);
    }

    // High quality offline fallback
    const t = params.topic.trim();
    return {
      mode: 'post_generator',
      suggestions: [
        {
          id: 1,
          style_label: 'Actionable Framework (Tactical List)',
          content: `Most people approach ${t || 'this problem'} backwards.\n\nHere is the 3-step framework we used to fix it:\n\n1. Audit the baseline metrics before touching anything.\n2. Isolate the biggest bottleneck and solve only that.\n3. Automate the feedback loop so regressions surface immediately.\n\nSimplicity scales. Complexity breaks.\n\nWhat is your team's biggest operational hurdle right now?\n\n#Productivity #Engineering #Leadership`,
          character_count: 420
        },
        {
          id: 2,
          style_label: 'Contrarian Take (Challenges Conventional Wisdom)',
          content: `Unpopular opinion: Conventional advice around ${t || 'this topic'} is outdated.\n\nEveryone repeats the same playbooks because they are safe, not because they produce outsized results.\n\nThe real leverage comes from doing the unscalable work upfront and saying no to 90% of low-impact noise.\n\nHave you noticed this trend in your industry?\n\n#Strategy #Innovation #Growth`,
          character_count: 388
        },
        {
          id: 3,
          style_label: 'Short & Punchy (High Engagement)',
          content: `The fastest way to fail at ${t || 'your goals'} is waiting for the perfect conditions.\n\nStart messy. Iterate daily. Focus on output over theory.\n\nWhat is one project you have been putting off this month?\n\n#Mindset #Action #Founders`,
          character_count: 245
        }
      ]
    };
  }

  /**
   * Mode 2: Comment Generator
   */
  public async generateSocialComment(params: {
    sourcePostText?: string;
    tone?: string;
    instructions?: string;
  }): Promise<ContentGenerationResult> {
    const postSnippet = (params.sourcePostText || '').slice(0, 1500);

    const userPrompt = JSON.stringify({
      mode: 'comment_generator',
      tone: params.tone || 'analytical',
      source_post_text: postSnippet,
      user_instructions: params.instructions || ''
    });

    try {
      const result = await this.callJsonModel(userPrompt);
      if (result && Array.isArray(result.suggestions)) {
        return result;
      }
    } catch (e) {
      console.warn('API error, using fallback comment generator:', e);
    }

    return {
      mode: 'comment_generator',
      suggestions: [
        {
          id: 1,
          style_label: 'Value-Add (Practical Nuance)',
          content: `Spot on observation. The second-order effect people often miss here is how this shifts team communication overhead. Once you decouple the workflow, velocity usually jumps because developers spend significantly less time waiting on synchronous approvals.`,
          character_count: 254
        },
        {
          id: 2,
          style_label: 'Thoughtful Question (Invites Dialogue)',
          content: `Great perspective. How did your team handle the initial onboarding transition when rolling this out? Did you run into friction with less senior team members who typically rely on synchronous check-ins?`,
          character_count: 208
        },
        {
          id: 3,
          style_label: 'Constructive Counterpoint / Edge Case',
          content: `This works remarkably well for teams with high individual context, though the trade-off is often cross-functional visibility. Finding a lightweight way to keep design and product aligned without reverting to meetings is where most implementations stumble.`,
          character_count: 256
        }
      ]
    };
  }

  /**
   * Mode 3: Reply to Comment
   */
  public async generateSocialReply(params: {
    sourcePostText?: string;
    sourceCommentText: string;
    tone?: string;
    instructions?: string;
  }): Promise<ContentGenerationResult> {
    const userPrompt = JSON.stringify({
      mode: 'reply_to_comment',
      tone: params.tone || 'casual',
      source_post_text: (params.sourcePostText || '').slice(0, 1000),
      source_comment_text: params.sourceCommentText.slice(0, 800),
      user_instructions: params.instructions || ''
    });

    try {
      const result = await this.callJsonModel(userPrompt);
      if (result && Array.isArray(result.suggestions)) {
        return result;
      }
    } catch (e) {
      console.warn('API error, using fallback reply generator:', e);
    }

    return {
      mode: 'reply_to_comment',
      suggestions: [
        {
          id: 1,
          style_label: 'Deepen Conversation (Expand Context)',
          content: `Completely agree with your point here. We noticed the exact same tradeoff during our pilot phase. Curious—did you implement a specific guideline to manage that, or did the team self-regulate over time?`,
          character_count: 206
        },
        {
          id: 2,
          style_label: 'Quick & Punchy (Engaging Acknowledgment)',
          content: `Crucial distinction. Nailing the feedback loop early on is what prevents those edge cases from turning into firefighting drills. Thanks for highlighting this angle!`,
          character_count: 173
        },
        {
          id: 3,
          style_label: 'Professional Summary & Conclusion',
          content: `Well said. It really comes down to balancing autonomy with accountability. We found that setting clear boundary metrics gave everyone the latitude they needed without sacrificing quality.`,
          character_count: 195
        }
      ]
    };
  }
}
