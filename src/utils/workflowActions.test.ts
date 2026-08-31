import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeWorkflowAction } from './workflowActions';
import { useAppStore } from '../stores/appStore';

describe('workflowActions', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeTool: 'select',
      isAnnotationEditMode: false,
      activeAnnotationSubTool: 'select',
      defaultAnnotationColor: '#3B82F6',
      isMapEditMode: false,
      mapEditSubTool: 'rect',
      mapEditFillValue: 0,
      mapEditBrushSize: 10,
      customLayers: [],
      activeCustomLayerId: null,
      robotFootprint: { type: 'circular', radius: 0.3 },
      isExportModalOpen: false,
      isExportMapsModalOpen: false,
      isSettingsModalOpen: false,
      activePluginId: null,
      plugins: {},
      pluginActiveProperties: {},
      pluginInteractionData: {},
    });
  });

  it('handles reset_project', async () => {
    useAppStore.setState({ isDirty: true });
    await executeWorkflowAction('reset_project');
    expect(useAppStore.getState().isDirty).toBe(false);
  });

  it('handles set_robot_footprint and setRobotFootprintRadius', async () => {
    await executeWorkflowAction('setRobotFootprintRadius', { value: 0.25 });
    expect(useAppStore.getState().robotFootprint).toEqual({
      type: 'circular',
      radius: 0.25,
    });

    await executeWorkflowAction('set_robot_footprint', {
      type: 'rectangular',
      length: 0.6,
      width: 0.4,
    });
    expect(useAppStore.getState().robotFootprint).toMatchObject({
      type: 'rectangular',
      length: 0.6,
      width: 0.4,
    });
  });

  it('handles set_annotation_tool', async () => {
    await executeWorkflowAction('set_annotation_tool', {
      tool: 'rect',
      defaultColor: '#ef4444',
    });

    const state = useAppStore.getState();
    expect(state.isAnnotationEditMode).toBe(true);
    expect(state.activeAnnotationSubTool).toBe('rect');
    expect(state.defaultAnnotationColor).toBe('#ef4444');
    expect(state.activeTool).toBe('select');
  });

  it('handles start_map_edit and stop_map_edit', async () => {
    await executeWorkflowAction('start_map_edit', {
      subTool: 'circle',
      fillValue: 0,
      brushSize: 20,
      layerName: 'Noise Cleanup',
    });

    const state = useAppStore.getState();
    expect(state.isMapEditMode).toBe(true);
    expect(state.mapEditSubTool).toBe('circle');
    expect(state.mapEditFillValue).toBe(0);
    expect(state.mapEditBrushSize).toBe(20);
    expect(state.customLayers.length).toBe(1);
    expect(state.customLayers[0].name).toBe('Noise Cleanup');
    expect(state.activeCustomLayerId).toBe(state.customLayers[0].id);

    await executeWorkflowAction('stop_map_edit');
    expect(useAppStore.getState().isMapEditMode).toBe(false);
  });

  it('handles modal opening actions', async () => {
    await executeWorkflowAction('open_export_modal');
    expect(useAppStore.getState().isExportModalOpen).toBe(true);

    await executeWorkflowAction('open_export_maps_modal');
    expect(useAppStore.getState().isExportMapsModalOpen).toBe(true);

    await executeWorkflowAction('open_settings_modal', { tab: 'robot' });
    expect(useAppStore.getState().isSettingsModalOpen).toBe(true);
    expect(useAppStore.getState().settingsModalTab).toBe('robot');
  });

  it('handles set_active_plugin and run_plugin', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ success: true });
    const mockPlugin: any = {
      id: 'test_plugin',
      manifest: { name: 'Test Plugin', inputs: [] },
    };

    useAppStore.setState({
      plugins: { test_plugin: mockPlugin },
      executeGeneratorPlugin: mockExecute,
    });

    await executeWorkflowAction('set_active_plugin', { pluginId: 'test_plugin' });
    expect(useAppStore.getState().activePluginId).toBe('test_plugin');

    await executeWorkflowAction('run_plugin', {
      pluginId: 'test_plugin',
      properties: { step_size: 0.2 },
    });

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        plugin: mockPlugin,
        properties: expect.objectContaining({ step_size: 0.2 }),
      })
    );
  });

  it('shows alert when plugin is not found with available plugins list', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const mockPlugin: any = {
      id: 'existing_plugin',
      manifest: { name: 'Existing Plugin', inputs: [] },
    };

    useAppStore.setState({
      plugins: { existing_plugin: mockPlugin },
    });

    await executeWorkflowAction('run_plugin', {
      pluginId: 'non_existent_plugin',
    });

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('プラグインが見つかりません: non_existent_plugin')
    );
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('existing_plugin')
    );
    alertSpy.mockRestore();
  });

  it('resolves explicit $fromAnnotation bindings in run_plugin', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ success: true });
    const mockPlugin: any = {
      id: 'drivable_area_layer_generator',
      manifest: { name: 'Drivable Area Layer Generator', inputs: [] },
    };

    const mockRectAnno: any = {
      id: 'anno-1',
      name: '清掃範囲',
      type: 'rect',
      cx: 5.0,
      cy: 6.0,
      width: 4.0,
      height: 3.0,
    };

    useAppStore.setState({
      plugins: { drivable_area_layer_generator: mockPlugin },
      annotationObjects: { 'anno-1': mockRectAnno },
      annotationOrder: ['anno-1'],
      executeGeneratorPlugin: mockExecute,
    });

    await executeWorkflowAction('run_plugin', {
      pluginId: 'drivable_area_layer_generator',
      interactionData: {
        sweep_rect: { $fromAnnotation: { name: '清掃範囲', type: 'rect' } },
      },
    });

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionData: expect.objectContaining({
          sweep_rect: mockRectAnno,
        }),
      })
    );
  });

  it('handles set_annotation_tool with groupName, allowedTools, and saveToVariable', async () => {
    await executeWorkflowAction('set_annotation_tool', {
      tool: 'point',
      groupName: '障害物ポイント',
      allowedTools: ['point'],
      saveToVariable: 'obstacle_group',
    });

    const state = useAppStore.getState();
    expect(state.isAnnotationEditMode).toBe(true);
    expect(state.activeAnnotationSubTool).toBe('point');
    expect(state.allowedAnnotationSubTools).toEqual(['point']);
    expect(state.activeAnnotationGroupId).toBeTruthy();
    expect(state.workflowVariables['obstacle_group']).toMatchObject({
      groupName: '障害物ポイント',
      tool: 'point',
    });
  });

  it('resolves $var and $fromAnnotationGroup bindings in run_plugin', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ success: true, source_execution_id: 'exec_regen_1' });
    const mockPlugin: any = {
      id: 'path_planner',
      manifest: { name: 'Path Planner', inputs: [] },
    };

    const mockPoint1: any = { id: 'p1', name: 'pt1', type: 'point', x: 1.5, y: 2.5, group_id: 'grp-obs' };
    const mockPoint2: any = { id: 'p2', name: 'pt2', type: 'point', x: 3.5, y: 4.5, group_id: 'grp-obs' };

    useAppStore.setState({
      plugins: { path_planner: mockPlugin },
      annotationGroups: {
        'grp-obs': { id: 'grp-obs', type: 'manual_group', name: '障害物グループ', children_ids: ['p1', 'p2'], visible: true },
      },
      annotationObjects: { p1: mockPoint1, p2: mockPoint2 },
      workflowVariables: {
        target_group: '障害物グループ',
        custom_speed: 1.2,
      },
      executeGeneratorPlugin: mockExecute,
    });

    await executeWorkflowAction('run_plugin', {
      pluginId: 'path_planner',
      stepId: 'step_path',
      properties: {
        speed: { $var: 'custom_speed' },
      },
      interactionData: {
        obstacles: { $fromAnnotationGroup: '$var:target_group' },
      },
    });

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({ speed: 1.2 }),
        interactionData: expect.objectContaining({
          obstacles: [
            { x: 1.5, y: 2.5, name: 'pt1' },
            { x: 3.5, y: 4.5, name: 'pt2' },
          ],
        }),
      })
    );

    // Verify stepExecutionId was recorded for regeneration
    expect(useAppStore.getState().stepExecutionIds['step_path']).toBe('exec_regen_1');

    // Run again to verify existingExecutionId is passed for regeneration
    await executeWorkflowAction('run_plugin', {
      pluginId: 'path_planner',
      stepId: 'step_path',
    });

    expect(mockExecute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        existingExecutionId: 'exec_regen_1',
      })
    );
  });

  it('gracefully handles unknown actions', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await executeWorkflowAction('unknown_action_name');
    expect(warnSpy).toHaveBeenCalledWith('[WorkflowAction] Unknown action: unknown_action_name');
    warnSpy.mockRestore();
  });
});
