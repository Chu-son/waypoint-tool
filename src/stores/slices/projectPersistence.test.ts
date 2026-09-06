import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';
import { buildProjectData } from './projectSlice';
import { StrictProjectData } from '../../types/store';
import {
  DEFAULT_ROBOT_FOOTPRINT,
  DEFAULT_OCCUPANCY_SETTINGS,
  DEFAULT_MAP_OPACITY,
  DEFAULT_EXPORT_FORMATS,
} from '../migrations/projectMigration';

describe('projectPersistence roundtrip & strict validation', () => {
  beforeEach(() => {
    useAppStore.getState().resetProject();
  });

  it('preserves all StrictProjectData fields on setProjectData -> buildProjectData roundtrip', () => {
    const fullProjectData: StrictProjectData = {
      version: 1,
      root_node_ids: ['node-1'],
      nodes: {
        'node-1': {
          id: 'node-1',
          type: 'manual',
          name: 'Node 1',
          transform: { x: 12.3, y: 45.6, qx: 0, qy: 0, qz: 0.707, qw: 0.707 },
          options: {},
          children_ids: [],
        },
      },
      map_layers: [
        {
          id: 'map-1',
          name: 'Main Map',
          info: { resolution: 0.05, origin: [0, 0, 0], initial_origin: [0, 0, 0] },
          image_base64: 'data:image/png;base64,dummy',
          width: 800,
          height: 600,
          visible: true,
          opacity: 0.85,
          z_index: 0,
          blend_mode: 'overwrite',
        },
      ],
      custom_layers: [
        {
          id: 'cust-1',
          name: 'Manual Layer',
          type: 'manual',
          visible: true,
          opacity: 0.9,
          z_index: 0,
          blend_mode: 'overwrite',
          is_reference: false,
          editObjects: [
            { id: 'obj-1', type: 'rect', cx: 10, cy: 10, width: 20, height: 20, angle: 0, fillValue: 0 },
          ],
        },
      ],
      annotation_objects: [
        {
          id: 'ann-1',
          type: 'point',
          name: 'Point Ann',
          x: 5,
          y: 5,
          color: '#ff0000',
          visible: true,
          labelVisible: true,
          group_id: 'grp-1',
        },
      ],
      annotation_groups: {
        'grp-1': {
          id: 'grp-1',
          name: 'Group 1',
          type: 'manual_group',
          visible: true,
          children_ids: ['ann-1'],
        },
      },
      root_annotation_ids: ['grp-1'],
      export_regions: [
        {
          id: 'region-1',
          name: 'Region 1',
          rect: { x: 0, y: 0, width: 100, height: 100 },
          visible: true,
          layerVisibility: {},
        },
      ],
      options_schema: {
        options: [],
      },
      export_templates: [
        {
          id: 'local-tmpl-1',
          name: 'Local Template',
          extension: 'json',
          suffix: '_local',
          content: '{{#each waypoints}}{{/each}}',
          scope: 'local',
        },
      ],
      default_export_formats: [
        {
          id: '__default_yaml__',
          name: 'YAML Document',
          extension: 'yaml',
          suffix: '_yaml',
          enabled: true,
        },
      ],
      robot_footprint: {
        type: 'rectangular',
        length: 0.8,
        width: 0.6,
      },
      occupancy_settings: {
        defaultOccupiedThresh: 0.7,
        defaultFreeThresh: 0.25,
        defaultNegate: 1,
      },
      default_map_opacity: 0.65,
      left_panel_view_mode: 'split',
      right_panel_view_mode: 'split',
      active_path_calculator_plugin_id: 'dijkstra-plugin',
      path_calculator_params: { tolerance: 0.05 },
      auto_recalculate_path: false,
      path_color: '#3b82f6',
      path_width: 0.25,
      path_opacity: 0.85,
      sync_path_width_with_footprint: true,
      index_start_index: 1,
      decimal_precision: 4,
      custom_ui_data: {
        workflow_state: {
          current_step_index: 3,
          max_reached_step_index: 4,
          workflow_variables: { selectedRoom: 'Kitchen' },
          step_execution_ids: { step3: 'exec-99' },
        },
      },
    };

    useAppStore.getState().setProjectData(fullProjectData);
    const saved = buildProjectData(useAppStore.getState());

    // 1. StrictProjectData has all 27 required top-level keys
    const expectedKeys: (keyof StrictProjectData)[] = [
      'version',
      'root_node_ids',
      'nodes',
      'map_layers',
      'custom_layers',
      'annotation_objects',
      'annotation_groups',
      'root_annotation_ids',
      'export_regions',
      'options_schema',
      'export_templates',
      'default_export_formats',
      'robot_footprint',
      'occupancy_settings',
      'default_map_opacity',
      'left_panel_view_mode',
      'right_panel_view_mode',
      'active_path_calculator_plugin_id',
      'path_calculator_params',
      'auto_recalculate_path',
      'path_color',
      'path_width',
      'path_opacity',
      'sync_path_width_with_footprint',
      'index_start_index',
      'decimal_precision',
      'custom_ui_data',
    ];

    expect(Object.keys(saved).sort()).toEqual(expectedKeys.sort());

    // 2. Exact equality of values
    expect(saved.version).toBe(1);
    expect(saved.root_node_ids).toEqual(fullProjectData.root_node_ids);
    expect(saved.nodes).toEqual(fullProjectData.nodes);
    expect(saved.map_layers).toEqual(fullProjectData.map_layers);
    expect(saved.custom_layers).toEqual(fullProjectData.custom_layers);
    expect(saved.annotation_objects).toEqual(fullProjectData.annotation_objects);
    expect(saved.annotation_groups).toEqual(fullProjectData.annotation_groups);
    expect(saved.root_annotation_ids).toEqual(fullProjectData.root_annotation_ids);
    expect(saved.export_regions).toEqual(fullProjectData.export_regions);
    expect(saved.options_schema).toEqual(fullProjectData.options_schema);
    expect(saved.export_templates).toEqual(fullProjectData.export_templates);
    expect(saved.default_export_formats).toEqual(fullProjectData.default_export_formats);
    expect(saved.robot_footprint).toEqual(fullProjectData.robot_footprint);
    expect(saved.occupancy_settings).toEqual(fullProjectData.occupancy_settings);
    expect(saved.default_map_opacity).toBe(0.65);
    expect(saved.left_panel_view_mode).toBe('split');
    expect(saved.right_panel_view_mode).toBe('split');
    expect(saved.active_path_calculator_plugin_id).toBe('dijkstra-plugin');
    expect(saved.path_calculator_params).toEqual({ tolerance: 0.05 });
    expect(saved.auto_recalculate_path).toBe(false);
    expect(saved.path_color).toBe('#3b82f6');
    expect(saved.path_width).toBe(0.25);
    expect(saved.path_opacity).toBe(0.85);
    expect(saved.sync_path_width_with_footprint).toBe(true);
    expect(saved.index_start_index).toBe(1);
    expect(saved.decimal_precision).toBe(4);
    expect(saved.custom_ui_data.workflow_state).toEqual(fullProjectData.custom_ui_data.workflow_state);
  });

  it('prevents workflowVariables leaking between project loads', () => {
    // 1. Set a project with workflow variables
    useAppStore.getState().setProjectData({
      custom_ui_data: {
        workflow_state: {
          current_step_index: 2,
          max_reached_step_index: 2,
          workflow_variables: { token: 'secret-123' },
          step_execution_ids: {},
        },
      },
    });

    expect(useAppStore.getState().workflowVariables).toEqual({ token: 'secret-123' });
    expect(useAppStore.getState().currentStepIndex).toBe(2);

    // 2. Load another project that has no workflow state
    useAppStore.getState().setProjectData({
      root_node_ids: [],
      nodes: {},
    });

    // Workflow variables should have been reset by resetWorkflow() at the start of setProjectData
    expect(useAppStore.getState().workflowVariables).toEqual({});
    expect(useAppStore.getState().currentStepIndex).toBe(0);
    expect(useAppStore.getState().maxReachedStepIndex).toBe(0);
  });

  it('resets all project and UI settings on resetProject', () => {
    // Modify settings away from default
    useAppStore.getState().setProjectData({
      index_start_index: 1,
      decimal_precision: 2,
      default_map_opacity: 0.9,
      path_color: '#123456',
      auto_recalculate_path: false,
      custom_ui_data: {
        workflow_state: {
          current_step_index: 5,
          workflow_variables: { a: 1 },
        },
      },
    });

    expect(useAppStore.getState().indexStartIndex).toBe(1);
    expect(useAppStore.getState().decimalPrecision).toBe(2);
    expect(useAppStore.getState().defaultMapOpacity).toBe(0.9);
    expect(useAppStore.getState().autoRecalculatePath).toBe(false);
    expect(useAppStore.getState().currentStepIndex).toBe(5);

    // Call resetProject()
    useAppStore.getState().resetProject();

    const state = useAppStore.getState();
    expect(state.indexStartIndex).toBe(0);
    expect(state.decimalPrecision).toBe(6);
    expect(state.defaultMapOpacity).toBe(DEFAULT_MAP_OPACITY);
    expect(state.defaultExportFormats).toEqual(DEFAULT_EXPORT_FORMATS);
    expect(state.robotFootprint).toEqual(DEFAULT_ROBOT_FOOTPRINT);
    expect(state.occupancySettings).toEqual(DEFAULT_OCCUPANCY_SETTINGS);
    expect(state.leftPanelViewMode).toBe('tabs');
    expect(state.rightPanelViewMode).toBe('tabs');
    expect(state.autoRecalculatePath).toBe(true);
    expect(state.currentStepIndex).toBe(0);
    expect(state.workflowVariables).toEqual({});
    expect(state.currentProjectPath).toBeNull();
    expect(state.isDirty).toBe(false);
  });

  it('resets autoRecalculatePath to true on resetProject', () => {
    useAppStore.getState().setProjectData({
      auto_recalculate_path: false,
    });
    expect(useAppStore.getState().autoRecalculatePath).toBe(false);

    useAppStore.getState().resetProject();
    expect(useAppStore.getState().autoRecalculatePath).toBe(true);
  });

  it('respects custom UI layout configuration over loaded project view modes when in custom UI mode', () => {
    useAppStore.setState({
      isCustomUiMode: true,
      customUiConfig: {
        layout: {
          leftPanel: { viewMode: 'split' },
          rightPanel: { viewMode: 'tabs' },
        },
      } as any,
    });

    useAppStore.getState().setProjectData({
      left_panel_view_mode: 'tabs',
      right_panel_view_mode: 'split',
    });

    const state = useAppStore.getState();
    expect(state.leftPanelViewMode).toBe('split');
    expect(state.rightPanelViewMode).toBe('tabs');

    // Clean up
    useAppStore.setState({ isCustomUiMode: false, customUiConfig: null });
  });

  it('preserves generator node with baseline_waypoints, plugin_id, generator_params, and plugin_data on roundtrip', () => {
    const projectWithGenerator: StrictProjectData = {
      version: 1,
      root_node_ids: ['gen-1'],
      nodes: {
        'gen-1': {
          id: 'gen-1',
          type: 'generator',
          name: 'Sweep Path',
          plugin_id: 'sweep_offset_lines_generator',
          source_execution_id: 'exec-999',
          children_ids: ['child-1'],
          generator_params: {
            properties: { spacing: 1.5, angle: 45 },
            interaction_data: { start_point: { x: 5.0, y: 10.0 } },
          },
          plugin_data: {
            coverage_percentage: 98.4,
            metrics: { steps: 120 },
          },
          baseline_waypoints: [
            {
              name: 'Base WP 1',
              transform: { x: 5.0, y: 10.0, qx: 0, qy: 0, qz: 0, qw: 1 },
              options: { speed: 1.0 },
            },
          ],
          unknown_node_field: {
            deeply: { nested: true },
            arbitrary_list: [1, 2, 3],
          },
        } as any,
        'child-1': {
          id: 'child-1',
          type: 'manual',
          name: 'WP 1',
          transform: { x: 5.0, y: 10.0, qx: 0, qy: 0, qz: 0, qw: 1 },
          options: { speed: 1.0 },
          children_ids: [],
        },
      },
      map_layers: [],
      custom_layers: [],
      annotation_objects: [],
      annotation_groups: {},
      root_annotation_ids: [],
      export_regions: [],
      options_schema: null,
      export_templates: [],
      default_export_formats: DEFAULT_EXPORT_FORMATS,
      robot_footprint: DEFAULT_ROBOT_FOOTPRINT,
      occupancy_settings: DEFAULT_OCCUPANCY_SETTINGS,
      default_map_opacity: DEFAULT_MAP_OPACITY,
      left_panel_view_mode: 'tabs',
      right_panel_view_mode: 'tabs',
      active_path_calculator_plugin_id: null,
      path_calculator_params: {},
      auto_recalculate_path: true,
      path_color: '#3b82f6',
      path_width: 0.1,
      path_opacity: 0.7,
      sync_path_width_with_footprint: false,
      index_start_index: 0,
      decimal_precision: 6,
      custom_ui_data: {
        workflow_state: {
          current_step_index: 0,
          max_reached_step_index: 0,
          workflow_variables: {},
          step_execution_ids: {},
        },
      },
    };

    useAppStore.getState().setProjectData(projectWithGenerator);
    const roundtrip = buildProjectData(useAppStore.getState());

    const genNode = roundtrip.nodes['gen-1'] as any;
    expect(genNode).toBeDefined();
    expect(genNode.type).toBe('generator');
    expect(genNode.plugin_id).toBe('sweep_offset_lines_generator');
    expect(genNode.source_execution_id).toBe('exec-999');
    expect(genNode.generator_params).toEqual({
      properties: { spacing: 1.5, angle: 45 },
      interaction_data: { start_point: { x: 5.0, y: 10.0 } },
    });
    expect(genNode.plugin_data).toEqual({
      coverage_percentage: 98.4,
      metrics: { steps: 120 },
    });
    expect(genNode.baseline_waypoints).toEqual([
      {
        name: 'Base WP 1',
        transform: { x: 5.0, y: 10.0, qx: 0, qy: 0, qz: 0, qw: 1 },
        options: { speed: 1.0 },
      },
    ]);
    expect(genNode.unknown_node_field).toEqual({
      deeply: { nested: true },
      arbitrary_list: [1, 2, 3],
    });
  });
});
