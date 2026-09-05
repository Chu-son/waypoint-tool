import { AppState } from '../stores/appStore';
import { getFlattenedWaypointIds } from './treeUtils';
import { WaypointNode } from '../types/store';

export type StatusModeVariant = 'default' | 'primary' | 'reference' | 'obstacle' | 'anchor' | 'generator';
export type StatusIconType = 'select' | 'waypoint' | 'annotation' | 'layer' | 'generator' | 'plugin' | 'copy' | 'region' | 'modal';

export interface StatusInteractionInfo {
  modeBadgeText: string;
  modeIcon: StatusIconType;
  modeVariant: StatusModeVariant;
  escActionLabel: string | null;
  escTier: number;
  hintText?: string;
}

/**
 * 状態機械の階層（Tier 1〜Tier 7）を評価し、現在のステータス情報およびEscキーによる遷移先を導出する。
 */
export function computeStatusInteraction(state: Pick<
  AppState,
  | 'modalStack'
  | 'isSettingsModalOpen'
  | 'isExportModalOpen'
  | 'isImportModalOpen'
  | 'isExportMapsModalOpen'
  | 'isShortcutsModalOpen'
  | 'isWelcomeModalOpen'
  | 'isInitialLaunch'
  | 'pluginDataModalState'
  | 'appMode'
  | 'selection'
  | 'nodes'
  | 'customLayers'
>): StatusInteractionInfo {
  // Tier 1: Modal Stack
  const isModalActuallyOpen = (modal: string): boolean => {
    switch (modal) {
      case 'settings': return !!state.isSettingsModalOpen;
      case 'export': return !!state.isExportModalOpen;
      case 'import': return !!state.isImportModalOpen;
      case 'export_maps': return !!state.isExportMapsModalOpen;
      case 'shortcuts': return !!state.isShortcutsModalOpen;
      case 'welcome': return !!state.isWelcomeModalOpen;
      case 'plugin_data': return !!state.pluginDataModalState?.isOpen;
      default: return false;
    }
  };

  const activeStack = (state.modalStack || []).filter(isModalActuallyOpen);
  const topModal = activeStack.length > 0 ? activeStack[activeStack.length - 1] : (
    state.isSettingsModalOpen ? 'settings' :
    state.isExportModalOpen ? 'export' :
    state.isImportModalOpen ? 'import' :
    state.isExportMapsModalOpen ? 'export_maps' :
    state.isShortcutsModalOpen ? 'shortcuts' :
    state.isWelcomeModalOpen ? 'welcome' :
    state.pluginDataModalState?.isOpen ? 'plugin_data' : null
  );

  if (topModal) {
    const modalNames: Record<string, string> = {
      settings: '設定',
      export: 'エクスポート',
      import: 'インポート',
      export_maps: 'マップエクスポート',
      shortcuts: 'ショートカット一覧',
      welcome: 'Welcome',
      plugin_data: 'プラグインデータ',
    };
    const isProtectedWelcome = topModal === 'welcome' && state.isInitialLaunch;
    return {
      modeBadgeText: `モーダル: ${modalNames[topModal] || topModal}`,
      modeIcon: 'modal',
      modeVariant: 'default',
      escActionLabel: isProtectedWelcome ? null : '閉じる',
      escTier: 1,
      hintText: isProtectedWelcome ? 'プロジェクトを作成または読込してください' : 'ダイアログ表示中',
    };
  }

  // Tier 4: Waypoint Add mode snap input or active constraint
  const modeState = state.appMode;
  if (modeState?.mode === 'waypoint_add') {
    if (modeState.snapInput) {
      return {
        modeBadgeText: `精密距離入力: ${modeState.snapInput}`,
        modeIcon: 'waypoint',
        modeVariant: 'primary',
        escActionLabel: '数値をクリア',
        escTier: 4,
        hintText: 'Enterで確定 / Escでクリア',
      };
    }
    if (
      modeState.forcedAxis !== null ||
      modeState.forcedSign !== null ||
      modeState.lockedWaypointId !== null
    ) {
      const axisText = modeState.forcedAxis ? `${modeState.forcedAxis}軸固定` : 'スナップロック';
      return {
        modeBadgeText: `ウェイポイント追加 (${axisText})`,
        modeIcon: 'waypoint',
        modeVariant: 'primary',
        escActionLabel: '拘束を解除',
        escTier: 4,
        hintText: 'クリック/ドラッグで配置',
      };
    }
    return {
      modeBadgeText: 'ウェイポイント追加',
      modeIcon: 'waypoint',
      modeVariant: 'primary',
      escActionLabel: '選択モードへ復帰',
      escTier: 6,
      hintText: 'クリック/ドラッグで配置 (0-9で精密入力)',
    };
  }

  // Tier 5: Mutually Exclusive Selection
  const currentSelection = state.selection;
  if (currentSelection?.type === 'nodes' && currentSelection.ids.length > 0) {
    const count = currentSelection.ids.length;
    let name = '';
    if (count === 1) {
      const n = state.nodes?.[currentSelection.ids[0]];
      name = n ? ` "${n.name}"` : '';
    }
    return {
      modeBadgeText: count === 1 ? `ノード選択中${name}` : `${count} ノード選択中`,
      modeIcon: 'select',
      modeVariant: 'default',
      escActionLabel: '選択を解除',
      escTier: 5,
      hintText: 'ドラッグで移動 / Deleteで削除',
    };
  }

  if (currentSelection?.type === 'annotations' && currentSelection.ids.length > 0) {
    const count = currentSelection.ids.length;
    return {
      modeBadgeText: count === 1 ? 'アノテーション選択中' : `${count} アノテーション選択中`,
      modeIcon: 'annotation',
      modeVariant: 'reference',
      escActionLabel: '選択を解除',
      escTier: 5,
      hintText: 'Inspectorでプロパティ編集',
    };
  }

  if (currentSelection?.type === 'custom_layer') {
    const layer = state.customLayers?.find(l => l.id === currentSelection.layerId);
    return {
      modeBadgeText: `レイヤー選択: ${layer?.name || 'Custom Layer'}`,
      modeIcon: 'layer',
      modeVariant: 'obstacle',
      escActionLabel: '選択を解除',
      escTier: 5,
      hintText: 'レイヤー設定編集中',
    };
  }

  // Tier 6: Non-select Mode Transition
  if (modeState?.mode === 'generator_add') {
    return {
      modeBadgeText: 'ジェネレータ配置中',
      modeIcon: 'generator',
      modeVariant: 'generator',
      escActionLabel: '選択モードへ復帰',
      escTier: 6,
      hintText: 'クリックで配置起点を決定',
    };
  }

  if (modeState?.mode === 'annotation_edit') {
    const subTools: Record<string, string> = {
      point: 'ポイント',
      oriented_point: '方向付きポイント',
      line: 'ライン',
      rect: '矩形',
      circle: '円',
      select: '選択',
    };
    const toolName = subTools[modeState.subTool] || modeState.subTool;
    return {
      modeBadgeText: `アノテーション編集 (${toolName})`,
      modeIcon: 'annotation',
      modeVariant: 'reference',
      escActionLabel: '選択モードへ復帰',
      escTier: 6,
      hintText: 'ドラッグで図形を描画',
    };
  }

  if (modeState?.mode === 'custom_layer_edit') {
    return {
      modeBadgeText: 'マップ編集モード',
      modeIcon: 'layer',
      modeVariant: 'obstacle',
      escActionLabel: '選択モードへ復帰',
      escTier: 6,
      hintText: 'ドラッグでラスター描画',
    };
  }

  if (modeState?.mode === 'export_region_edit') {
    return {
      modeBadgeText: 'エクスポート領域編集',
      modeIcon: 'region',
      modeVariant: 'anchor',
      escActionLabel: '選択モードへ復帰',
      escTier: 6,
      hintText: 'ドラッグで領域を指定',
    };
  }

  if (modeState?.mode === 'plugin_interaction') {
    return {
      modeBadgeText: 'プラグイン対話待ち',
      modeIcon: 'plugin',
      modeVariant: 'generator',
      escActionLabel: '中断して選択へ復帰',
      escTier: 6,
      hintText: 'キャンバス上でパラメータを指定',
    };
  }

  if (modeState?.mode === 'element_paste') {
    const field = modeState.field?.toUpperCase() || '';
    return {
      modeBadgeText: `要素コピー中 (${field})`,
      modeIcon: 'copy',
      modeVariant: 'anchor',
      escActionLabel: 'コピー解除',
      escTier: 6,
      hintText: 'ノードをクリックして適用',
    };
  }

  // Tier 7: Idle
  return {
    modeBadgeText: '選択ツール',
    modeIcon: 'select',
    modeVariant: 'default',
    escActionLabel: null,
    escTier: 7,
    hintText: 'クリックで選択 / Shift+ドラッグで矩形選択',
  };
}

/**
 * ウェイポイント順序リストから全経路長（メートル）を計算する。
 */
export function computeTotalPathDistance(rootNodeIds: string[], nodes: Record<string, WaypointNode>): number {
  const waypointIds = getFlattenedWaypointIds(rootNodeIds || [], nodes || {});
  if (waypointIds.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < waypointIds.length - 1; i++) {
    const nodeA = nodes[waypointIds[i]];
    const nodeB = nodes[waypointIds[i + 1]];
    if (nodeA?.transform && nodeB?.transform) {
      const dx = (nodeB.transform.x ?? 0) - (nodeA.transform.x ?? 0);
      const dy = (nodeB.transform.y ?? 0) - (nodeA.transform.y ?? 0);
      totalDistance += Math.hypot(dx, dy);
    }
  }
  return totalDistance;
}
