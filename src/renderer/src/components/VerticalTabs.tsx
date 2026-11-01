import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  X, 
  Pin, 
  Globe, 
  Briefcase, 
  User, 
  BookOpen, 
  ShieldAlert,
  Loader2 
} from 'lucide-react';
import { TabData, WorkspaceData } from '../../../preload/shell-preload';

interface VerticalTabsProps {
  tabs: TabData[];
  activeId: string;
  activeWorkspaceId: string;
}

export const VerticalTabs: React.FC<VerticalTabsProps> = ({
  tabs,
  activeId,
  activeWorkspaceId
}) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);

  useEffect(() => {
    window.browserAPI.getWorkspaces().then(setWorkspaces);
  }, []);

  const currentWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const workspaceTabs = tabs.filter((t) => t.workspaceId === activeWorkspaceId);
  const pinnedTabs = workspaceTabs.filter((t) => t.isPinned);
  const unpinnedTabs = workspaceTabs.filter((t) => !t.isPinned);

  const getWorkspaceIcon = (iconName: string) => {
    switch (iconName) {
      case 'Briefcase': return <Briefcase size={13} />;
      case 'BookOpen': return <BookOpen size={13} />;
      case 'Shield': return <ShieldAlert size={13} />;
      default: return <User size={13} />;
    }
  };

  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none z-20">
      {/* Workspace Switcher */}
      <div className="p-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-950 rounded-lg border border-slate-800">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => window.browserAPI.switchWorkspace(ws.id)}
              className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition text-xs ${
                ws.id === activeWorkspaceId
                  ? 'bg-slate-800 text-white shadow-sm font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              style={{ borderBottom: ws.id === activeWorkspaceId ? `2px solid ${ws.color}` : 'none' }}
              title={ws.name}
            >
              {getWorkspaceIcon(ws.icon)}
            </button>
          ))}
        </div>
      </div>

      {/* Workspace Label & New Tab Action */}
      <div className="px-3 py-2 flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500">
          {currentWorkspace?.name || 'Workspace'}
        </span>
        <button
          onClick={() => window.browserAPI.createTab(undefined, activeWorkspaceId)}
          className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition"
        >
          <Plus size={13} />
          <span>New</span>
        </button>
      </div>

      {/* Pinned Tabs (Grid/Compact) */}
      {pinnedTabs.length > 0 && (
        <div className="px-2 pb-2 grid grid-cols-4 gap-1 border-b border-slate-800/60 mb-1">
          {pinnedTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => window.browserAPI.selectTab(tab.id)}
              className={`h-9 flex items-center justify-center rounded-lg transition relative ${
                tab.id === activeId ? 'bg-indigo-600 text-white' : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300'
              }`}
              title={tab.title}
            >
              {tab.favicon ? (
                <img src={tab.favicon} alt="" className="w-3.5 h-3.5 rounded-sm" />
              ) : (
                <Globe size={13} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable Regular Tabs */}
      <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-0.5">
        {unpinnedTabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <div
              key={tab.id}
              onClick={() => window.browserAPI.selectTab(tab.id)}
              className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                isActive
                  ? 'bg-indigo-600/90 text-white font-medium shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              {/* Favicon or Loading Spinner */}
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                {tab.isLoading ? (
                  <Loader2 size={12} className="animate-spin text-indigo-300" />
                ) : tab.favicon ? (
                  <img src={tab.favicon} alt="" className="w-3.5 h-3.5 rounded-sm" />
                ) : (
                  <Globe size={13} className={isActive ? 'text-white' : 'text-slate-400'} />
                )}
              </div>

              {/* Title */}
              <span className="truncate flex-1 text-[12px]">{tab.title || 'Untitled'}</span>

              {/* Hover Actions: Pin & Close */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.browserAPI.togglePinTab(tab.id);
                  }}
                  className="p-1 hover:text-amber-300 rounded transition"
                  title="Pin Tab"
                >
                  <Pin size={11} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.browserAPI.closeTab(tab.id);
                  }}
                  className="p-1 hover:text-rose-400 rounded transition"
                  title="Close Tab"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
