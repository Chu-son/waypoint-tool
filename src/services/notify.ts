/**
 * User notifications and confirmations (docs/RULES.md §6.2).
 *
 * Use these instead of `window.alert` / `window.confirm`: they go through the native dialog in
 * the desktop app, don't block the renderer thread, and can be stubbed at the `DialogAPI` boundary
 * in tests.
 */
import { DialogAPI } from '../api';
import type { MessageDialogOptions } from '../api/types';

/** Show a message to the user. Resolves when the dialog is dismissed. */
export function notify(message: string, options?: MessageDialogOptions): Promise<void> {
  return DialogAPI.message(message, options);
}

/** Show an error message to the user. */
export function notifyError(message: string, title = 'エラー'): Promise<void> {
  return DialogAPI.message(message, { title, kind: 'error' });
}

/** Ask the user to confirm an action. Resolves to `true` if they accept. */
export function confirmAction(message: string, options?: MessageDialogOptions): Promise<boolean> {
  return DialogAPI.ask(message, { kind: 'warning', ...options });
}
