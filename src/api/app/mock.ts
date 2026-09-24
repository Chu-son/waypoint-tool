import { IAppAPI } from '../types';

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

  async onCloseRequested(): Promise<() => void> {
    return () => {};
  }
}
