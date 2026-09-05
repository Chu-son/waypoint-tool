import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../appStore';

describe('interactionSlice', () => {
  beforeEach(() => {
    useAppStore.getState().resetProject();
    useAppStore.setState({
      appMode: { mode: 'select' },
      selection: { type: 'none' },
      modalStack: [],
      isSettingsModalOpen: false,
      isExportModalOpen: false,
      isImportModalOpen: false,
      isExportMapsModalOpen: false,
      isShortcutsModalOpen: false,
      isWelcomeModalOpen: false,
      isInitialLaunch: false,
      rightPanelActiveTab: 'layers',
      elementCopyState: null,
      selectedNodeIds: [],
      selectedAnnotationIds: [],
      activeCustomLayerId: null,
      selectedEditObjectId: null,
    });
  });

  describe('Mode Transitions', () => {
    it('initializes in select mode', () => {
      const state = useAppStore.getState();
      expect(state.appMode).toEqual({ mode: 'select' });
      expect(state.selection).toEqual({ type: 'none' });
      expect(state.modalStack).toEqual([]);
    });

    it('transitions to waypoint_add mode and updates activeTool', () => {
      useAppStore.getState().transitionToMode({ mode: 'waypoint_add' });

      const state = useAppStore.getState();
      expect(state.appMode.mode).toBe('waypoint_add');
      expect(state.activeTool).toBe('add_point');
      if (state.appMode.mode === 'waypoint_add') {
        expect(state.appMode.snapInput).toBe('');
        expect(state.appMode.forcedAxis).toBeNull();
      }
    });

    it('transitions to generator_add mode and updates activePluginId and activeTool', () => {
      useAppStore.getState().transitionToMode({
        mode: 'generator_add',
        pluginId: 'path-gen-plugin',
      });

      const state = useAppStore.getState();
      expect(state.appMode.mode).toBe('generator_add');
      expect(state.activeTool).toBe('add_generator');
      expect(state.activePluginId).toBe('path-gen-plugin');
      expect(state.rightPanelActiveTab).toBe('inspector');
    });

    it('transitions to annotation_edit mode and activates annotation subtool', () => {
      useAppStore.getState().transitionToMode({
        mode: 'annotation_edit',
        subTool: 'rect',
      });

      const state = useAppStore.getState();
      expect(state.appMode.mode).toBe('annotation_edit');
      expect(state.activeTool).toBe('select');
      expect(state.isAnnotationEditMode).toBe(true);
      expect(state.activeAnnotationSubTool).toBe('rect');
      expect(state.rightPanelActiveTab).toBe('inspector');
    });

    it('transitions to custom_layer_edit mode and activates map edit subtool', () => {
      useAppStore.getState().transitionToMode({
        mode: 'custom_layer_edit',
        targetLayerId: 'layer-vector-1',
        subTool: 'circle',
      });

      const state = useAppStore.getState();
      expect(state.appMode.mode).toBe('custom_layer_edit');
      expect(state.isMapEditMode).toBe(true);
      expect(state.mapEditSubTool).toBe('circle');
      expect(state.activeCustomLayerId).toBe('layer-vector-1');
      expect(state.rightPanelActiveTab).toBe('inspector');
      expect(state.selection).toEqual({
        type: 'custom_layer',
        layerId: 'layer-vector-1',
        selectedObjectId: null,
      });
    });

    it('transitions to element_paste mode and stores elementCopyState', () => {
      useAppStore.getState().transitionToMode({
        mode: 'element_paste',
        field: 'yaw',
        value: 1.57,
        coordSystem: 'world',
        previewNodeId: 'node-1',
      });

      const state = useAppStore.getState();
      expect(state.appMode.mode).toBe('element_paste');
      expect(state.elementCopyState).toEqual({
        field: 'yaw',
        value: 1.57,
        coordSystem: 'world',
        previewNodeId: 'node-1',
      });
    });

    it('transitions back to select mode and resets edit states', () => {
      useAppStore.getState().transitionToMode({
        mode: 'annotation_edit',
        subTool: 'line',
      });
      useAppStore.getState().transitionToMode({ mode: 'select' });

      const state = useAppStore.getState();
      expect(state.appMode).toEqual({ mode: 'select' });
      expect(state.activeTool).toBe('select');
      expect(state.isMapEditMode).toBe(false);
      expect(state.isAnnotationEditMode).toBe(false);
      expect(state.activePluginId).toBeNull();
    });

    it('updates current appMode via updateAppMode', () => {
      useAppStore.getState().transitionToMode({ mode: 'waypoint_add' });
      useAppStore.getState().updateAppMode({ snapInput: '5.0', forcedAxis: 'X' });

      const state = useAppStore.getState();
      expect(state.appMode).toEqual({
        mode: 'waypoint_add',
        snapInput: '5.0',
        forcedAxis: 'X',
        forcedSign: null,
        lockedWaypointId: null,
      });
    });
  });

  describe('ActiveSelection Mutual Exclusivity', () => {
    it('selecting nodes clears annotation and custom_layer selection', () => {
      // Setup initial annotation selection
      useAppStore.setState({
        selectedAnnotationIds: ['ann-1', 'ann-2'],
        activeCustomLayerId: 'custom-layer-1',
        selectedEditObjectId: 'obj-1',
      });

      useAppStore.getState().setSelection({ type: 'nodes', ids: ['node-1', 'node-2'] });

      const state = useAppStore.getState();
      expect(state.selection).toEqual({ type: 'nodes', ids: ['node-1', 'node-2'] });
      expect(state.selectedNodeIds).toEqual(['node-1', 'node-2']);
      expect(state.selectedAnnotationIds).toEqual([]);
      expect(state.activeCustomLayerId).toBeNull();
      expect(state.selectedEditObjectId).toBeNull();
    });

    it('selecting annotations clears nodes and custom_layer selection', () => {
      useAppStore.setState({
        selectedNodeIds: ['node-1'],
        activeCustomLayerId: 'custom-layer-1',
        selectedEditObjectId: 'obj-1',
      });

      useAppStore.getState().setSelection({ type: 'annotations', ids: ['ann-1'] });

      const state = useAppStore.getState();
      expect(state.selection).toEqual({ type: 'annotations', ids: ['ann-1'] });
      expect(state.selectedAnnotationIds).toEqual(['ann-1']);
      expect(state.selectedNodeIds).toEqual([]);
      expect(state.activeCustomLayerId).toBeNull();
      expect(state.selectedEditObjectId).toBeNull();
      expect(state.rightPanelActiveTab).toBe('inspector');
    });

    it('selecting custom_layer clears nodes and annotations selection', () => {
      useAppStore.setState({
        selectedNodeIds: ['node-1'],
        selectedAnnotationIds: ['ann-1'],
      });

      useAppStore.getState().setSelection({
        type: 'custom_layer',
        layerId: 'layer-vector-1',
        selectedObjectId: 'obj-polygon-1',
      });

      const state = useAppStore.getState();
      expect(state.selection).toEqual({
        type: 'custom_layer',
        layerId: 'layer-vector-1',
        selectedObjectId: 'obj-polygon-1',
      });
      expect(state.activeCustomLayerId).toBe('layer-vector-1');
      expect(state.selectedEditObjectId).toBe('obj-polygon-1');
      expect(state.selectedNodeIds).toEqual([]);
      expect(state.selectedAnnotationIds).toEqual([]);
      expect(state.rightPanelActiveTab).toBe('inspector');
    });

    it('selecting none clears all selections', () => {
      useAppStore.setState({
        selectedNodeIds: ['node-1'],
        selectedAnnotationIds: ['ann-1'],
        activeCustomLayerId: 'layer-1',
        selectedEditObjectId: 'obj-1',
      });

      useAppStore.getState().setSelection({ type: 'none' });

      const state = useAppStore.getState();
      expect(state.selection).toEqual({ type: 'none' });
      expect(state.selectedNodeIds).toEqual([]);
      expect(state.selectedAnnotationIds).toEqual([]);
      expect(state.activeCustomLayerId).toBeNull();
      expect(state.selectedEditObjectId).toBeNull();
    });
  });

  describe('Modal Stack', () => {
    it('pushes, deduplicates, and pops modals correctly', () => {
      const store = useAppStore.getState();

      store.pushModal('settings');
      expect(useAppStore.getState().modalStack).toEqual(['settings']);
      expect(useAppStore.getState().isSettingsModalOpen).toBe(true);

      store.pushModal('export');
      expect(useAppStore.getState().modalStack).toEqual(['settings', 'export']);
      expect(useAppStore.getState().isExportModalOpen).toBe(true);

      // Pushing settings again moves it to the top
      store.pushModal('settings');
      expect(useAppStore.getState().modalStack).toEqual(['export', 'settings']);

      // Pop top modal (settings)
      const popped1 = store.popModal();
      expect(popped1).toBe('settings');
      expect(useAppStore.getState().modalStack).toEqual(['export']);
      expect(useAppStore.getState().isSettingsModalOpen).toBe(false);
      expect(useAppStore.getState().isExportModalOpen).toBe(true);

      // Pop remaining modal (export)
      const popped2 = store.popModal();
      expect(popped2).toBe('export');
      expect(useAppStore.getState().modalStack).toEqual([]);
      expect(useAppStore.getState().isExportModalOpen).toBe(false);

      // Pop empty stack returns undefined
      expect(store.popModal()).toBeUndefined();
    });

    it('closeModal removes specific modal from stack and sets state to false', () => {
      const store = useAppStore.getState();
      store.pushModal('settings');
      store.pushModal('shortcuts');

      store.closeModal('settings');
      expect(useAppStore.getState().modalStack).toEqual(['shortcuts']);
      expect(useAppStore.getState().isSettingsModalOpen).toBe(false);
      expect(useAppStore.getState().isShortcutsModalOpen).toBe(true);
    });
  });

  describe('Hierarchical Escape Pipe (handleGlobalEscape)', () => {
    it('Tier 1: closes top modal in stack', () => {
      useAppStore.getState().pushModal('settings');
      useAppStore.getState().setSelection({ type: 'nodes', ids: ['node-1'] });
      useAppStore.getState().transitionToMode({ mode: 'waypoint_add' });

      const handled = useAppStore.getState().handleGlobalEscape();
      expect(handled).toBe(true);
      expect(useAppStore.getState().isSettingsModalOpen).toBe(false);
      expect(useAppStore.getState().modalStack).toEqual([]);
      // Selection and mode are preserved
      expect(useAppStore.getState().selection.type).toBe('nodes');
      expect(useAppStore.getState().appMode.mode).toBe('waypoint_add');
    });

    it('Tier 1: does not dismiss welcome modal when isInitialLaunch is true', () => {
      useAppStore.setState({
        isInitialLaunch: true,
        isWelcomeModalOpen: true,
        modalStack: ['welcome'],
      });

      const handled = useAppStore.getState().handleGlobalEscape();
      expect(handled).toBe(true); // Consumes Escape
      expect(useAppStore.getState().isWelcomeModalOpen).toBe(true); // Remains open
      expect(useAppStore.getState().modalStack).toEqual(['welcome']);
    });

    it('Tier 2: blurs focused input element', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      useAppStore.getState().setSelection({ type: 'nodes', ids: ['node-1'] });

      const handled = useAppStore.getState().handleGlobalEscape();
      expect(handled).toBe(true);
      expect(document.activeElement).not.toBe(input);
      // Selection is preserved
      expect(useAppStore.getState().selection.type).toBe('nodes');

      document.body.removeChild(input);
    });

    it('Tier 3: aborts registered canvas gesture handler', () => {
      const abortFn = vi.fn().mockReturnValue(true);
      const unregister = useAppStore.getState().registerCanvasAbortHandler(abortFn);

      useAppStore.getState().setSelection({ type: 'nodes', ids: ['node-1'] });

      const handled = useAppStore.getState().handleGlobalEscape();
      expect(handled).toBe(true);
      expect(abortFn).toHaveBeenCalledTimes(1);
      // Selection is preserved
      expect(useAppStore.getState().selection.type).toBe('nodes');

      unregister();
    });

    it('Tier 4: resets snap input and locked constraints in waypoint_add mode', () => {
      useAppStore.getState().transitionToMode({ mode: 'waypoint_add' });
      useAppStore.getState().updateAppMode({ snapInput: '10.5', forcedAxis: 'X' });

      // First Escape: resets snapInput
      const handled1 = useAppStore.getState().handleGlobalEscape();
      expect(handled1).toBe(true);
      const state1 = useAppStore.getState();
      expect(state1.appMode.mode).toBe('waypoint_add');
      if (state1.appMode.mode === 'waypoint_add') {
        expect(state1.appMode.snapInput).toBe('');
        expect(state1.appMode.forcedAxis).toBe('X');
      }

      // Second Escape: resets forcedAxis / constraints
      const handled2 = useAppStore.getState().handleGlobalEscape();
      expect(handled2).toBe(true);
      const state2 = useAppStore.getState();
      expect(state2.appMode.mode).toBe('waypoint_add');
      if (state2.appMode.mode === 'waypoint_add') {
        expect(state2.appMode.forcedAxis).toBeNull();
      }
    });

    it('Tier 5: clears active selection', () => {
      useAppStore.getState().setSelection({ type: 'nodes', ids: ['node-1', 'node-2'] });
      useAppStore.getState().transitionToMode({ mode: 'waypoint_add' });

      const handled = useAppStore.getState().handleGlobalEscape();
      expect(handled).toBe(true);
      expect(useAppStore.getState().selection).toEqual({ type: 'none' });
      expect(useAppStore.getState().selectedNodeIds).toEqual([]);
      // Mode remains waypoint_add
      expect(useAppStore.getState().appMode.mode).toBe('waypoint_add');
    });

    it('Tier 6: resets non-select mode back to select mode', () => {
      useAppStore.getState().transitionToMode({ mode: 'waypoint_add' });
      expect(useAppStore.getState().selection.type).toBe('none');

      const handled = useAppStore.getState().handleGlobalEscape();
      expect(handled).toBe(true);
      expect(useAppStore.getState().appMode.mode).toBe('select');
      expect(useAppStore.getState().activeTool).toBe('select');
    });

    it('Tier 6: resets element_paste mode and clears elementCopyState on Escape', () => {
      useAppStore.getState().transitionToMode({
        mode: 'element_paste',
        field: 'x',
        value: 10,
        coordSystem: 'world',
        previewNodeId: 'node-1',
      });
      expect(useAppStore.getState().elementCopyState).not.toBeNull();

      const handled = useAppStore.getState().handleGlobalEscape();
      expect(handled).toBe(true);
      expect(useAppStore.getState().appMode.mode).toBe('select');
      expect(useAppStore.getState().elementCopyState).toBeNull();
    });

    it('Tier 7: returns false when completely idle in select mode with no selection', () => {
      expect(useAppStore.getState().appMode.mode).toBe('select');
      expect(useAppStore.getState().selection.type).toBe('none');

      const handled = useAppStore.getState().handleGlobalEscape();
      expect(handled).toBe(false);
    });
  });

  describe('History Undo/Redo Selection Persistence', () => {
    it('restores selection atomically during undo and redo', () => {
      // 1. Initial state with node-1 selected
      useAppStore.getState().setSelection({ type: 'nodes', ids: ['node-1'] });

      // Action 1: Save snapshot of state with node-1, then select node-2
      useAppStore.getState().pushHistorySnapshot();
      useAppStore.getState().setSelection({ type: 'nodes', ids: ['node-2'] });

      // Action 2: Save snapshot of state with node-2, then clear selection
      useAppStore.getState().pushHistorySnapshot();
      useAppStore.getState().setSelection({ type: 'none' });

      expect(useAppStore.getState().selection).toEqual({ type: 'none' });

      // Undo Action 2 -> restores node-2
      useAppStore.getState().undo();
      expect(useAppStore.getState().selection).toEqual({ type: 'nodes', ids: ['node-2'] });
      expect(useAppStore.getState().selectedNodeIds).toEqual(['node-2']);

      // Undo Action 1 -> restores node-1
      useAppStore.getState().undo();
      expect(useAppStore.getState().selection).toEqual({ type: 'nodes', ids: ['node-1'] });
      expect(useAppStore.getState().selectedNodeIds).toEqual(['node-1']);

      // Redo Action 1 -> restores node-2
      useAppStore.getState().redo();
      expect(useAppStore.getState().selection).toEqual({ type: 'nodes', ids: ['node-2'] });
      expect(useAppStore.getState().selectedNodeIds).toEqual(['node-2']);
    });
  });

  describe('Legacy Action Synchronization (Store Hardening)', () => {
    it('synchronizes appMode when setActiveTool is invoked', () => {
      // 1. setActiveTool('add_point')
      useAppStore.getState().setActiveTool('add_point');
      expect(useAppStore.getState().activeTool).toBe('add_point');
      expect(useAppStore.getState().appMode.mode).toBe('waypoint_add');

      // 2. setActiveTool('add_generator')
      useAppStore.getState().setActiveTool('add_generator');
      expect(useAppStore.getState().activeTool).toBe('add_generator');
      expect(useAppStore.getState().appMode.mode).toBe('generator_add');

      // 3. setActiveTool('add_export_region')
      useAppStore.getState().setActiveTool('add_export_region');
      expect(useAppStore.getState().activeTool).toBe('add_export_region');
      expect(useAppStore.getState().appMode.mode).toBe('export_region_edit');

      // 4. setActiveTool('select')
      useAppStore.getState().setActiveTool('select');
      expect(useAppStore.getState().activeTool).toBe('select');
      expect(useAppStore.getState().appMode.mode).toBe('select');
    });

    it('synchronizes appMode when setActiveTool("select") is called while in annotation_edit mode', () => {
      useAppStore.getState().transitionToMode({ mode: 'annotation_edit', subTool: 'rect' });
      expect(useAppStore.getState().appMode.mode).toBe('annotation_edit');
      expect(useAppStore.getState().isAnnotationEditMode).toBe(true);

      useAppStore.getState().setActiveTool('select');
      expect(useAppStore.getState().appMode.mode).toBe('select');
      expect(useAppStore.getState().activeTool).toBe('select');
      expect(useAppStore.getState().isAnnotationEditMode).toBe(false);
    });

    it('synchronizes appMode when setActiveTool("select") is called while in custom_layer_edit mode', () => {
      useAppStore.getState().setMapEditMode(true);
      expect(useAppStore.getState().appMode.mode).toBe('custom_layer_edit');
      expect(useAppStore.getState().isMapEditMode).toBe(true);

      useAppStore.getState().setActiveTool('select');
      expect(useAppStore.getState().appMode.mode).toBe('select');
      expect(useAppStore.getState().activeTool).toBe('select');
      expect(useAppStore.getState().isMapEditMode).toBe(false);
    });

    it('synchronizes appMode when setMapEditMode is invoked', () => {
      useAppStore.getState().setMapEditMode(true);
      expect(useAppStore.getState().isMapEditMode).toBe(true);
      expect(useAppStore.getState().appMode.mode).toBe('custom_layer_edit');

      useAppStore.getState().setMapEditMode(false);
      expect(useAppStore.getState().isMapEditMode).toBe(false);
      expect(useAppStore.getState().appMode.mode).toBe('select');
    });

    it('enforces Selection Authority Invariant across mode transitions', () => {
      // 1. Having selected nodes, transition to custom_layer_edit -> clears selectedNodeIds
      useAppStore.setState({ selectedNodeIds: ['node-1', 'node-2'], selection: { type: 'nodes', ids: ['node-1', 'node-2'] } });
      useAppStore.getState().transitionToMode({ mode: 'custom_layer_edit', targetLayerId: 'layer-1' });
      expect(useAppStore.getState().selectedNodeIds).toEqual([]);
      expect(useAppStore.getState().selection.type).toBe('custom_layer');

      // 2. Having selected nodes, transition to annotation_edit -> clears selectedNodeIds
      useAppStore.setState({ selectedNodeIds: ['node-1'], selection: { type: 'nodes', ids: ['node-1'] } });
      useAppStore.getState().transitionToMode({ mode: 'annotation_edit' });
      expect(useAppStore.getState().selectedNodeIds).toEqual([]);
      expect(useAppStore.getState().selection.type).toBe('none');

      // 3. Returning from custom_layer_edit to select clears custom_layer selection
      useAppStore.getState().transitionToMode({ mode: 'custom_layer_edit', targetLayerId: 'layer-1' });
      expect(useAppStore.getState().selection.type).toBe('custom_layer');
      useAppStore.getState().transitionToMode({ mode: 'select' });
      expect(useAppStore.getState().selection.type).toBe('none');
      expect(useAppStore.getState().activeCustomLayerId).toBeNull();
    });

    it('executes canvasAbortHandlers synchronously during transitionToMode (OnExit phase)', () => {
      const abortSpy = vi.fn().mockReturnValue(true);
      const unregister = useAppStore.getState().registerCanvasAbortHandler(abortSpy);

      expect(abortSpy).not.toHaveBeenCalled();

      // Transition while a gesture is conceptually running
      useAppStore.getState().transitionToMode({ mode: 'waypoint_add' });
      expect(abortSpy).toHaveBeenCalledTimes(1);

      // Transition to another mode triggers abort again
      useAppStore.getState().transitionToMode({ mode: 'annotation_edit' });
      expect(abortSpy).toHaveBeenCalledTimes(2);

      unregister();
      useAppStore.getState().transitionToMode({ mode: 'select' });
      expect(abortSpy).toHaveBeenCalledTimes(2);
    });

    it('notifies mode transition listeners onExit and onEnter in strict order', () => {
      const callLog: string[] = [];
      const listener = {
        onExit: vi.fn((cur, next) => {
          callLog.push(`exit:${cur.mode}->${next.mode}`);
        }),
        onEnter: vi.fn((next, prev) => {
          callLog.push(`enter:${next.mode}<-${prev.mode}`);
        }),
      };

      const unsubscribe = useAppStore.getState().subscribeModeTransition(listener);

      useAppStore.getState().transitionToMode({ mode: 'waypoint_add' });

      expect(listener.onExit).toHaveBeenCalledWith({ mode: 'select' }, expect.objectContaining({ mode: 'waypoint_add' }));
      expect(listener.onEnter).toHaveBeenCalledWith(expect.objectContaining({ mode: 'waypoint_add' }), { mode: 'select' });
      expect(callLog).toEqual(['exit:select->waypoint_add', 'enter:waypoint_add<-select']);

      unsubscribe();
      useAppStore.getState().transitionToMode({ mode: 'select' });
      expect(listener.onExit).toHaveBeenCalledTimes(1);
      expect(listener.onEnter).toHaveBeenCalledTimes(1);
    });

    it('provides abortCanvasGestures which invokes all registered abort handlers in reverse order', () => {
      const log: string[] = [];
      const unreg1 = useAppStore.getState().registerCanvasAbortHandler(() => {
        log.push('first');
        return false;
      });
      const unreg2 = useAppStore.getState().registerCanvasAbortHandler(() => {
        log.push('second');
        return true;
      });

      const res = useAppStore.getState().abortCanvasGestures();
      expect(res).toBe(true);
      expect(log).toEqual(['second', 'first']);

      unreg1();
      unreg2();
    });
  });
});


