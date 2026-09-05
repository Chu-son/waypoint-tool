import { describe, it, expect } from 'vitest';
import { computeStatusInteraction, computeTotalPathDistance } from './statusUtils';
import { WaypointNode } from '../types/store';

describe('statusUtils', () => {
  const createBaseState = (): Parameters<typeof computeStatusInteraction>[0] => ({
    modalStack: [],
    isSettingsModalOpen: false,
    isExportModalOpen: false,
    isImportModalOpen: false,
    isExportMapsModalOpen: false,
    isShortcutsModalOpen: false,
    isWelcomeModalOpen: false,
    isInitialLaunch: false,
    pluginDataModalState: { isOpen: false, title: '', data: null },
    appMode: { mode: 'select' },
    selection: { type: 'none' },
    nodes: {},
    customLayers: [],
  });

  describe('computeStatusInteraction', () => {
    it('Tier 1: detects modal stack and top modal for dismissal', () => {
      const state = createBaseState();
      state.modalStack = ['settings'];
      state.isSettingsModalOpen = true;

      const res = computeStatusInteraction(state);
      expect(res.escTier).toBe(1);
      expect(res.modeBadgeText).toBe('モーダル: 設定');
      expect(res.escActionLabel).toBe('閉じる');
    });

    it('Tier 1: protects welcome modal during initial launch', () => {
      const state = createBaseState();
      state.modalStack = ['welcome'];
      state.isWelcomeModalOpen = true;
      state.isInitialLaunch = true;

      const res = computeStatusInteraction(state);
      expect(res.escTier).toBe(1);
      expect(res.modeBadgeText).toBe('モーダル: Welcome');
      expect(res.escActionLabel).toBeNull();
    });

    it('Tier 4: detects snapInput during waypoint_add', () => {
      const state = createBaseState();
      state.appMode = {
        mode: 'waypoint_add',
        snapInput: '2.5',
        lockedWaypointId: null,
        forcedAxis: null,
        forcedSign: null,
      };

      const res = computeStatusInteraction(state);
      expect(res.escTier).toBe(4);
      expect(res.modeBadgeText).toBe('精密距離入力: 2.5');
      expect(res.escActionLabel).toBe('数値をクリア');
    });

    it('Tier 4: detects forcedAxis constraint during waypoint_add', () => {
      const state = createBaseState();
      state.appMode = {
        mode: 'waypoint_add',
        snapInput: '',
        lockedWaypointId: null,
        forcedAxis: 'X',
        forcedSign: 1,
      };

      const res = computeStatusInteraction(state);
      expect(res.escTier).toBe(4);
      expect(res.modeBadgeText).toContain('X軸固定');
      expect(res.escActionLabel).toBe('拘束を解除');
    });

    it('Tier 5: detects single node selection with node name', () => {
      const state = createBaseState();
      state.selection = { type: 'nodes', ids: ['node-1'] };
      state.nodes = {
        'node-1': {
          id: 'node-1',
          name: 'wp_01',
          type: 'manual',
          transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
        },
      };

      const res = computeStatusInteraction(state);
      expect(res.escTier).toBe(5);
      expect(res.modeBadgeText).toBe('ノード選択中 "wp_01"');
      expect(res.escActionLabel).toBe('選択を解除');
    });

    it('Tier 5: detects multiple node selection', () => {
      const state = createBaseState();
      state.selection = { type: 'nodes', ids: ['node-1', 'node-2', 'node-3'] };

      const res = computeStatusInteraction(state);
      expect(res.escTier).toBe(5);
      expect(res.modeBadgeText).toBe('3 ノード選択中');
      expect(res.escActionLabel).toBe('選択を解除');
    });

    it('Tier 5: detects annotation selection', () => {
      const state = createBaseState();
      state.selection = { type: 'annotations', ids: ['annot-1'] };

      const res = computeStatusInteraction(state);
      expect(res.escTier).toBe(5);
      expect(res.modeBadgeText).toBe('アノテーション選択中');
      expect(res.escActionLabel).toBe('選択を解除');
    });

    it('Tier 6: detects waypoint_add mode (unconstrained)', () => {
      const state = createBaseState();
      state.appMode = {
        mode: 'waypoint_add',
        snapInput: '',
        lockedWaypointId: null,
        forcedAxis: null,
        forcedSign: null,
      };

      const res = computeStatusInteraction(state);
      expect(res.escTier).toBe(6);
      expect(res.modeBadgeText).toBe('ウェイポイント追加');
      expect(res.escActionLabel).toBe('選択モードへ復帰');
    });

    it('Tier 6: detects annotation_edit mode', () => {
      const state = createBaseState();
      state.appMode = {
        mode: 'annotation_edit',
        subTool: 'rect',
        targetGroupId: null,
      };

      const res = computeStatusInteraction(state);
      expect(res.escTier).toBe(6);
      expect(res.modeBadgeText).toBe('アノテーション編集 (矩形)');
      expect(res.escActionLabel).toBe('選択モードへ復帰');
    });

    it('Tier 6: detects custom_layer_edit mode', () => {
      const state = createBaseState();
      state.appMode = {
        mode: 'custom_layer_edit',
        targetLayerId: 'layer-1',
        subTool: 'rect',
        fillValue: 100,
        brushSize: 1,
      };

      const res = computeStatusInteraction(state);
      expect(res.escTier).toBe(6);
      expect(res.modeBadgeText).toBe('マップ編集モード');
      expect(res.escActionLabel).toBe('選択モードへ復帰');
    });

    it('Tier 6: detects element_paste mode', () => {
      const state = createBaseState();
      state.appMode = {
        mode: 'element_paste',
        field: 'x',
        value: 1.23,
        coordSystem: 'world',
        previewNodeId: null,
      };

      const res = computeStatusInteraction(state);
      expect(res.escTier).toBe(6);
      expect(res.modeBadgeText).toBe('要素コピー中 (X)');
      expect(res.escActionLabel).toBe('コピー解除');
    });

    it('Tier 7: returns idle status for clean select mode', () => {
      const state = createBaseState();
      const res = computeStatusInteraction(state);
      expect(res.escTier).toBe(7);
      expect(res.modeBadgeText).toBe('選択ツール');
      expect(res.escActionLabel).toBeNull();
    });
  });

  describe('computeTotalPathDistance', () => {
    it('returns 0 when 0 or 1 waypoint exists', () => {
      expect(computeTotalPathDistance([], {})).toBe(0);
      expect(
        computeTotalPathDistance(['wp1'], {
          wp1: { id: 'wp1', name: '1', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } },
        })
      ).toBe(0);
    });

    it('calculates total distance correctly for multiple waypoints', () => {
      const nodes: Record<string, WaypointNode> = {
        wp1: { id: 'wp1', name: '1', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } },
        wp2: { id: 'wp2', name: '2', type: 'manual', transform: { x: 3, y: 4, qx: 0, qy: 0, qz: 0, qw: 1 } }, // distance 5
        wp3: { id: 'wp3', name: '3', type: 'manual', transform: { x: 3, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } }, // distance 4
      };
      const rootNodeIds = ['wp1', 'wp2', 'wp3'];
      const total = computeTotalPathDistance(rootNodeIds, nodes);
      expect(total).toBeCloseTo(9, 3);
    });
  });
});
