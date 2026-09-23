import type { PluginInstance, PluginSetting } from '../types/store';

/** Keep the first plugin for each id. */
export function dedupePluginsById(plugins: PluginInstance[]): PluginInstance[] {
  const seen = new Set<string>();
  return plugins.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

/**
 * Register custom (user folder) plugins: add or replace them in the plugin map and point their
 * settings at the folder. New plugins are appended enabled, after the existing ones.
 */
export function mergeCustomPlugins(
  plugins: Record<string, PluginInstance>,
  settings: PluginSetting[],
  added: PluginInstance[],
): { plugins: Record<string, PluginInstance>; settings: PluginSetting[] } {
  const nextPlugins = { ...plugins };
  const nextSettings = [...settings];
  for (const plugin of added) {
    nextPlugins[plugin.id] = plugin;
    const index = nextSettings.findIndex((s) => s.id === plugin.id);
    if (index >= 0) {
      nextSettings[index] = { ...nextSettings[index], path: plugin.folder_path };
    } else {
      nextSettings.push({
        id: plugin.id,
        path: plugin.folder_path,
        enabled: true,
        order: nextSettings.length,
        isBuiltin: false,
      });
    }
  }
  return { plugins: nextPlugins, settings: nextSettings };
}

/** Normalise a file-dialog result (path, list of paths, or `{ path }` objects) to a list of paths. */
export function toPathList(selected: unknown): string[] {
  const items = Array.isArray(selected) ? selected : [selected];
  return items
    .map((item) => (typeof item === 'string' ? item : (item as { path?: string } | null)?.path))
    .filter((p): p is string => !!p);
}
