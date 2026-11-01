/**
 * Tab and Workspace Manager (Electron WebContentsView Core)
 * Manages native WebContentsViews, bounds calculation, partition isolation, and history.
 */

import { BrowserWindow, WebContentsView, WebContents, Menu, MenuItem, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { TabData, WorkspaceData, LayoutBounds, BrowserHistoryItem } from './types.js';
import { AIService } from './ai-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TabInternal {
  id: string;
  view: WebContentsView;
  title: string;
  url: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isPinned: boolean;
  workspaceId: string;
}

export class TabManager {
  private window: BrowserWindow;
  private shellWebContents: WebContents | null = null;
  private aiService: AIService | null = null;
  private tabs: Map<string, TabInternal> = new Map();
  private activeTabId: string | null = null;
  private activeWorkspaceId = 'workspace-default';
  private history: BrowserHistoryItem[] = [];

  private workspaces: WorkspaceData[] = [
    { id: 'workspace-default', name: 'Personal', icon: 'User', partition: 'persist:personal', color: '#6366f1' },
    { id: 'workspace-work', name: 'Work', icon: 'Briefcase', partition: 'persist:work', color: '#0ea5e9' },
    { id: 'workspace-research', name: 'Research', icon: 'BookOpen', partition: 'persist:research', color: '#10b981' },
    { id: 'workspace-incognito', name: 'Incognito', icon: 'Shield', partition: 'in-memory', color: '#f43f5e' }
  ];

  private layout: LayoutBounds = {
    topBarHeight: 44,
    sidebarWidth: 240,
    copilotWidth: 390,
    isCopilotOpen: true,
    isSidebarOpen: true
  };

  constructor(window: BrowserWindow, shellWebContents?: WebContents, aiService?: AIService) {
    this.window = window;
    this.shellWebContents = shellWebContents || null;
    this.aiService = aiService || null;
    this.window.on('resize', () => this.relayout());
  }

  public setShellWebContents(wc: WebContents) {
    this.shellWebContents = wc;
    this.broadcastState();
  }

  public getWorkspaces(): WorkspaceData[] {
    return this.workspaces;
  }

  public switchWorkspace(workspaceId: string) {
    this.activeWorkspaceId = workspaceId;
    const workspaceTabs = this.getTabsForWorkspace(workspaceId);

    if (workspaceTabs.length > 0) {
      this.selectTab(workspaceTabs[0].id);
    } else {
      this.createTab('https://duckduckgo.com', workspaceId);
    }
  }

