import { DialogAPI } from '../api';
import { useAppStore } from '../stores/appStore';

/**
 * Checks whether there are unsaved changes in the project.
 * If dirty, displays a confirmation dialog asking the user whether to discard changes.
 * Returns true if the user confirmed discard or if the project was not dirty.
 */
export async function confirmDiscardChanges(): Promise<boolean> {
  if (!useAppStore.getState().isDirty) return true;
  return await DialogAPI.ask(
    '未保存の変更があります。破棄して続行しますか？',
    {
      title: '未保存の変更の確認',
      kind: 'warning',
    }
  );
}
