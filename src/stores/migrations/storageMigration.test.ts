import { describe, it, expect } from 'vitest';
import { migrateStorage, DEFAULT_STORAGE_STATE, STORAGE_VERSION } from './storageMigration';
import { DEFAULT_EXPORT_FORMATS, DEFAULT_MAP_OPACITY } from './projectMigration';

describe('storageMigration', () => {
  it('handles empty / null / undefined / non-object inputs safely', () => {
    expect(migrateStorage(null, 0)).toEqual(DEFAULT_STORAGE_STATE);
    expect(migrateStorage(undefined, 0)).toEqual(DEFAULT_STORAGE_STATE);
    expect(migrateStorage('corrupt', 0)).toEqual(DEFAULT_STORAGE_STATE);
    expect(migrateStorage(12345, 0)).toEqual(DEFAULT_STORAGE_STATE);
    expect(STORAGE_VERSION).toBe(4);
    expect(DEFAULT_STORAGE_STATE.pluginSettings).toEqual([]);
    expect(DEFAULT_STORAGE_STATE.panelLayout).toEqual({
      leftTabs: ['waypoints', 'annotations', 'plugins'],
      rightTabs: ['layers', 'inspector'],
    });
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

  it('writes integers as floats unless the stored setting is explicitly off', () => {
    expect(migrateStorage({}, 0).exportIntegersAsFloat).toBe(true);
    expect(migrateStorage({}, 3).exportIntegersAsFloat).toBe(true);
    expect(migrateStorage({ exportIntegersAsFloat: true }, 3).exportIntegersAsFloat).toBe(true);
    expect(migrateStorage({ exportIntegersAsFloat: false }, 3).exportIntegersAsFloat).toBe(false);
    expect(migrateStorage({ exportIntegersAsFloat: 'nope' }, 3).exportIntegersAsFloat).toBe(true);
  });

  it('keeps the blend preview cache on unless the stored setting is explicitly off', () => {
    expect(migrateStorage({}, 0).enableBlendCache).toBe(true);
    expect(migrateStorage({}, 3).enableBlendCache).toBe(true);
    expect(migrateStorage({ enableBlendCache: true }, 3).enableBlendCache).toBe(true);
    expect(migrateStorage({ enableBlendCache: false }, 3).enableBlendCache).toBe(false);
    expect(migrateStorage({ enableBlendCache: 'nope' }, 3).enableBlendCache).toBe(true);
  });

  it('normalizes themeMode to dark or light correctly', () => {
    expect(migrateStorage({ themeMode: 'light' }, 2).themeMode).toBe('light');
    expect(migrateStorage({ themeMode: 'dark' }, 2).themeMode).toBe('dark');
    expect(migrateStorage({ themeMode: 'unknown' }, 2).themeMode).toBe('light');
    expect(migrateStorage({}, 2).themeMode).toBe('light');
  });

  it('normalizes and preserves themePreset correctly', () => {
    expect(DEFAULT_STORAGE_STATE.themePreset).toBe('default');
    expect(migrateStorage({ themePreset: 'emerald' }, 2).themePreset).toBe('emerald');
    expect(migrateStorage({ themePreset: 'ocean' }, 2).themePreset).toBe('ocean');
    expect(migrateStorage({ themePreset: 'roomba' }, 2).themePreset).toBe('emerald');
    expect(migrateStorage({ themePreset: 'dark' }, 2).themePreset).toBe('default');
    expect(migrateStorage({ themePreset: 'invalid_xyz' }, 2).themePreset).toBe('default');
    expect(migrateStorage({ themePreset: '' }, 2).themePreset).toBe('default');
    expect(migrateStorage({ themePreset: null as any }, 2).themePreset).toBe('default');
    expect(migrateStorage({}, 2).themePreset).toBe('default');
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

  it('migrates v2 state to v3 with panelLayout normalization and project tab expansion', () => {
    const v2StateWithProject = {
      panelLayout: {
        leftTabs: ['project', 'plugins'],
        rightTabs: ['layers', 'inspector'],
      },
      leftPanelActiveTab: 'project',
      rightPanelActiveTab: 'inspector',
    };
    const migrated = migrateStorage(v2StateWithProject, 2);
    expect(migrated.panelLayout).toEqual({
      leftTabs: ['waypoints', 'annotations', 'plugins'],
      rightTabs: ['layers', 'inspector'],
    });
    expect(migrated.leftPanelActiveTab).toBe('waypoints');
    expect(migrated.rightPanelActiveTab).toBe('inspector');
  });

  it('ensures missing builtin tabs are supplemented in panelLayout', () => {
    const partialLayoutState = {
      panelLayout: {
        leftTabs: ['waypoints'],
        rightTabs: ['inspector'],
      },
    };
    const migrated = migrateStorage(partialLayoutState, 2);
    expect(migrated.panelLayout).toBeDefined();
    expect(migrated.panelLayout!.leftTabs).toContain('waypoints');
    expect(migrated.panelLayout!.leftTabs).toContain('annotations');
    expect(migrated.panelLayout!.leftTabs).toContain('plugins');
    expect(migrated.panelLayout!.rightTabs).toContain('inspector');
    expect(migrated.panelLayout!.rightTabs).toContain('layers');
  });

  describe('dockLayout (v4)', () => {
    it('derives the dock layout from the pre-dock settings, keeping tabs, active tabs and widths', () => {
      const migrated = migrateStorage(
        {
          panelLayout: { leftTabs: ['waypoints', 'annotations', 'plugins'], rightTabs: ['inspector', 'layers'] },
          leftPanelActiveTab: 'annotations',
          rightPanelActiveTab: 'layers',
          leftPanelWidth: 400,
          rightPanelWidth: 350,
        },
        3,
      );
      expect(migrated.dockLayout!.left.groups[0]).toMatchObject({ activeTab: 'annotations', width: 400 });
      expect(migrated.dockLayout!.right.groups[0]).toMatchObject({
        tabs: ['inspector', 'layers'],
        activeTab: 'layers',
        width: 350,
      });
      expect(migrated.dockLayout!.right.groups[1].tabs).toEqual([]);
    });

    it('leaves the pre-dock keys as they were, so an older build sharing the file keeps working', () => {
      const old = {
        panelLayout: { leftTabs: ['waypoints', 'annotations', 'plugins'], rightTabs: ['layers', 'inspector'] },
        leftPanelActiveTab: 'plugins',
        rightPanelActiveTab: 'inspector',
        leftPanelWidth: 300,
        rightPanelWidth: 330,
      };
      const migrated = migrateStorage(old, 3);
      expect(migrated).toMatchObject(old);
    });

    it('trusts a saved dock layout over the pre-dock keys that an older build may have rewritten since', () => {
      const dockLayout = migrateStorage({}, 3).dockLayout!;
      dockLayout.right.groups[1] = { tabs: ['inspector'], activeTab: 'inspector', visible: true, width: 300 };
      dockLayout.right.groups[0].tabs = ['layers'];
      const migrated = migrateStorage(
        { dockLayout, panelLayout: { leftTabs: [], rightTabs: ['layers', 'inspector'] } },
        4,
      );
      expect(migrated.dockLayout!.right.groups[1].tabs).toEqual(['inspector']);
      expect(migrated.dockLayout!.right.groups[0].tabs).toEqual(['layers']);
    });

    it('repairs a broken saved dock layout and is idempotent', () => {
      const once = migrateStorage({ dockLayout: { left: { groups: [{ tabs: ['ghost'] }] } } }, 4);
      expect(once.dockLayout!.left.groups[0].tabs).toEqual(['waypoints', 'annotations', 'plugins']);
      expect(migrateStorage(once, 4)).toEqual(once);
    });
  });
});
