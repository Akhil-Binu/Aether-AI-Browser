/**
 * ContextBridge Preload Script for Aether Browser Shell UI
 * Provides secure, typed IPC communication between the Sandboxed React Renderer and Electron Main Process.
 */

import { contextBridge, ipcRenderer } from 'electron';

export interface TabData {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isPinned: boolean;
  workspaceId: string;
}

export interface WorkspaceData {
  id: string;
  name: string;
  icon: string;
  partition: string;
  color: string;
}

export interface AIStreamChunk {
  text: string;
  isComplete: boolean;
  error?: string;
}

export interface BrowserHistoryItem {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}

export interface ContentSuggestion {
  id: number;
  style_label: string;
  content: string;
  character_count: number;
}

export interface ContentGenerationResult {
  mode: 'post_generator' | 'comment_generator' | 'reply_to_comment';
  suggestions: ContentSuggestion[];
}

const browserAPI = {
  // --- Tabs & Navigation ---
  createTab: (url?: string, workspaceId?: string) =>
    ipcRenderer.invoke('tabs:create', { url, workspaceId }),

  closeTab: (tabId: string) =>
    ipcRenderer.invoke('tabs:close', { tabId }),

  selectTab: (tabId: string) =>
    ipcRenderer.invoke('tabs:select', { tabId }),

  navigate: (tabId: string, url: string) =>
    ipcRenderer.invoke('tabs:navigate', { tabId, url }),

  goBack: (tabId: string) =>
    ipcRenderer.invoke('tabs:goBack', { tabId }),

  goForward: (tabId: string) =>
    ipcRenderer.invoke('tabs:goForward', { tabId }),

  reload: (tabId: string) =>
    ipcRenderer.invoke('tabs:reload', { tabId }),

  togglePinTab: (tabId: string) =>
    ipcRenderer.invoke('tabs:togglePin', { tabId }),

  // --- Workspaces ---
  getWorkspaces: () =>
    ipcRenderer.invoke('workspaces:getAll'),

  switchWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('workspaces:switch', { workspaceId }),

  // --- Layout Controls ---
  toggleCopilot: (visible: boolean) =>
    ipcRenderer.invoke('layout:toggleCopilot', { visible }),

  toggleSidebar: (visible: boolean) =>
    ipcRenderer.invoke('layout:toggleSidebar', { visible }),

  // --- History & Omnibox ---
  searchHistory: (query: string): Promise<BrowserHistoryItem[]> =>
    ipcRenderer.invoke('history:search', { query }),

  clearHistory: () =>
    ipcRenderer.invoke('history:clear'),

  // --- AI Copilot Pipeline ---
  summarizeCurrentPage: (userPrompt?: string) =>
    ipcRenderer.invoke('ai:summarizePage', { userPrompt }),

  queryCopilot: (prompt: string) =>
    ipcRenderer.invoke('ai:queryCopilot', { prompt }),

  setApiKey: (apiKey: string) =>
    ipcRenderer.invoke('ai:setApiKey', { apiKey }),

  onAIStream: (callback: (chunk: AIStreamChunk) => void) => {
    const handler = (_: any, chunk: AIStreamChunk) => callback(chunk);
    ipcRenderer.on('ai:stream', handler);
    return () => ipcRenderer.removeListener('ai:stream', handler);
  },

  // --- Social Content Creation Suite ---
  generatePost: (params: { topic: string; tone?: string; audience?: string; instructions?: string }): Promise<ContentGenerationResult> =>
    ipcRenderer.invoke('ai:generatePost', params),

  generateComment: (params: { sourcePostText?: string; tone?: string; instructions?: string }): Promise<ContentGenerationResult> =>
    ipcRenderer.invoke('ai:generateComment', params),

  generateReply: (params: { sourcePostText?: string; sourceCommentText: string; tone?: string; instructions?: string }): Promise<ContentGenerationResult> =>
    ipcRenderer.invoke('ai:generateReply', params),

  insertTextToActiveTab: (text: string): Promise<boolean> =>
    ipcRenderer.invoke('tabs:insertText', { text }),

  // --- State Broadcast Listeners ---
  onTabsUpdated: (callback: (tabs: TabData[], activeId: string, workspaceId: string) => void) => {
    const handler = (_: any, data: { tabs: TabData[]; activeId: string; workspaceId: string }) =>
      callback(data.tabs, data.activeId, data.workspaceId);
    ipcRenderer.on('tabs:updated', handler);
    return () => ipcRenderer.removeListener('tabs:updated', handler);
  }
};

contextBridge.exposeInMainWorld('browserAPI', browserAPI);
export type BrowserAPI = typeof browserAPI;
