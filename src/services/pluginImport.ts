/**
 * User flows for adding custom plugins from the file system (Settings > Plugins).
 */
import { BackendAPI, DialogAPI } from '../api';
import { useAppStore } from '../stores/appStore';
import type { PluginInstance } from '../types/store';
import { dedupePluginsById, mergeCustomPlugins, toPathList } from '../utils/pluginRegistry';
import { notify } from './notify';

const SECURITY_WARNING =
  'プラグインはPythonコードを直接実行します。有害なコードが含まれる場合、システムに悪影響を及ぼす可能性があります。自己責任で追加してください。追加を続行しますか？';

function confirmUntrustedCode(): Promise<boolean> {
  return DialogAPI.ask(SECURITY_WARNING, { title: 'セキュリティ警告', kind: 'warning' });
}

function registerCustomPlugins(added: PluginInstance[]) {
  const { plugins, pluginSettings, setPlugins, setPluginSettings } = useAppStore.getState();
  const merged = mergeCustomPlugins(plugins, pluginSettings, added);
  setPlugins(merged.plugins);
  setPluginSettings(merged.settings);
}

/**
 * Ask for one or more folders and import every plugin found in them (a plugin folder itself, or a
 * parent folder containing several plugins).
 */
export async function importPluginFolders(defaultPath?: string | null): Promise<void> {
  if (!(await confirmUntrustedCode())) return;
  try {
    const targetPaths = toPathList(
      await DialogAPI.open({ multiple: true, directory: true, defaultPath: defaultPath || undefined }),
    );
    if (targetPaths.length === 0) return;

    const scanned: PluginInstance[] = [];
    for (const path of targetPaths) {
      try {
        scanned.push(...(await BackendAPI.scanCustomPlugins(path)));
      } catch (scanErr) {
        console.warn(`Failed to scan plugins at ${path}:`, scanErr);
        if (targetPaths.length === 1) throw scanErr;
      }
    }

    const found = dedupePluginsById(scanned);
    if (found.length === 0) {
      void notify('指定されたディレクトリに有効なプラグイン (manifest.json) が見つかりませんでした。');
      return;
    }

    registerCustomPlugins(found);

    if (found.length === 1) {
      void notify(`Plugin '${found[0].manifest?.name || found[0].id}' をインポートしました。`);
    } else {
      const names = found.map((p) => p.manifest?.name || p.id).join(', ');
      void notify(`${found.length} 個のプラグインを一括インポートしました:\n${names}`);
    }
  } catch (err) {
    console.error('Failed to load custom plugin:', err);
    void notify(`Custom Plugin の読み込みに失敗しました。\nエラー詳細: ${String(err)}`);
  }
}

/** Ask for a folder and a name, then create a new plugin skeleton there and register it. */
export async function scaffoldNewPlugin(defaultPath?: string | null): Promise<void> {
  if (!(await confirmUntrustedCode())) return;
  try {
    const [targetDir] = toPathList(
      await DialogAPI.open({ multiple: false, directory: true, defaultPath: defaultPath || undefined }),
    );
    if (!targetDir) return;

    // eslint-disable-next-line no-alert -- no native text-input dialog is available yet
    const pluginName = window.prompt(`プラグイン名を入力してください:\n(作成先: ${targetDir})`)?.trim();
    if (!pluginName) return;

    const newPlugin = await BackendAPI.scaffoldPlugin(pluginName, targetDir);
    registerCustomPlugins([newPlugin]);
    void notify(`Plugin '${pluginName}' を作成しました:\n${newPlugin.folder_path}`);
  } catch (err) {
    console.error('Failed to scaffold plugin:', err);
    void notify(`プラグイン雛形の生成に失敗しました。\nエラー詳細: ${String(err)}`);
  }
}
