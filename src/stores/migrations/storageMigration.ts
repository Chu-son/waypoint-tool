import { DEFAULT_EXPORT_FORMATS, DEFAULT_MAP_OPACITY } from './projectMigration';
import { DefaultExportFormat, PluginSetting } from '../../types/store';
import { VALID_DARK_THEME_PRESET_IDS } from '../../utils/themePresets';

export const STORAGE_VERSION = 3;

export interface PanelLayout {
  leftTabs: string[];
  rightTabs: string[];
}

export const DEFAULT_PANEL_LAYOUT: PanelLayout = {
  leftTabs: ['waypoints', 'annotations', 'plugins'],
  rightTabs: ['layers', 'inspector'],
};

export const ALL_BUILTIN_PANEL_TAB_IDS = ['waypoints', 'annotations', 'plugins', 'layers', 'inspector'] as const;

export interface PersistedStorageState {
  defaultMapOpacity?: number;
  lastDirectory?: string | null;
  recentProjects?: any[];
  enableSnapping?: boolean;
  exportTemplates?: any[];
  defaultExportFormats?: DefaultExportFormat[];
  indexStartIndex?: 0 | 1;
  showPaths?: boolean;
  showGrid?: boolean;
  showFootprints?: boolean;
  pluginSettings?: PluginSetting[];
  globalPythonPath?: string | null;
  decimalPrecision?: number;
  themeMode?: 'dark' | 'light';
  themePreset?: string;
  leftPanelViewMode?: 'tabs' | 'split';
  rightPanelViewMode?: 'tabs' | 'split';
  leftPanelWidth?: number;
  rightPanelWidth?: number;
  showProperties?: boolean;
  mapEditFillValue?: number;
  mapEditBrushSize?: number;
  mapEditSubTool?: string;
  panelLayout?: PanelLayout;
  leftPanelActiveTab?: string;
  rightPanelActiveTab?: string;
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
  showPaths: true,
  showGrid: true,
  showFootprints: true,
  pluginSettings: [],
  globalPythonPath: null,
  decimalPrecision: 6,
  themeMode: 'light',
  themePreset: 'default',
  leftPanelViewMode: 'tabs',
  rightPanelViewMode: 'tabs',
  leftPanelWidth: 320,
  rightPanelWidth: 320,
  showProperties: true,
  mapEditFillValue: 0,
  mapEditBrushSize: 10,
  mapEditSubTool: 'brush',
  panelLayout: DEFAULT_PANEL_LAYOUT,
  leftPanelActiveTab: 'waypoints',
  rightPanelActiveTab: 'layers',
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

  // v3 へのマイグレーション: パネルレイアウト (panelLayout) とアクティブタブの導入・正規化
  const normalizedPanelLayout = normalizePanelLayout(state.panelLayout);
  state.panelLayout = normalizedPanelLayout;

  // アクティブタブの安全な正規化
  let leftTab = typeof state.leftPanelActiveTab === 'string' ? state.leftPanelActiveTab : 'waypoints';
  if (leftTab === 'project') {
    leftTab = 'waypoints';
  }
  if (!normalizedPanelLayout.leftTabs.includes(leftTab) && normalizedPanelLayout.leftTabs.length > 0) {
    leftTab = normalizedPanelLayout.leftTabs[0];
  }
  state.leftPanelActiveTab = leftTab;

  let rightTab = typeof state.rightPanelActiveTab === 'string' ? state.rightPanelActiveTab : 'layers';
  if (rightTab === 'project') {
    rightTab = 'layers';
  }
  if (!normalizedPanelLayout.rightTabs.includes(rightTab) && normalizedPanelLayout.rightTabs.length > 0) {
    rightTab = normalizedPanelLayout.rightTabs[0];
  }
  state.rightPanelActiveTab = rightTab;

  // 欠落プロパティのデフォルト値補完（浅いマージ + 安全なフォールバック）
  return {
    ...DEFAULT_STORAGE_STATE,
    ...state,
    panelLayout: normalizedPanelLayout,
    leftPanelActiveTab: leftTab,
    rightPanelActiveTab: rightTab,
    // 参照型や特定型の確実なガード
    recentProjects: Array.isArray(state.recentProjects) ? state.recentProjects : DEFAULT_STORAGE_STATE.recentProjects,
    exportTemplates: Array.isArray(state.exportTemplates) ? state.exportTemplates : DEFAULT_STORAGE_STATE.exportTemplates,
    defaultExportFormats: Array.isArray(state.defaultExportFormats) ? state.defaultExportFormats : DEFAULT_STORAGE_STATE.defaultExportFormats,
    pluginSettings: Array.isArray(state.pluginSettings) ? state.pluginSettings : DEFAULT_STORAGE_STATE.pluginSettings,
    indexStartIndex: state.indexStartIndex === 1 ? 1 : 0,
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

/**
 * 任意の入力から PanelLayout を安全に正規化します。
 * 旧 'project' タブの 'waypoints' + 'annotations' 展開や重複排除、必須ビルトインタブの欠落補完を行います。
 */
export function normalizePanelLayout(rawLayout: any): PanelLayout {
  if (!rawLayout || typeof rawLayout !== 'object') {
    return {
      leftTabs: [...DEFAULT_PANEL_LAYOUT.leftTabs],
      rightTabs: [...DEFAULT_PANEL_LAYOUT.rightTabs],
    };
  }

  const expandAndFilter = (tabs: any[]): string[] => {
    if (!Array.isArray(tabs)) return [];
    const result: string[] = [];
    for (const t of tabs) {
      if (typeof t !== 'string') continue;
      if (t === 'project') {
        if (!result.includes('waypoints')) result.push('waypoints');
        if (!result.includes('annotations')) result.push('annotations');
      } else {
        if (!result.includes(t)) result.push(t);
      }
    }
    return result;
  };

  let leftTabs = expandAndFilter(rawLayout.leftTabs);
  let rightTabs = expandAndFilter(rawLayout.rightTabs);

  // 左右での重複排除（先に登場した方を優先）
  const seen = new Set<string>();
  leftTabs = leftTabs.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  rightTabs = rightTabs.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // 必須ビルトインタブが左右どちらにも存在しない場合の補完
  for (const tabId of ALL_BUILTIN_PANEL_TAB_IDS) {
    if (!seen.has(tabId)) {
      if (DEFAULT_PANEL_LAYOUT.leftTabs.includes(tabId)) {
        leftTabs.push(tabId);
      } else {
        rightTabs.push(tabId);
      }
      seen.add(tabId);
    }
  }

  return { leftTabs, rightTabs };
}

