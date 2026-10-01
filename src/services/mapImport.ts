import { BackendAPI } from '../api';
import { useAppStore } from '../stores/appStore';
import { pickImportFile, type FileFilter } from './importFiles';
import { notifyError } from './notify';

export const MAP_FILE_FILTERS: FileFilter[] = [
  { name: 'ROS Map (*.yaml, *.yml)', extensions: ['yaml', 'yml'] },
  { name: 'Image Map (*.png, *.jpg, *.jpeg, *.pgm)', extensions: ['png', 'jpg', 'jpeg', 'pgm'] },
];

/**
 * ファイルを選んでマップとして読み込み、新しいマップレイヤーとして追加する。
 * レイヤーパネル、ワークフロー、インポートの入口が共通で使う。
 *
 * @returns マップを追加したかどうか（キャンセルや失敗なら false。失敗はユーザーに知らせる）。
 */
export async function importMapFromDialog(options: { fitToMaps?: boolean } = {}): Promise<boolean> {
  try {
    const path = await pickImportFile(MAP_FILE_FILTERS);
    if (!path) return false;

    const store = useAppStore.getState();
    const fileName = path.split(/[/\\]/).pop() || 'Map';
    await store.runWithLoading({ message: 'マップを読み込み中...', detail: fileName, blocking: true }, async () => {
      const mapData = await BackendAPI.loadROSMap(path);
      store.addMapLayer(fileName, mapData.info, mapData.image_data_b64, mapData.width, mapData.height);
      if (options.fitToMaps) store.triggerFitToMaps();
    });
    return true;
  } catch (err) {
    console.error('Failed to load map:', err);
    void notifyError(`マップの読み込みに失敗しました。\nエラー詳細: ${String(err)}`);
    return false;
  }
}
