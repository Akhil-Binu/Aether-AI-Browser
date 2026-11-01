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
  PenTool,
  MessageSquare,
  Reply,
  ArrowDownToLine,
  Loader2
} from 'lucide-react';
import { TabData, ContentSuggestion } from '../../../preload/shell-preload';

type CopilotMode = 'copilot' | 'post_generator' | 'comment_generator' | 'reply_to_comment';

interface CopilotPanelProps {
  activeTab: TabData | undefined;
}

export const CopilotPanel: React.FC<CopilotPanelProps> = ({ activeTab }) => {
  const [activeMode, setActiveMode] = useState<CopilotMode>('copilot');

  // Copilot State
  const [output, setOutput] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Social Creator State
  const [postTopic, setPostTopic] = useState<string>('');
  const [postTone, setPostTone] = useState<string>('thought-leader');
  const [postAudience, setPostAudience] = useState<string>('Tech Founders & Engineers');
  
  const [commentInstructions, setCommentInstructions] = useState<string>('');
  const [commentTone, setCommentTone] = useState<string>('analytical');

  const [replyTargetComment, setReplyTargetComment] = useState<string>('');
  const [replyTone, setReplyTone] = useState<string>('casual');

  const [isGeneratingContent, setIsGeneratingContent] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [injectedId, setInjectedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

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

  // Handle Page Copilot
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

  const handleCopilotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isStreaming) return;

    const query = inputPrompt.trim();
    setOutput((prev) => prev + `\n\n**You:** ${query}\n\n**Aether:** `);
    setIsStreaming(true);
    setInputPrompt('');
    window.browserAPI.queryCopilot(query);
  };

  // Handle Post Generation
  const handleGeneratePost = async () => {
    if (!postTopic.trim()) return;
    setIsGeneratingContent(true);
    setSuggestions([]);

    try {
      const res = await window.browserAPI.generatePost({
        topic: postTopic,
        tone: postTone,
        audience: postAudience
      });
      setSuggestions(res.suggestions || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsGeneratingContent(false);
    }
  };

  // Handle Comment Generation
  const handleGenerateComment = async () => {
    setIsGeneratingContent(true);
    setSuggestions([]);

    try {
      const res = await window.browserAPI.generateComment({
        tone: commentTone,
        instructions: commentInstructions
      });
      setSuggestions(res.suggestions || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsGeneratingContent(false);
    }
  };

  // Handle Reply Generation
  const handleGenerateReply = async () => {
    if (!replyTargetComment.trim()) return;
    setIsGeneratingContent(true);
    setSuggestions([]);

    try {
      const res = await window.browserAPI.generateReply({
        sourceCommentText: replyTargetComment,
        tone: replyTone
      });
      setSuggestions(res.suggestions || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsGeneratingContent(false);
    }
  };

  // 1-Click Injection into Active Web Tab
  const handleInjectIntoPage = async (item: ContentSuggestion) => {
    const success = await window.browserAPI.insertTextToActiveTab(item.content);
    if (success) {
      setInjectedId(item.id);
      setTimeout(() => setInjectedId(null), 2000);
    }
  };

  const handleCopySuggestion = (item: ContentSuggestion) => {
    navigator.clipboard.writeText(item.content);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      window.browserAPI.setApiKey(apiKeyInput.trim());
      setShowKeyModal(false);
    }
  };

  return (
    <aside className="w-[390px] h-full bg-slate-900 border-l border-slate-800 flex flex-col z-20 select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <Sparkles size={14} className="text-amber-300" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide">Aether Intelligence</h3>
            <p className="text-[10px] text-slate-400 truncate max-w-[170px]">
              {activeTab?.title || 'No active page'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowKeyModal(!showKeyModal)}
            className="p-1.5 text-slate-400 hover:text-amber-300 rounded-md hover:bg-slate-800 transition"
            title="Configure Gemini API Key"
          >
            <Key size={13} />
          </button>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/80 p-1 gap-1">
        <button
          onClick={() => setActiveMode('copilot')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition ${
            activeMode === 'copilot' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Bot size={12} />
          <span>Research</span>
        </button>

        <button
          onClick={() => { setActiveMode('post_generator'); setSuggestions([]); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition ${
            activeMode === 'post_generator' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <PenTool size={12} />
          <span>Post</span>
        </button>

        <button
          onClick={() => { setActiveMode('comment_generator'); setSuggestions([]); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition ${
            activeMode === 'comment_generator' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <MessageSquare size={12} />
          <span>Comment</span>
        </button>

        <button
          onClick={() => { setActiveMode('reply_to_comment'); setSuggestions([]); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition ${
            activeMode === 'reply_to_comment' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Reply size={12} />
          <span>Reply</span>
        </button>
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

      {/* MODE 1: RESEARCH COPILOT */}
      {activeMode === 'copilot' && (
        <>
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

          <form onSubmit={handleCopilotSubmit} className="p-2.5 border-t border-slate-800 bg-slate-950">
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
        </>
      )}

      {/* MODE 2: POST GENERATOR */}
      {activeMode === 'post_generator' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400">Post Topic or Raw Thought</label>
            <textarea
              rows={3}
              value={postTopic}
              onChange={(e) => setPostTopic(e.target.value)}
              placeholder="e.g. 3 lessons from scaling our backend, or why async standups outperform live meetings..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Tone</label>
              <select
                value={postTone}
                onChange={(e) => setPostTone(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md p-1.5 text-xs text-slate-200"
              >
                <option value="thought-leader">Thought-Leader</option>
                <option value="analytical">Analytical</option>
                <option value="casual">Casual</option>
                <option value="contrarian">Contrarian</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Audience</label>
              <input
                type="text"
                value={postAudience}
                onChange={(e) => setPostAudience(e.target.value)}
                placeholder="Target Audience"
                className="bg-slate-950 border border-slate-800 rounded-md p-1.5 text-xs text-slate-200"
              />
            </div>
          </div>

          <button
            onClick={handleGeneratePost}
            disabled={isGeneratingContent || !postTopic.trim()}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            {isGeneratingContent ? <Loader2 size={13} className="animate-spin" /> : <PenTool size={13} />}
            <span>Generate 3 Post Variations</span>
          </button>

          {/* Render Suggestions */}
          <div className="flex flex-col gap-2.5 mt-1">
            {suggestions.map((item) => (
              <div key={item.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{item.style_label}</span>
                  <span className="text-[10px] text-slate-500">{item.character_count} chars</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text">{item.content}</p>
                <div className="flex justify-end gap-1.5 pt-1 border-t border-slate-900">
                  <button
                    onClick={() => handleCopySuggestion(item)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium transition"
                  >
                    {copiedId === item.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => handleInjectIntoPage(item)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold transition"
                    title="Insert directly into focused input in active web tab"
                  >
                    {injectedId === item.id ? <Check size={11} /> : <ArrowDownToLine size={11} />}
                    <span>{injectedId === item.id ? 'Injected!' : 'Insert to Page'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODE 3: COMMENT GENERATOR */}
      {activeMode === 'comment_generator' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto gap-3">
          <div className="bg-slate-950/60 p-2.5 border border-slate-800 rounded-lg text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Target Page Context:</span>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{activeTab?.title || 'Current active page'}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Tone</label>
              <select
                value={commentTone}
                onChange={(e) => setCommentTone(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md p-1.5 text-xs text-slate-200"
              >
                <option value="analytical">Analytical (Value-Add)</option>
                <option value="thought-leader">Thought-Leader</option>
                <option value="casual">Casual & Conversational</option>
                <option value="contrarian">Contrarian & Debate</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Angle / Instruction</label>
              <input
                type="text"
                value={commentInstructions}
                onChange={(e) => setCommentInstructions(e.target.value)}
                placeholder="e.g. ask about metrics"
                className="bg-slate-950 border border-slate-800 rounded-md p-1.5 text-xs text-slate-200"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateComment}
            disabled={isGeneratingContent}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            {isGeneratingContent ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />}
            <span>Generate 3 Comment Angles</span>
          </button>

          {/* Render Suggestions */}
          <div className="flex flex-col gap-2.5 mt-1">
            {suggestions.map((item) => (
              <div key={item.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{item.style_label}</span>
                  <span className="text-[10px] text-slate-500">{item.character_count} chars</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text">{item.content}</p>
                <div className="flex justify-end gap-1.5 pt-1 border-t border-slate-900">
                  <button
                    onClick={() => handleCopySuggestion(item)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium transition"
                  >
                    {copiedId === item.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => handleInjectIntoPage(item)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold transition"
                    title="Insert directly into focused comment box in active web tab"
                  >
                    {injectedId === item.id ? <Check size={11} /> : <ArrowDownToLine size={11} />}
                    <span>{injectedId === item.id ? 'Injected!' : 'Insert to Page'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODE 4: REPLY TO COMMENT */}
      {activeMode === 'reply_to_comment' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400">Comment Being Replied To</label>
            <textarea
              rows={3}
              value={replyTargetComment}
              onChange={(e) => setReplyTargetComment(e.target.value)}
              placeholder="Paste the user's comment here..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none transition"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400">Tone</label>
            <select
              value={replyTone}
              onChange={(e) => setReplyTone(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md p-1.5 text-xs text-slate-200"
            >
              <option value="casual">Friendly & Conversational</option>
              <option value="analytical">Expand & Deepen Point</option>
              <option value="supportive">Appreciative Acknowledgment</option>
              <option value="contrarian">Polite Debate / Nuance</option>
            </select>
          </div>

          <button
            onClick={handleGenerateReply}
            disabled={isGeneratingContent || !replyTargetComment.trim()}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            {isGeneratingContent ? <Loader2 size={13} className="animate-spin" /> : <Reply size={13} />}
            <span>Generate 3 Reply Options</span>
          </button>

          {/* Render Suggestions */}
          <div className="flex flex-col gap-2.5 mt-1">
            {suggestions.map((item) => (
              <div key={item.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">{item.style_label}</span>
                  <span className="text-[10px] text-slate-500">{item.character_count} chars</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text">{item.content}</p>
                <div className="flex justify-end gap-1.5 pt-1 border-t border-slate-900">
                  <button
                    onClick={() => handleCopySuggestion(item)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium transition"
                  >
                    {copiedId === item.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => handleInjectIntoPage(item)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold transition"
                    title="Insert directly into focused reply box in active web tab"
                  >
                    {injectedId === item.id ? <Check size={11} /> : <ArrowDownToLine size={11} />}
                    <span>{injectedId === item.id ? 'Injected!' : 'Insert to Page'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
