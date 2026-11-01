import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Copy, 
  Check, 
  Key, 
  Bot, 
  FileText, 
  ListChecks, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { TabData } from '../../../preload/shell-preload';

interface CopilotPanelProps {
  activeTab: TabData | undefined;
}

export const CopilotPanel: React.FC<CopilotPanelProps> = ({ activeTab }) => {
  const [output, setOutput] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = window.browserAPI.onAIStream((chunk) => {
      if (chunk.error) {
        setOutput((prev) => prev + `\n\n⚠️ **Error:** ${chunk.error}`);
        setIsStreaming(false);
        return;
      }

      if (chunk.text) {
        setOutput((prev) => prev + chunk.text);
      }

      if (chunk.isComplete) {
        setIsStreaming(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const handleSummarize = () => {
    setOutput('');
    setIsStreaming(true);
    window.browserAPI.summarizeCurrentPage();
  };

  const handleQuickAction = (instruction: string) => {
    setOutput(`\n*Executing: ${instruction}...*\n\n`);
    setIsStreaming(true);
    window.browserAPI.summarizeCurrentPage(instruction);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isStreaming) return;

    const query = inputPrompt.trim();
    setOutput((prev) => prev + `\n\n**You:** ${query}\n\n**Aether:** `);
    setIsStreaming(true);
    setInputPrompt('');

    window.browserAPI.queryCopilot(query);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      window.browserAPI.setApiKey(apiKeyInput.trim());
      setShowKeyModal(false);
    }
  };

  return (
    <aside className="w-[380px] h-full bg-slate-900 border-l border-slate-800 flex flex-col z-20 select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <Sparkles size={14} className="text-amber-300" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide">Aether Copilot</h3>
            <p className="text-[10px] text-slate-400 truncate max-w-[170px]">
              {activeTab?.title || 'No active page'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {output && (
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
              title="Copy Output"
            >
              {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          )}

          <button
            onClick={() => setShowKeyModal(!showKeyModal)}
            className="p-1.5 text-slate-400 hover:text-amber-300 rounded-md hover:bg-slate-800 transition"
            title="Configure Gemini API Key"
          >
            <Key size={13} />
          </button>
        </div>
      </div>

      {/* API Key Modal Drawer */}
      {showKeyModal && (
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Key size={12} className="text-amber-400" />
            <span>Set Google Gemini API Key</span>
          </div>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Paste your Gemini API key..."
            className="w-full bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowKeyModal(false)}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveApiKey}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 py-1 rounded-md transition"
            >
              Save Key
            </button>
          </div>
        </div>
      )}

      {/* Quick Analysis Actions */}
      <div className="p-2 border-b border-slate-800/80 bg-slate-900/50 flex flex-wrap gap-1.5">
        <button
          onClick={handleSummarize}
          disabled={isStreaming}
          className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 px-2 py-1 rounded-md transition disabled:opacity-40"
        >
          <FileText size={11} />
          <span>Executive Summary</span>
        </button>

        <button
          onClick={() => handleQuickAction('Extract all concrete action items, metrics, and takeaways as a checklist.')}
          disabled={isStreaming}
          className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 px-2 py-1 rounded-md transition disabled:opacity-40"
        >
          <ListChecks size={11} />
          <span>Action Items</span>
        </button>

        <button
          onClick={() => handleQuickAction('Explain the central concepts of this article in plain simple terms.')}
          disabled={isStreaming}
          className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 px-2 py-1 rounded-md transition disabled:opacity-40"
        >
          <HelpCircle size={11} />
          <span>Explain Simply</span>
        </button>
      </div>

      {/* Stream Output Window */}
      <div className="flex-1 p-3.5 overflow-y-auto font-sans text-xs leading-relaxed text-slate-200 whitespace-pre-wrap select-text">
        {output ? (
          <div>{output}</div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 px-4">
            <Bot size={28} className="text-slate-600 mb-2" />
            <p className="font-medium text-slate-400">Context-Aware Page Assistant</p>
            <p className="text-[11px] mt-1 text-slate-500">
              Select an action above or type any question about the current webpage below.
            </p>
          </div>
        )}
        <div ref={outputEndRef} />
      </div>

      {/* Prompt Form */}
      <form onSubmit={handleSubmit} className="p-2.5 border-t border-slate-800 bg-slate-950">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={isStreaming}
            placeholder={isStreaming ? "Analyzing page..." : "Ask about this page..."}
            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg pl-3 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !inputPrompt.trim()}
            className="absolute right-1.5 p-1 text-indigo-400 hover:text-indigo-300 disabled:opacity-30 transition"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </aside>
  );
};
