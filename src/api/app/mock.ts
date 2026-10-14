import { IAppAPI } from '../types';

const MOCK_SETTINGS_KEY = 'waypoint-tool-storage';

/** Browser / test stand-in: window control is a no-op and there is no real process to quit. */
export class MockAppAPI implements IAppAPI {
  async getVersion(): Promise<string> {
    return '0.0.0-mock';
  }

  async forceExit(): Promise<void> {
    console.log('[Mock App] forceExit called');
  }

  async openDevtools(): Promise<void> {}

  async setWindowTitle(title: string): Promise<void> {
    document.title = title;
  }

  async minimizeWindow(): Promise<void> {}

  async toggleMaximizeWindow(): Promise<void> {}

  async saveWindowState(): Promise<void> {}

  async loadUserSettings(): Promise<string | null> {
    try {
      return localStorage.getItem(MOCK_SETTINGS_KEY);
    } catch {
      return null;
    }
  }

  async saveUserSettings(contents: string): Promise<void> {
    try {
      localStorage.setItem(MOCK_SETTINGS_KEY, contents);
    } catch {
      // localStorage may be unavailable (private window, blocked site data).
    }
  }

  async onCloseRequested(): Promise<() => void> {
    return () => {};
  }
}
