import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Globe, 
  Sparkles, 
  Trash2, 
  Plus, 
  ExternalLink,
  Command
} from 'lucide-react';
import { TabData } from '../../../preload/shell-preload';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: TabData[];
  onToggleCopilot: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  tabs,
  onToggleCopilot
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? onClose() : null;
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredTabs = tabs.filter((t) =>
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    t.url.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div 
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-start justify-center pt-24 select-none"
      onClick={onClose}
    >
      <div 
        className="w-[560px] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3 border-b border-slate-800 flex items-center gap-2.5">
          <Search size={16} className="text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search open tabs, actions, or enter a URL..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 flex flex-col gap-1 text-xs">
          {/* Quick Actions */}
          <div className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
            Quick Actions
          </div>

          <button
            onClick={() => {
              window.browserAPI.createTab();
              onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 transition text-left"
          >
            <Plus size={14} className="text-indigo-400" />
            <span className="font-medium">Open New Tab</span>
          </button>

          <button
            onClick={() => {
              onToggleCopilot();
              onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 transition text-left"
          >
            <Sparkles size={14} className="text-amber-400" />
            <span className="font-medium">Toggle AI Copilot Sidebar</span>
          </button>

          <button
            onClick={() => {
              window.browserAPI.clearHistory();
              onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 transition text-left"
          >
            <Trash2 size={14} className="text-rose-400" />
            <span className="font-medium">Clear Browsing History</span>
          </button>

          {/* Open Tabs */}
          {filteredTabs.length > 0 && (
            <>
              <div className="px-2 py-1 mt-2 text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
                Switch to Open Tab
              </div>
              {filteredTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    window.browserAPI.selectTab(tab.id);
                    onClose();
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Globe size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{tab.title || 'Untitled'}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 truncate ml-4 max-w-[180px]">
                    {tab.url}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
