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
    expect(STORAGE_VERSION).toBe(1);
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

  it('fills missing default properties when partial state is provided', () => {
    const partialState = {
      lastDirectory: '/home/user/maps',
      enableSnapping: false,
    };
    const migrated = migrateStorage(partialState, 1);
    expect(migrated.lastDirectory).toBe('/home/user/maps');
    expect(migrated.enableSnapping).toBe(false);
    expect(migrated.defaultMapOpacity).toBe(DEFAULT_MAP_OPACITY);
    expect(migrated.defaultExportFormats).toEqual(DEFAULT_EXPORT_FORMATS);
    expect(migrated.recentProjects).toEqual([]);
    expect(migrated.pluginSettings).toEqual({});
  });

  it('safely guards non-array values for array properties', () => {
    const corruptState = {
      recentProjects: 'not an array',
      exportTemplates: 123,
      defaultExportFormats: null,
      pluginSettings: 'invalid string',
    };
    const migrated = migrateStorage(corruptState, 1);
    expect(Array.isArray(migrated.recentProjects)).toBe(true);
    expect(Array.isArray(migrated.exportTemplates)).toBe(true);
    expect(Array.isArray(migrated.defaultExportFormats)).toBe(true);
    expect(migrated.pluginSettings).toEqual({});
  });
});
