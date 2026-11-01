import React, { useState, useEffect } from 'react';
import { TabData } from '../../preload/shell-preload';
import { Omnibox } from './components/Omnibox';
import { VerticalTabs } from './components/VerticalTabs';
import { CopilotPanel } from './components/CopilotPanel';
import { CommandPalette } from './components/CommandPalette';

export const App: React.FC = () => {
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('workspace-default');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [copilotMode, setCopilotMode] = useState<'copilot' | 'post_generator' | 'comment_generator' | 'reply_to_comment'>('comment_generator');

  useEffect(() => {
    // Listen for tab updates dispatched from Electron Main Process
    const unsub = window.browserAPI.onTabsUpdated((updatedTabs, currentActiveId, workspaceId) => {
      setTabs(updatedTabs);
      setActiveId(currentActiveId);
      setActiveWorkspaceId(workspaceId);
    });

    // Listen for action triggers from context menu or in-page buttons
    const unsubComment = window.browserAPI.onOpenAiComment?.(() => {
      setCopilotMode('comment_generator');
      setIsCopilotOpen(true);
      window.browserAPI.toggleCopilot(true);
    });

    const unsubPost = window.browserAPI.onOpenAiPost?.(() => {
      setCopilotMode('post_generator');
      setIsCopilotOpen(true);
      window.browserAPI.toggleCopilot(true);
    });

    // Listen for global keyboard shortcut Cmd/Ctrl + K
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsub();
      if (unsubComment) unsubComment();
      if (unsubPost) unsubPost();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleToggleSidebar = () => {
    const nextState = !isSidebarOpen;
    setIsSidebarOpen(nextState);
    window.browserAPI.toggleSidebar(nextState);
  };

  const handleToggleCopilot = () => {
    const nextState = !isCopilotOpen;
    setIsCopilotOpen(nextState);
    window.browserAPI.toggleCopilot(nextState);
  };

  const handleOpenMode = (mode: 'comment_generator' | 'post_generator' | 'copilot') => {
    setCopilotMode(mode);
    setIsCopilotOpen(true);
    window.browserAPI.toggleCopilot(true);
  };

  const activeTab = tabs.find((t) => t.id === activeId);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950 overflow-hidden select-none font-sans">
      {/* Top Omnibox & Navigation Bar */}
      <Omnibox
        activeTab={activeTab}
        isSidebarOpen={isSidebarOpen}
        isCopilotOpen={isCopilotOpen}
        onToggleSidebar={handleToggleSidebar}
        onToggleCopilot={handleToggleCopilot}
        onOpenMode={handleOpenMode}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Vertical Tab Sidebar */}
        {isSidebarOpen && (
          <VerticalTabs
            tabs={tabs}
            activeId={activeId}
            activeWorkspaceId={activeWorkspaceId}
          />
        )}

        {/* Center: Web Contents View Host
            The native Chromium WebContentsView renders here.
            Pointer events are disabled on this wrapper so the webview receives native clicks. */}
        <div className="flex-1 bg-transparent pointer-events-none" />

        {/* Right: AI Copilot Panel */}
        {isCopilotOpen && (
          <CopilotPanel 
            activeTab={activeTab} 
            activeMode={copilotMode}
            onModeChange={setCopilotMode}
          />
        )}
      </div>

      {/* Command Palette (Cmd/Ctrl + K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        tabs={tabs}
        onToggleCopilot={handleToggleCopilot}
      />
    </div>
  );
};
