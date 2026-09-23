import { describe, it, expect } from 'vitest';
import { dedupePluginsById, mergeCustomPlugins, toPathList } from './pluginRegistry';
import { makePlugin } from '../test/fixtures';
import type { PluginSetting } from '../types/store';

const setting = (id: string, order: number, path?: string): PluginSetting => ({
  id,
  enabled: true,
  order,
  isBuiltin: false,
  path,
});

describe('mergeCustomPlugins', () => {
  it('appends new plugins as enabled settings after the existing ones', () => {
    const existing = makePlugin('a');
    const added = { ...makePlugin('b'), folder_path: '/plugins/b' };

    const result = mergeCustomPlugins({ a: existing }, [setting('a', 0)], [added]);

    expect(result.plugins).toEqual({ a: existing, b: added });
    expect(result.settings).toEqual([
      setting('a', 0),
      { id: 'b', path: '/plugins/b', enabled: true, order: 1, isBuiltin: false },
    ]);
  });

  it('re-points an already registered plugin to its new folder, keeping its other settings', () => {
    const moved = { ...makePlugin('a'), folder_path: '/new/a' };
    const result = mergeCustomPlugins({}, [{ ...setting('a', 3, '/old/a'), enabled: false }], [moved]);

    expect(result.settings).toEqual([{ id: 'a', path: '/new/a', enabled: false, order: 3, isBuiltin: false }]);
  });
});

describe('dedupePluginsById', () => {
  it('keeps the first occurrence of each id', () => {
    const first = { ...makePlugin('a'), folder_path: '/1' };
    const second = { ...makePlugin('a'), folder_path: '/2' };
    expect(dedupePluginsById([first, makePlugin('b'), second]).map((p) => p.folder_path)).toEqual(['/1', '/plugins/b']);
  });
});

describe('toPathList', () => {
  it.each([
    ['/a', ['/a']],
    [
      ['/a', { path: '/b' }, null],
      ['/a', '/b'],
    ],
    [null, []],
    [{ path: '/c' }, ['/c']],
  ])('%j → %j', (input, expected) => {
    expect(toPathList(input)).toEqual(expected);
  });
});
