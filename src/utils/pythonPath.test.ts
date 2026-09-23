import { describe, it, expect } from 'vitest';
import { resolvePythonPath } from './pythonPath';
import { makePlugin } from '../test/fixtures';
import type { PluginSetting } from '../types/store';

const setting = (id: string, pythonOverridePath?: string): PluginSetting => ({
  id,
  enabled: true,
  order: 0,
  isBuiltin: false,
  pythonOverridePath,
});

describe('resolvePythonPath', () => {
  const plugin = makePlugin('p');

  it('prefers the per-plugin override', () => {
    expect(resolvePythonPath(plugin, [setting('p', ' /venv/bin/python ')], '/usr/bin/python3')).toBe(
      '/venv/bin/python',
    );
  });

  it('falls back to the global interpreter when the override is blank', () => {
    expect(resolvePythonPath(plugin, [setting('p', '  ')], ' /usr/local/bin/python3 ')).toBe('/usr/local/bin/python3');
  });

  it('falls back to python3 when nothing is configured', () => {
    expect(resolvePythonPath(plugin, [], '')).toBe('python3');
    expect(resolvePythonPath(plugin, [], undefined)).toBe('python3');
  });

  it('applies overrides to shared Python libraries too', () => {
    const lib = makePlugin('lib', { type: 'python_library' });
    expect(resolvePythonPath(lib, [setting('lib', '/venv/bin/python')], 'python3')).toBe('/venv/bin/python');
  });

  it('ignores overrides for non-Python plugins', () => {
    const wasm = makePlugin('w', { type: 'wasm' });
    expect(resolvePythonPath(wasm, [setting('w', '/venv/bin/python')], '/usr/bin/python3')).toBe('/usr/bin/python3');
  });
});
