import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { IAppAPI } from '../types';

export class TauriAppAPI implements IAppAPI {
  getVersion(): Promise<string> {
    return getVersion();
  }

  async forceExit(): Promise<void> {
    await invoke('force_exit');
  }

  async openDevtools(): Promise<void> {
    await invoke('open_devtools');
  }

  setWindowTitle(title: string): Promise<void> {
    return getCurrentWindow().setTitle(title);
  }

  minimizeWindow(): Promise<void> {
    return getCurrentWindow().minimize();
  }

  toggleMaximizeWindow(): Promise<void> {
    return getCurrentWindow().toggleMaximize();
  }

  async saveWindowState(): Promise<void> {
    const { saveWindowState, StateFlags } = await import('@tauri-apps/plugin-window-state');
    await saveWindowState(StateFlags.ALL);
  }

  onCloseRequested(handler: () => void | Promise<void>): Promise<() => void> {
    return getCurrentWindow().onCloseRequested(async (event) => {
      // Always intercept so the app decides when to quit (avoids window-state plugin races).
      event.preventDefault();
      await handler();
    });
  }
}
