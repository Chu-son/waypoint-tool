import type { PluginInstance, PluginSetting } from '../types/store';

export const DEFAULT_PYTHON = 'python3';

/**
 * The Python interpreter to run `plugin` with: its per-plugin override (Python plugins and
 * shared Python libraries only), otherwise the global interpreter, otherwise `python3`.
 */
export function resolvePythonPath(
  plugin: Pick<PluginInstance, 'id' | 'manifest'>,
  pluginSettings: PluginSetting[],
  globalPythonPath: string | null | undefined,
): string {
  const usesPython = plugin.manifest.type === 'python' || plugin.manifest.type === 'python_library';
  const override = usesPython ? pluginSettings.find((s) => s.id === plugin.id)?.pythonOverridePath?.trim() : undefined;
  return override || globalPythonPath?.trim() || DEFAULT_PYTHON;
}
