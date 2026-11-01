import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  ShieldCheck, 
  Sparkles, 
  Search, 
  Lock, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Clock 
} from 'lucide-react';
import { BrowserHistoryItem, TabData } from '../../../preload/shell-preload';

interface OmniboxProps {
  activeTab: TabData | undefined;
  isSidebarOpen: boolean;
  isCopilotOpen: boolean;
  onToggleSidebar: () => void;
  onToggleCopilot: () => void;
  onOpenCommandPalette: () => void;
}

export const Omnibox: React.FC<OmniboxProps> = ({
  activeTab,
  isSidebarOpen,
  isCopilotOpen,
  onToggleSidebar,
  onToggleCopilot,
  onOpenCommandPalette
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [historySuggestions, setHistorySuggestions] = useState<BrowserHistoryItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab && !isFocused) {
      setInputValue(activeTab.url);
    }
  }, [activeTab?.url, isFocused]);

  useEffect(() => {
    if (isFocused && inputValue.trim().length > 0) {
      window.browserAPI.searchHistory(inputValue).then((results) => {
        setHistorySuggestions(results);
      });
    } else {
      setHistorySuggestions([]);
    }
  }, [inputValue, isFocused]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTab || !inputValue.trim()) return;
    window.browserAPI.navigate(activeTab.id, inputValue);
    setIsFocused(false);
  };

  const handleSelectHistory = (url: string) => {
    if (!activeTab) return;
    window.browserAPI.navigate(activeTab.id, url);
    setIsFocused(false);
  };

  const isHttps = activeTab?.url.startsWith('https://');

  return (
    <header className="h-11 bg-slate-900 border-b border-slate-800 flex items-center px-3 gap-2.5 z-30 select-none">
      {/* Navigation & Sidebar Controls */}
      <div className="flex items-center gap-1 text-slate-400">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded-md transition"
          title={isSidebarOpen ? "Hide Workspaces" : "Show Workspaces"}
        >
          {isSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
        </button>

        <button
          onClick={() => activeTab && window.browserAPI.goBack(activeTab.id)}
          disabled={!activeTab?.canGoBack}
          className="p-1.5 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent rounded-md transition"
          title="Back"
        >
          <ArrowLeft size={15} />
        </button>

        <button
          onClick={() => activeTab && window.browserAPI.goForward(activeTab.id)}
          disabled={!activeTab?.canGoForward}
          className="p-1.5 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent rounded-md transition"
          title="Forward"
        >
          <ArrowRight size={15} />
        </button>

        <button
          onClick={() => activeTab && window.browserAPI.reload(activeTab.id)}
          className={`p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded-md transition ${activeTab?.isLoading ? 'animate-spin text-indigo-400' : ''}`}
          title="Reload"
        >
          <RotateCw size={14} />
        </button>
      </div>

      {/* Omnibox URL Bar */}
      <div ref={containerRef} className="flex-1 max-w-2xl mx-auto relative">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <div className="absolute left-3 text-slate-400 flex items-center pointer-events-none">
            {isHttps ? <Lock size={12} className="text-emerald-400" /> : <Search size={12} />}
          </div>

          <input
            type="text"
            value={inputValue}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search or enter URL (Cmd/Ctrl + L)..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-full pl-8 pr-16 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition shadow-inner"
          />

          <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none">
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
              Ctrl+K
            </span>
          </div>
        </form>

        {/* Search History Autocomplete Dropdown */}
        {isFocused && historySuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="p-1.5 flex flex-col gap-0.5">
              {historySuggestions.map((item) => (
                <div
                  key={item.id}
                  onMouseDown={() => handleSelectHistory(item.url)}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800/80 rounded-lg cursor-pointer transition text-xs"
                >
                  <Clock size={13} className="text-slate-500 shrink-0" />
                  <span className="font-medium text-slate-200 truncate">{item.title}</span>
                  <span className="text-[11px] text-slate-500 truncate ml-auto">{item.url}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Controls & AI Trigger */}
      <div className="flex items-center gap-1 text-slate-400">
        <div 
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-emerald-400 font-medium"
          title="Ad-blocker & Tracker Protection Active"
        >
          <ShieldCheck size={13} />
          <span>Shield</span>
        </div>

        <button
          onClick={onToggleCopilot}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
            isCopilotOpen 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'hover:bg-slate-800 text-slate-300'
          }`}
          title="Toggle AI Copilot"
        >
          <Sparkles size={13} className={isCopilotOpen ? 'text-amber-300' : 'text-indigo-400'} />
          <span>Copilot</span>
        </button>
      </div>
    </header>
  );
};
