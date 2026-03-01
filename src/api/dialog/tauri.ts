import { open as tauriOpen, save as tauriSave, ask as tauriAsk } from '@tauri-apps/plugin-dialog';
import { IDialogAPI, OpenDialogOptions, SaveDialogOptions } from '../types';

export class TauriDialogAPI implements IDialogAPI {
  async open(options?: OpenDialogOptions): Promise<string | string[] | null> {
    return tauriOpen(options as import('@tauri-apps/plugin-dialog').OpenDialogOptions);
  }

  async save(options?: SaveDialogOptions): Promise<string | null> {
    return tauriSave(options as import('@tauri-apps/plugin-dialog').SaveDialogOptions);
  }

  async ask(message: string, options?: any): Promise<boolean> {
    return tauriAsk(message, options);
  }
}
