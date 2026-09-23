import {
  open as tauriOpen,
  save as tauriSave,
  ask as tauriAsk,
  message as tauriMessage,
} from '@tauri-apps/plugin-dialog';
import { IDialogAPI, MessageDialogOptions, OpenDialogOptions, SaveDialogOptions } from '../types';

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

  async message(message: string, options?: MessageDialogOptions): Promise<void> {
    await tauriMessage(message, options);
  }
}
