/**
 * Aether AI Browser - Main Process Lifecycle & IPC Hub
 * Powers a secure, multi-view architecture with BaseWindow and isolated WebContentsViews.
 */

import { app, BaseWindow, WebContentsView, ipcMain, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { TabManager } from './tab-manager.js';
import { PrivacyManager } from './adblocker.js';
import { AIService } from './ai-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BaseWindow | null = null;
let shellView: WebContentsView | null = null;
let tabManager: TabManager | null = null;
const privacyManager = new PrivacyManager();
const aiService = new AIService();

async function createBrowser() {
  // 1. Create BaseWindow (Frameless, native host)
  mainWindow = new BaseWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#070d19',
    titleBarStyle: 'hiddenInset'
  });

  // 2. Create Shell UI View (Runs React Browser Chrome)
  shellView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/shell-preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  mainWindow.contentView.addChildView(shellView);

  // Position Shell View across entire host window
  const updateShellBounds = () => {
    if (!mainWindow || !shellView) return;
    const [w, h] = mainWindow.getSize();
    shellView.setBounds({ x: 0, y: 0, width: w, height: h });
  };

  updateShellBounds();
  mainWindow.on('resize', updateShellBounds);

  // 3. Setup Privacy Protection on default & partition sessions
  privacyManager.setupSessionPrivacy(session.defaultSession);

  // 4. Initialize Tab Manager
  tabManager = new TabManager(mainWindow, shellView.webContents);

  // Register all IPC Handlers
  setupIpcHandlers();

  // Load React Shell UI
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    shellView.webContents.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    shellView.webContents.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Create default first tab
  tabManager.createTab('https://duckduckgo.com');
}

function setupIpcHandlers() {
  if (!tabManager || !shellView) return;

  // --- Tab Lifecycle ---
  ipcMain.handle('tabs:create', (_, { url, workspaceId }) => {
    return tabManager?.createTab(url, workspaceId);
  });

  ipcMain.handle('tabs:close', (_, { tabId }) => {
    tabManager?.closeTab(tabId);
  });

  ipcMain.handle('tabs:select', (_, { tabId }) => {
    tabManager?.selectTab(tabId);
  });

  ipcMain.handle('tabs:navigate', (_, { tabId, url }) => {
    tabManager?.navigate(tabId, url);
  });

  ipcMain.handle('tabs:goBack', (_, { tabId }) => {
    tabManager?.goBack(tabId);
  });

  ipcMain.handle('tabs:goForward', (_, { tabId }) => {
    tabManager?.goForward(tabId);
  });

  ipcMain.handle('tabs:reload', (_, { tabId }) => {
    tabManager?.reload(tabId);
  });

  ipcMain.handle('tabs:togglePin', (_, { tabId }) => {
    tabManager?.togglePinTab(tabId);
  });

  ipcMain.handle('tabs:insertText', async (_, { text }) => {
    return (await tabManager?.insertTextIntoActiveTab(text)) || false;
  });

  // --- Workspaces ---
  ipcMain.handle('workspaces:getAll', () => {
    return tabManager?.getWorkspaces();
  });

  ipcMain.handle('workspaces:switch', (_, { workspaceId }) => {
    tabManager?.switchWorkspace(workspaceId);
  });

  // --- Layout Controls ---
  ipcMain.handle('layout:toggleCopilot', (_, { visible }) => {
    tabManager?.setLayout({ isCopilotOpen: visible });
  });

  ipcMain.handle('layout:toggleSidebar', (_, { visible }) => {
    tabManager?.setLayout({ isSidebarOpen: visible });
  });

  // --- History ---
  ipcMain.handle('history:search', (_, { query }) => {
    return tabManager?.searchHistory(query);
  });

  ipcMain.handle('history:clear', () => {
    tabManager?.clearHistory();
  });

  // --- AI Copilot Pipeline ---
  ipcMain.handle('ai:setApiKey', (_, { apiKey }) => {
    aiService.setApiKey(apiKey);
  });

  ipcMain.handle('ai:summarizePage', async (_, { userPrompt }) => {
    const activeTab = tabManager?.getActiveTab();
    if (!activeTab || !shellView) return;

    try {
      const pageData = await aiService.extractCleanPageContent(activeTab.view.webContents);
      aiService.streamAnalysis(pageData, userPrompt, (text, isComplete, error) => {
        shellView?.webContents.send('ai:stream', { text, isComplete, error });
      });
    } catch (err: any) {
      shellView.webContents.send('ai:stream', { text: '', isComplete: true, error: err.message });
    }
  });

  ipcMain.handle('ai:queryCopilot', async (_, { prompt }) => {
    const activeTab = tabManager?.getActiveTab();
    if (!activeTab || !shellView) return;

    try {
      const pageData = await aiService.extractCleanPageContent(activeTab.view.webContents);
      aiService.streamAnalysis(pageData, prompt, (text, isComplete, error) => {
        shellView?.webContents.send('ai:stream', { text, isComplete, error });
      });
    } catch (err: any) {
      shellView.webContents.send('ai:stream', { text: '', isComplete: true, error: err.message });
    }
  });

  // --- Social Content Creation Suite ---
  ipcMain.handle('ai:generatePost', async (_, params) => {
    return await aiService.generateSocialPost(params);
  });

  ipcMain.handle('ai:generateComment', async (_, params) => {
    // If user didn't provide post text, automatically scrape it from current active tab!
    let sourceText = params.sourcePostText;
    if (!sourceText) {
      const activeTab = tabManager?.getActiveTab();
      if (activeTab) {
        try {
          const pageData = await aiService.extractCleanPageContent(activeTab.view.webContents);
          sourceText = pageData.content.slice(0, 2000);
        } catch (e) {}
      }
    }
    return await aiService.generateSocialComment({ ...params, sourcePostText: sourceText });
  });

  ipcMain.handle('ai:generateReply', async (_, params) => {
    let sourceText = params.sourcePostText;
    if (!sourceText) {
      const activeTab = tabManager?.getActiveTab();
      if (activeTab) {
        try {
          const pageData = await aiService.extractCleanPageContent(activeTab.view.webContents);
          sourceText = pageData.content.slice(0, 1500);
        } catch (e) {}
      }
    }
    return await aiService.generateSocialReply({ ...params, sourcePostText: sourceText });
  });
}

// App lifecycle
app.whenReady().then(createBrowser);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BaseWindow.getAllWindows().length === 0) {
    createBrowser();
  }
});
