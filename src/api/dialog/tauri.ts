import {
  open as tauriOpen,
  save as tauriSave,
  ask as tauriAsk,
  message as tauriMessage,
} from '@tauri-apps/plugin-dialog';
import {
  ChooseDialogOptions,
  ChooseResult,
  IDialogAPI,
  MessageDialogOptions,
  OpenDialogOptions,
  SaveDialogOptions,
} from '../types';

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

  async choose(message: string, options?: ChooseDialogOptions): Promise<ChooseResult> {
    const { labels, ...rest } = options ?? {};
    const buttons = { yes: labels?.yes ?? 'Yes', no: labels?.no ?? 'No', cancel: labels?.cancel ?? 'Cancel' };
    // The plugin answers with the label of the pressed button.
    const pressed = await tauriMessage(message, { ...rest, buttons });
    if (pressed === buttons.yes) return 'yes';
    if (pressed === buttons.no) return 'no';
    return 'cancel';
  }
}
