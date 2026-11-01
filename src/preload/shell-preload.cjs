/**
 * ContextBridge Preload Script for Aether Browser Shell UI (CommonJS)
 * Electron sandboxed preloads must use CommonJS syntax.
 */

const { contextBridge, ipcRenderer } = require('electron');

const browserAPI = {
  // --- Tabs & Navigation ---
  createTab: (url, workspaceId) =>
    ipcRenderer.invoke('tabs:create', { url, workspaceId }),

  closeTab: (tabId) =>
    ipcRenderer.invoke('tabs:close', { tabId }),

  selectTab: (tabId) =>
    ipcRenderer.invoke('tabs:select', { tabId }),

  navigate: (tabId, url) =>
    ipcRenderer.invoke('tabs:navigate', { tabId, url }),

  goBack: (tabId) =>
    ipcRenderer.invoke('tabs:goBack', { tabId }),

  goForward: (tabId) =>
    ipcRenderer.invoke('tabs:goForward', { tabId }),

  reload: (tabId) =>
    ipcRenderer.invoke('tabs:reload', { tabId }),

  togglePinTab: (tabId) =>
    ipcRenderer.invoke('tabs:togglePin', { tabId }),

  // --- Workspaces ---
  getWorkspaces: () =>
    ipcRenderer.invoke('workspaces:getAll'),

  switchWorkspace: (workspaceId) =>
    ipcRenderer.invoke('workspaces:switch', { workspaceId }),

  // --- Layout Controls ---
  toggleCopilot: (visible) =>
    ipcRenderer.invoke('layout:toggleCopilot', { visible }),

  toggleSidebar: (visible) =>
    ipcRenderer.invoke('layout:toggleSidebar', { visible }),

  // --- History & Omnibox ---
  searchHistory: (query) =>
    ipcRenderer.invoke('history:search', { query }),

  clearHistory: () =>
    ipcRenderer.invoke('history:clear'),

  // --- AI Copilot Pipeline ---
  summarizeCurrentPage: (userPrompt) =>
    ipcRenderer.invoke('ai:summarizePage', { userPrompt }),

  queryCopilot: (prompt) =>
    ipcRenderer.invoke('ai:queryCopilot', { prompt }),

  setApiKey: (apiKey) =>
    ipcRenderer.invoke('ai:setApiKey', { apiKey }),

  onAIStream: (callback) => {
    const handler = (_, chunk) => callback(chunk);
    ipcRenderer.on('ai:stream', handler);
    return () => ipcRenderer.removeListener('ai:stream', handler);
  },

  // --- Social Content Creation Suite ---
  generatePost: (params) =>
    ipcRenderer.invoke('ai:generatePost', params),

  generateComment: (params) =>
    ipcRenderer.invoke('ai:generateComment', params),

  generateReply: (params) =>
    ipcRenderer.invoke('ai:generateReply', params),

  insertTextToActiveTab: (text) =>
    ipcRenderer.invoke('tabs:insertText', { text }),

  // --- State Broadcast Listeners ---
  onOpenAiComment: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('action:openAiComment', handler);
    return () => ipcRenderer.removeListener('action:openAiComment', handler);
  },

  onOpenAiPost: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('action:openAiPost', handler);
    return () => ipcRenderer.removeListener('action:openAiPost', handler);
  },

  onTabsUpdated: (callback) => {
    const handler = (_, data) =>
      callback(data.tabs, data.activeId, data.workspaceId);
    ipcRenderer.on('tabs:updated', handler);
    return () => ipcRenderer.removeListener('tabs:updated', handler);
  }
};

contextBridge.exposeInMainWorld('browserAPI', browserAPI);
