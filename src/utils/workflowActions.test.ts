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

  it('gracefully handles unknown actions', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await executeWorkflowAction('unknown_action_name');
    expect(warnSpy).toHaveBeenCalledWith('[WorkflowAction] Unknown action: unknown_action_name');
    warnSpy.mockRestore();
  });
});