  public createTab(initialUrl = 'https://duckduckgo.com', workspaceId = this.activeWorkspaceId): TabInternal {
    const ws = this.workspaces.find((w) => w.id === workspaceId) || this.workspaces[0];
    const tabSession = ws.partition === 'in-memory'
      ? session.fromPartition(`incognito-${Date.now()}`)
      : session.fromPartition(ws.partition);

    const view = new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        session: tabSession,
        safeDialogs: true,
        preload: path.join(__dirname, '../preload/tab-preload.cjs')
      }
    });

    const id = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const tab: TabInternal = {
      id,
      view,
      title: 'New Tab',
      url: initialUrl,
      isLoading: true,
      canGoBack: false,
      canGoForward: false,
      isPinned: false,
      workspaceId
    };

    this.setupTabListeners(tab);
    view.webContents.loadURL(initialUrl);

    this.tabs.set(id, tab);
    this.selectTab(id);
    return tab;
  }

  public selectTab(id: string) {
    const target = this.tabs.get(id);
    if (!target) return;

    // Detach current view from host window
    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      const current = this.tabs.get(this.activeTabId)!;
      try {
        this.window.contentView.removeChildView(current.view);
      } catch (e) {
        // Safe detach
      }
    }

    this.activeTabId = id;
    this.activeWorkspaceId = target.workspaceId;

    // Attach target view
    try {
      this.window.contentView.addChildView(target.view);
    } catch (e) {
      // Re-attach
    }

    this.relayout();
    this.broadcastState();
  }

  public closeTab(id: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;

    if (this.activeTabId === id) {
      try {
        this.window.contentView.removeChildView(tab.view);
      } catch (e) {}

      const remaining = this.getTabsForWorkspace(tab.workspaceId).filter((t) => t.id !== id);
      if (remaining.length > 0) {
        this.selectTab(remaining[remaining.length - 1].id);
      } else {
        this.createTab('https://duckduckgo.com', tab.workspaceId);
      }
    }

    // Clean up WebContents to free RAM
    try {
      (tab.view.webContents as any).destroy();
    } catch (e) {}

    this.tabs.delete(id);
    this.broadcastState();
  }

  public navigate(tabId: string, url: string) {
    const tab = this.tabs.get(tabId) || this.getActiveTab();
    if (!tab) return;

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith('about:')) {
      if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
        targetUrl = `https://${targetUrl}`;
      } else {
        targetUrl = `https://duckduckgo.com/?q=${encodeURIComponent(targetUrl)}`;
      }
    }

    tab.view.webContents.loadURL(targetUrl);
  }

  public goBack(tabId?: string) {
    const tab = tabId ? this.tabs.get(tabId) : this.getActiveTab();
    if (tab && tab.view.webContents.canGoBack()) tab.view.webContents.goBack();
  }

  public goForward(tabId?: string) {
    const tab = tabId ? this.tabs.get(tabId) : this.getActiveTab();
    if (tab && tab.view.webContents.canGoForward()) tab.view.webContents.goForward();
  }

  public reload(tabId?: string) {
    const tab = tabId ? this.tabs.get(tabId) : this.getActiveTab();
    if (tab) tab.view.webContents.reload();
  }

  public togglePinTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.isPinned = !tab.isPinned;
      this.broadcastState();
    }
  }

  public setLayout(partial: Partial<LayoutBounds>) {
    this.layout = { ...this.layout, ...partial };
    this.relayout();
  }

  public relayout() {
    if (!this.activeTabId) return;
    const active = this.tabs.get(this.activeTabId);
    if (!active) return;

    const [winWidth, winHeight] = this.window.getContentSize();

    const currentSidebarWidth = this.layout.isSidebarOpen ? this.layout.sidebarWidth : 0;
    const currentCopilotWidth = this.layout.isCopilotOpen ? this.layout.copilotWidth : 0;

    const x = currentSidebarWidth;
    const y = this.layout.topBarHeight;
    const width = Math.max(0, winWidth - currentSidebarWidth - currentCopilotWidth);
    const height = Math.max(0, winHeight - this.layout.topBarHeight);

    try {
      active.view.setBounds({ x, y, width, height });
    } catch (e) {
      // Ignore transient resize errors
    }
  }

  public getActiveTab(): TabInternal | null {
    return this.activeTabId ? this.tabs.get(this.activeTabId) || null : null;
  }

  public async insertTextIntoActiveTab(text: string): Promise<boolean> {
    const active = this.getActiveTab();
    if (!active) return false;

    try {
      const inserted = await active.view.webContents.executeJavaScript(`
        (() => {
          // 1. Locate editable target element
          const target = document.querySelector('div.editor-content[contenteditable="true"], div.ql-editor[contenteditable="true"], div[role="textbox"][contenteditable="true"], div[contenteditable="true"], textarea') || document.activeElement;

          if (target) {
            target.focus();
            try {
              document.execCommand('selectAll', false, null);
              document.execCommand('insertText', false, ${JSON.stringify(text)});
            } catch (e) {
              if ('value' in target) {
                target.value = ${JSON.stringify(text)};
              } else {
                target.innerText = ${JSON.stringify(text)};
              }
            }
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        })()
      `);
      if (inserted) return true;
    } catch (err) {
      // Fallback native insertion
      try {
        active.view.webContents.insertText(text);
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  public searchHistory(query: string): BrowserHistoryItem[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.history.slice(-10).reverse();
    return this.history
      .filter((h) => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q))
      .slice(-10)
      .reverse();
  }

  public clearHistory() {
    this.history = [];
  }

  private getTabsForWorkspace(workspaceId: string): TabInternal[] {
    return Array.from(this.tabs.values()).filter((t) => t.workspaceId === workspaceId);
  }

  private setupTabListeners(tab: TabInternal) {
    const wc = tab.view.webContents;

    wc.on('did-start-loading', () => {
      tab.isLoading = true;
      this.broadcastState();
    });

    wc.on('did-stop-loading', () => {
      tab.isLoading = false;
      tab.title = wc.getTitle() || 'Untitled';
      tab.url = wc.getURL();
      tab.canGoBack = wc.canGoBack();
      tab.canGoForward = wc.canGoForward();

      if (tab.url && !tab.url.startsWith('about:')) {
        this.history.push({
          id: `hist-${Date.now()}`,
          title: tab.title,
          url: tab.url,
          visitedAt: Date.now()
        });
      }

      this.broadcastState();
    });

    wc.on('page-title-updated', (_, title) => {
      tab.title = title;
      this.broadcastState();
    });

    wc.on('page-favicon-updated', (_, favicons) => {
      if (favicons.length > 0) {
        tab.favicon = favicons[0];
        this.broadcastState();
      }
    });

    wc.setWindowOpenHandler(({ url }) => {
      this.createTab(url, tab.workspaceId);
      return { action: 'deny' };
    });

    // Native Right-Click Context Menu for Comments & Selection
    wc.on('context-menu', (event, params) => {
      const menu = new Menu();

      if (params.selectionText && params.selectionText.trim().length > 0) {
        menu.append(new MenuItem({
          label: '💬 Generate AI Comment for Selection',
          click: () => {
            this.shellWebContents?.send('action:openAiComment', { text: params.selectionText });
          }
        }));

        menu.append(new MenuItem({
          label: '✍️ Create Post from Selection',
          click: () => {
            this.shellWebContents?.send('action:openAiPost', { text: params.selectionText });
          }
        }));

        menu.append(new MenuItem({ type: 'separator' }));
      }

      if (params.isEditable) {
        menu.append(new MenuItem({
          label: '✨ Auto-Generate AI Comment & Insert Here',
          click: async () => {
            if (this.aiService) {
              try {
                const pageData = await this.aiService.extractCleanPageContent(wc);
                const res = await this.aiService.generateSocialComment({ sourcePostText: pageData.content });
                if (res.suggestions.length > 0) {
                  wc.insertText(res.suggestions[0].content);
                }
              } catch (e) {}
            }
          }
        }));
        menu.append(new MenuItem({ type: 'separator' }));
      }

      menu.append(new MenuItem({ role: 'cut' }));
      menu.append(new MenuItem({ role: 'copy' }));
      menu.append(new MenuItem({ role: 'paste' }));
      menu.popup();
    });
  }

  private broadcastState() {
    const payload = {
      tabs: Array.from(this.tabs.values()).map((t) => ({
        id: t.id,
        title: t.title,
        url: t.url,
        favicon: t.favicon,
        isLoading: t.isLoading,
        canGoBack: t.canGoBack,
        canGoForward: t.canGoForward,
        isPinned: t.isPinned,
        workspaceId: t.workspaceId
      })),
      activeId: this.activeTabId || '',
      workspaceId: this.activeWorkspaceId
    };

    if (this.shellWebContents && !this.shellWebContents.isDestroyed()) {
      this.shellWebContents.send('tabs:updated', payload);
    }
  }
}
