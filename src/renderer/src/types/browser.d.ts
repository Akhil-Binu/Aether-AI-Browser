import { BrowserAPI } from '../../../preload/shell-preload';

declare global {
  interface Window {
    browserAPI: BrowserAPI;
  }
}

export {};
