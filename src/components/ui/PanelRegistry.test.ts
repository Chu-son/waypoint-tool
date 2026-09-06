import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resolvePanelTabs, useInspectorPanelComponent, resolveInspectorComponent } from './PanelRegistry';
import { PanelTab } from './PanelContainer';
import { PluginParamsPanel } from './PluginParamsPanel';
import { CustomLayerInspector } from './properties/CustomLayerInspector';
import { AnnotationInspector } from './properties/AnnotationInspector';
import { PipelineInspector } from './properties/PipelineInspector';
import { PropertiesPanel } from './PropertiesPanel';
import { useAppStore } from '../../stores/appStore';

describe('PanelRegistry', () => {
  const fallbackTabs: PanelTab[] = [
    { id: 'project', title: 'Waypoints', component: null as any },
    { id: 'plugins', title: 'Plugins', component: null as any },
  ];

  it('returns fallback tabs when tabsDef is undefined or empty', () => {
    expect(resolvePanelTabs(undefined, fallbackTabs)).toEqual(fallbackTabs);
    expect(resolvePanelTabs([], fallbackTabs)).toEqual(fallbackTabs);
  });

  it('resolves builtin tabs with custom titles', () => {
    const tabs = resolvePanelTabs(
      [
        { type: 'builtin', id: 'project', title: 'Custom Waypoints' },
        { type: 'builtin', id: 'layers', title: 'Custom Layers' },
      ],
      fallbackTabs
    );

    expect(tabs.length).toBe(2);
    expect(tabs[0].id).toBe('project');
    expect(tabs[0].title).toBe('Custom Waypoints');
    expect(tabs[1].id).toBe('layers');
    expect(tabs[1].title).toBe('Custom Layers');
  });

  it('resolves workflow tab', () => {
    const tabs = resolvePanelTabs(
      [{ type: 'workflow', id: 'workflow', title: 'Workflow Guide' }],
      fallbackTabs
    );

    expect(tabs.length).toBe(1);
    expect(tabs[0].id).toBe('workflow');
    expect(tabs[0].title).toBe('Workflow Guide');
  });

  it('resolves custom html and url tabs', () => {
    const tabs = resolvePanelTabs(
      [
        { type: 'html_file', id: 'custom_html', title: 'Custom HTML', src: './panel.html' },
        { type: 'url', id: 'custom_url', title: 'Fleet URL', url: 'http://localhost' },
      ],
      fallbackTabs
    );

    expect(tabs.length).toBe(2);
    expect(tabs[0].id).toBe('custom_html');
    expect(tabs[1].id).toBe('custom_url');
  });

  describe('useInspectorPanelComponent', () => {
    it('returns PluginParamsPanel when add_generator is active with a waypoint generator plugin', () => {
      useAppStore.setState({
        activeTool: 'add_generator',
        activePluginId: 'waypoint-plugin',
        plugins: {
          'waypoint-plugin': {
            id: 'waypoint-plugin',
            manifest: { name: 'Line Gen', category: 'waypoint_generator' },
          } as any,
        },
        activeCustomLayerId: null,
      });

      const { result } = renderHook(() => useInspectorPanelComponent());
      expect(result.current.type).toBe(PluginParamsPanel);
    });

    it('returns CustomLayerInspector when add_generator is active with a map_layer_generator plugin', () => {
      useAppStore.setState({
        activeTool: 'add_generator',
        activePluginId: 'layer-plugin',
        plugins: {
          'layer-plugin': {
            id: 'layer-plugin',
            manifest: { name: 'Layer Gen', category: 'map_layer_generator' },
          } as any,
        },
        activeCustomLayerId: null,
      });

      const { result } = renderHook(() => useInspectorPanelComponent());
      expect(result.current.type).toBe(CustomLayerInspector);
    });

    it('returns CustomLayerInspector when activeCustomLayerId is set and not in add_generator mode', () => {
      useAppStore.setState({
        activeTool: 'select',
        activePluginId: null,
        activeCustomLayerId: 'layer-123',
        customLayers: [{ id: 'layer-123', name: 'Regular Layer', type: 'manual', editObjects: [], visible: true, opacity: 1, z_index: 0 }],
      });

      const { result } = renderHook(() => useInspectorPanelComponent());
      expect(result.current.type).toBe(CustomLayerInspector);
    });

    it('returns PipelineInspector directly when selected custom layer has pipeline_metadata', () => {
      useAppStore.setState({
        activeTool: 'select',
        activePluginId: null,
        activeCustomLayerId: 'pipeline-layer-1',
        selection: { type: 'custom_layer', layerId: 'pipeline-layer-1', selectedObjectId: null },
        customLayers: [
          {
            id: 'pipeline-layer-1',
            name: 'Noise Filter Mask',
            type: 'plugin',
            plugin_id: 'noise_filter',
            params: {},
            image_base64: '',
            info: { resolution: 0.05, origin: [0, 0, 0], width: 10, height: 10 },
            visible: true,
            opacity: 0.7,
            z_index: 0,
            pipeline_metadata: {
              pipeline_id: 'test_pipeline',
              pipeline_execution_id: 'exec-1',
              step_id: 'filter_step',
              step_execution_id: 's-exec-1',
            },
          },
        ],
      });

      const { result } = renderHook(() => useInspectorPanelComponent());
      expect(result.current.type).toBe(PipelineInspector);
    });

    it('returns PipelineInspector directly when selected node has pipeline_metadata', () => {
      useAppStore.setState({
        activeTool: 'select',
        activePluginId: null,
        activeCustomLayerId: null,
        selectedNodeIds: ['node-1'],
        selection: { type: 'nodes', ids: ['node-1'] },
        nodes: {
          'node-1': {
            id: 'node-1',
            name: 'Sweep Group',
            type: 'generator',
            pipeline_metadata: {
              pipeline_id: 'test_pipeline',
              pipeline_execution_id: 'exec-1',
              step_id: 'sweep_step',
              step_execution_id: 's-exec-2',
            },
          } as any,
        },
      });

      const { result } = renderHook(() => useInspectorPanelComponent());
      expect(result.current.type).toBe(PipelineInspector);
    });

    it('returns PropertiesPanel when tool is select and no custom layer is selected', () => {
      useAppStore.setState({
        activeTool: 'select',
        activePluginId: null,
        activeCustomLayerId: null,
        selection: { type: 'none' },
        selectedNodeIds: [],
      });

      const { result } = renderHook(() => useInspectorPanelComponent());
      expect(result.current.type).toBe(PropertiesPanel);
    });
  });

  describe('resolveInspectorComponent', () => {
    it('returns CustomLayerInspector for generator_add with map_layer_generator category', () => {
      const el = resolveInspectorComponent(
        { mode: 'generator_add', pluginId: 'map-gen' },
        { type: 'none' },
        { manifest: { category: 'map_layer_generator' } }
      );
      expect(el.type).toBe(CustomLayerInspector);
    });

    it('returns PluginParamsPanel for generator_add with non-map generator', () => {
      const el = resolveInspectorComponent(
        { mode: 'generator_add', pluginId: 'wp-gen' },
        { type: 'none' },
        { manifest: { category: 'waypoint_generator' } }
      );
      expect(el.type).toBe(PluginParamsPanel);
    });

    it('returns CustomLayerInspector when selection is custom_layer', () => {
      const el = resolveInspectorComponent(
        { mode: 'select' },
        { type: 'custom_layer', layerId: 'l1', selectedObjectId: null }
      );
      expect(el.type).toBe(CustomLayerInspector);
    });

    it('returns AnnotationInspector when selection is annotations', () => {
      const el = resolveInspectorComponent(
        { mode: 'select' },
        { type: 'annotations', ids: ['ann-1'] }
      );
      expect(el.type).toBe(AnnotationInspector);
    });

    it('returns PropertiesPanel when selection is nodes', () => {
      const el = resolveInspectorComponent(
        { mode: 'select' },
        { type: 'nodes', ids: ['node-1'] }
      );
      expect(el.type).toBe(PropertiesPanel);
    });

    it('returns PluginParamsPanel for plugin_interaction mode', () => {
      const el = resolveInspectorComponent(
        { mode: 'plugin_interaction', pluginId: 'wp-gen', inputKey: 'pos' },
        { type: 'none' },
        { manifest: { category: 'waypoint_generator' } }
      );
      expect(el.type).toBe(PluginParamsPanel);
    });

    it('returns CustomLayerInspector for custom_layer_edit mode regardless of selection', () => {
      const el = resolveInspectorComponent(
        { mode: 'custom_layer_edit', targetLayerId: 'l1', subTool: 'rect', fillValue: 100, brushSize: 5 },
        { type: 'none' }
      );
      expect(el.type).toBe(CustomLayerInspector);
    });

    it('returns AnnotationInspector for annotation_edit mode even when selection is none', () => {
      const el = resolveInspectorComponent(
        { mode: 'annotation_edit', subTool: 'rect', targetGroupId: null },
        { type: 'none' }
      );
      expect(el.type).toBe(AnnotationInspector);
    });

    it('returns PropertiesPanel when selection is none', () => {
      const el = resolveInspectorComponent(
        { mode: 'select' },
        { type: 'none' }
      );
      expect(el.type).toBe(PropertiesPanel);
    });
  });
});

