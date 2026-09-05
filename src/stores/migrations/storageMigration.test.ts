import { describe, it, expect } from 'vitest';
import {
  migrateStorage,
  DEFAULT_STORAGE_STATE,
  STORAGE_VERSION,
} from './storageMigration';
import { DEFAULT_EXPORT_FORMATS, DEFAULT_MAP_OPACITY } from './projectMigration';

describe('storageMigration', () => {
  it('handles empty / null / undefined / non-object inputs safely', () => {
    expect(migrateStorage(null, 0)).toEqual(DEFAULT_STORAGE_STATE);
    expect(migrateStorage(undefined, 0)).toEqual(DEFAULT_STORAGE_STATE);
    expect(migrateStorage('corrupt', 0)).toEqual(DEFAULT_STORAGE_STATE);
    expect(migrateStorage(12345, 0)).toEqual(DEFAULT_STORAGE_STATE);
    expect(STORAGE_VERSION).toBe(2);
    expect(DEFAULT_STORAGE_STATE.pluginSettings).toEqual([]);
  });

  it('promotes defaultExportFormats string array to object array on v0 migration', () => {
    const v0State = {
      defaultExportFormats: ['.yaml', 'json'],
      defaultMapOpacity: 0.8,
    };
    const migrated = migrateStorage(v0State, 0);
    expect(migrated.defaultExportFormats).toEqual([
      {
        id: '__default_yaml__',
        name: 'YAML Document',
        extension: 'yaml',
        suffix: '_yaml',
        enabled: true,
      },
      {
        id: '__default_json__',
        name: 'JSON Document',
        extension: 'json',
        suffix: '_json',
        enabled: true,
      },
    ]);
    expect(migrated.defaultMapOpacity).toBe(0.8);
    expect(migrated.indexStartIndex).toBe(0);
    expect(migrated.decimalPrecision).toBe(6);
    expect(migrated.pluginSettings).toEqual([]);
  });

  it('normalizes indexStartIndex and decimalPrecision safely', () => {
    const v0State = {
      indexStartIndex: 1,
      decimalPrecision: 3.8,
    };
    const migrated = migrateStorage(v0State, 0);
    expect(migrated.indexStartIndex).toBe(1);
    expect(migrated.decimalPrecision).toBe(3);

    const corruptIndex = migrateStorage({ indexStartIndex: 5 }, 0);
    expect(corruptIndex.indexStartIndex).toBe(0);
  });

  it('normalizes themeMode to dark or light correctly', () => {
    expect(migrateStorage({ themeMode: 'light' }, 2).themeMode).toBe('light');
    expect(migrateStorage({ themeMode: 'dark' }, 2).themeMode).toBe('dark');
    expect(migrateStorage({ themeMode: 'unknown' }, 2).themeMode).toBe('dark');
    expect(migrateStorage({}, 2).themeMode).toBe('dark');
  });

  it('fills missing default properties when partial state is provided', () => {
    const partialState = {
      lastDirectory: '/home/user/maps',
      enableSnapping: false,
    };
    const migrated = migrateStorage(partialState, 2);
    expect(migrated.lastDirectory).toBe('/home/user/maps');
    expect(migrated.enableSnapping).toBe(false);
    expect(migrated.defaultMapOpacity).toBe(DEFAULT_MAP_OPACITY);
    expect(migrated.defaultExportFormats).toEqual(DEFAULT_EXPORT_FORMATS);
    expect(migrated.recentProjects).toEqual([]);
    expect(migrated.pluginSettings).toEqual([]);
  });

  it('safely guards non-array values for array properties and recovers corrupted pluginSettings', () => {
    const corruptState = {
      recentProjects: 'not an array',
      exportTemplates: 123,
      defaultExportFormats: null,
      pluginSettings: { corrupt: true }, // 過去にオブジェクトとして保存されてしまった不正状態
    };
    const migrated = migrateStorage(corruptState, 1);
    expect(Array.isArray(migrated.recentProjects)).toBe(true);
    expect(Array.isArray(migrated.exportTemplates)).toBe(true);
    expect(Array.isArray(migrated.defaultExportFormats)).toBe(true);
    expect(Array.isArray(migrated.pluginSettings)).toBe(true);
    expect(migrated.pluginSettings).toEqual([]);
  });

  it('preserves valid pluginSettings array on migration', () => {
    const validSettings = [
      { id: 'plugin-1', enabled: true, order: 0, isBuiltin: true },
      { id: 'plugin-2', enabled: false, order: 1, isBuiltin: false },
    ];
    const state = {
      pluginSettings: validSettings,
    };
    const migrated = migrateStorage(state, 2);
    expect(migrated.pluginSettings).toEqual(validSettings);
  });
});
