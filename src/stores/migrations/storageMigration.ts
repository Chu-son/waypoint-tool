import { DEFAULT_EXPORT_FORMATS, DEFAULT_MAP_OPACITY } from './projectMigration';
import { DefaultExportFormat, PluginSetting } from '../../types/store';
import { VALID_DARK_THEME_PRESET_IDS } from '../../utils/themePresets';
import type { DockLayout } from '../../types/ui';
import { createDefaultDockLayout, dockLayoutFromLegacy, normalizeDockLayout } from '../../utils/dockLayout';

export const STORAGE_VERSION = 4;

/** Settings keys written before the dock layout existed; they are read once to derive `dockLayout`. */
const PRE_DOCK_KEYS = [
  'panelLayout',
  'leftPanelActiveTab',
  'rightPanelActiveTab',
  'leftPanelWidth',
  'rightPanelWidth',
  'leftPanelViewMode',
  'rightPanelViewMode',
] as const;

export interface PersistedStorageState {
  defaultMapOpacity?: number;
  lastDirectory?: string | null;
  recentProjects?: any[];
  enableSnapping?: boolean;
  exportTemplates?: any[];
  defaultExportFormats?: DefaultExportFormat[];
  indexStartIndex?: 0 | 1;
  exportIntegersAsFloat?: boolean;
  showPaths?: boolean;
  showGrid?: boolean;
  showFootprints?: boolean;
  pluginSettings?: PluginSetting[];
  globalPythonPath?: string | null;
  decimalPrecision?: number;
  enableBlendCache?: boolean;
  themeMode?: 'dark' | 'light';
  themePreset?: string;
  showProperties?: boolean;
  mapEditFillValue?: number;
  mapEditBrushSize?: number;
  mapEditSubTool?: string;
  dockLayout?: DockLayout;
  autoFocusInspector?: boolean;
  [key: string]: any;
}

export const DEFAULT_STORAGE_STATE: PersistedStorageState = {
  defaultMapOpacity: DEFAULT_MAP_OPACITY,
  lastDirectory: null,
  recentProjects: [],
  enableSnapping: true,
  exportTemplates: [],
  defaultExportFormats: DEFAULT_EXPORT_FORMATS,
  indexStartIndex: 0,
  exportIntegersAsFloat: true,
  showPaths: true,
  showGrid: true,
  showFootprints: true,
  pluginSettings: [],
  globalPythonPath: null,
  decimalPrecision: 6,
  enableBlendCache: true,
  themeMode: 'light',
  themePreset: 'default',
  showProperties: true,
  mapEditFillValue: 0,
  mapEditBrushSize: 10,
  mapEditSubTool: 'brush',
  dockLayout: createDefaultDockLayout(),
  autoFocusInspector: true,
};

/**
 * Zustand persist の migrate コールバック関数。
 * 過去バージョンや欠落プロパティを含むストレージ状態を最新スキーマへと正規化・補完します。
 */
export function migrateStorage(persistedState: unknown, version: number): PersistedStorageState {
  if (!persistedState || typeof persistedState !== 'object' || Array.isArray(persistedState)) {
    return { ...DEFAULT_STORAGE_STATE };
  }

  let state: Record<string, any> = { ...persistedState };

  // v0 (バージョン未定義、または 0) から v1 へのマイグレーション
  if (version < 1) {
    // 1. defaultExportFormats が文字列配列（旧仕様）の場合はオブジェクト配列へ昇格
    if (Array.isArray(state.defaultExportFormats)) {
      state.defaultExportFormats = state.defaultExportFormats.map((f: any) => {
        if (typeof f === 'string') {
          const ext = f.toLowerCase().replace(/^\./, '');
          return {
            id: `__default_${ext}__`,
            name: `${ext.toUpperCase()} Document`,
            extension: ext,
            suffix: `_${ext}`,
            enabled: true,
          };
        }
        return f;
      });
    }

    // 2. indexStartIndex の 0 | 1 制約正規化
    if (state.indexStartIndex !== undefined) {
      state.indexStartIndex = state.indexStartIndex === 1 ? 1 : 0;
    }

    // 3. decimalPrecision の数値・正整数正規化
    if (typeof state.decimalPrecision === 'number') {
      state.decimalPrecision = Math.max(0, Math.floor(state.decimalPrecision));
    }
  }

  // v2 へのマイグレーション: 過去に pluginSettings が非配列（オブジェクト {} 等）に汚染された場合の自己修復
  if (version < 2 || !Array.isArray(state.pluginSettings)) {
    if (!Array.isArray(state.pluginSettings)) {
      state.pluginSettings = [];
    }
  }

  // v4 へのマイグレーション: パネルレイアウトを dockLayout に置き換える。
  // dockLayout があればそれを正とし、なければ旧キーから導出する。
  // 旧キーは状態に持ち込まない。dev / AppImage / Docker が同じ設定ファイルを共有するため、旧ビルドが読む旧キーは
  // 設定ファイル側にそのまま残る (settingsStorage が、このビルドで永続化しないキーを書き戻す)。
  const dockLayout =
    state.dockLayout !== undefined
      ? normalizeDockLayout(state.dockLayout)
      : dockLayoutFromLegacy(state.panelLayout, {
          leftActiveTab: state.leftPanelActiveTab,
          rightActiveTab: state.rightPanelActiveTab,
          leftWidth: state.leftPanelWidth,
          rightWidth: state.rightPanelWidth,
        });
  for (const key of PRE_DOCK_KEYS) delete state[key];

  // 欠落プロパティのデフォルト値補完（浅いマージ + 安全なフォールバック）
  return {
    ...DEFAULT_STORAGE_STATE,
    ...state,
    dockLayout,
    autoFocusInspector: state.autoFocusInspector !== false,
    // 参照型や特定型の確実なガード
    recentProjects: Array.isArray(state.recentProjects) ? state.recentProjects : DEFAULT_STORAGE_STATE.recentProjects,
    exportTemplates: Array.isArray(state.exportTemplates)
      ? state.exportTemplates
      : DEFAULT_STORAGE_STATE.exportTemplates,
    defaultExportFormats: Array.isArray(state.defaultExportFormats)
      ? state.defaultExportFormats
      : DEFAULT_STORAGE_STATE.defaultExportFormats,
    pluginSettings: Array.isArray(state.pluginSettings) ? state.pluginSettings : DEFAULT_STORAGE_STATE.pluginSettings,
    indexStartIndex: state.indexStartIndex === 1 ? 1 : 0,
    exportIntegersAsFloat: state.exportIntegersAsFloat !== false,
    enableBlendCache: state.enableBlendCache !== false,
    decimalPrecision: typeof state.decimalPrecision === 'number' ? Math.max(0, Math.floor(state.decimalPrecision)) : 6,
    themeMode: state.themeMode === 'dark' ? 'dark' : 'light',
    themePreset: (() => {
      if (state.themePreset === 'roomba') return 'emerald';
      if (state.themePreset === 'dark') return 'default';
      if (typeof state.themePreset === 'string' && VALID_DARK_THEME_PRESET_IDS.includes(state.themePreset)) {
        return state.themePreset;
      }
      return 'default';
    })(),
    defaultMapOpacity: typeof state.defaultMapOpacity === 'number' ? state.defaultMapOpacity : DEFAULT_MAP_OPACITY,
  };
}
