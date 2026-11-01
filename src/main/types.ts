/**
 * Shared Type Definitions for Aether AI Browser (Main Process)
 */

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

export interface LayoutBounds {
  topBarHeight: number;
  sidebarWidth: number;
  copilotWidth: number;
  isCopilotOpen: boolean;
  isSidebarOpen: boolean;
}

export interface BrowserHistoryItem {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}
