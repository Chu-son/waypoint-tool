import { describe, it, expect } from 'vitest';
import { StrictProjectData } from '../../types/store';
import {
  migrateAndNormalizeProjectData,
  createDefaultProjectData,
  DEFAULT_ROBOT_FOOTPRINT,
  DEFAULT_OCCUPANCY_SETTINGS,
  DEFAULT_MAP_OPACITY,
  DEFAULT_EXPORT_FORMATS,
} from './projectMigration';

describe('projectMigration', () => {
  it('handles empty / null / undefined / non-object inputs safely', () => {
    const defaultData = createDefaultProjectData();
    expect(migrateAndNormalizeProjectData(null)).toEqual(defaultData);
    expect(migrateAndNormalizeProjectData(undefined)).toEqual(defaultData);
    expect(migrateAndNormalizeProjectData('')).toEqual(defaultData);
    expect(migrateAndNormalizeProjectData(123)).toEqual(defaultData);
    expect(defaultData.version).toBe(1);
    expect(defaultData.root_node_ids).toEqual([]);
    expect(defaultData.robot_footprint).toEqual(DEFAULT_ROBOT_FOOTPRINT);
    expect(defaultData.occupancy_settings).toEqual(DEFAULT_OCCUPANCY_SETTINGS);
    expect(defaultData.default_map_opacity).toBe(DEFAULT_MAP_OPACITY);
    expect(defaultData.default_export_formats).toEqual(DEFAULT_EXPORT_FORMATS);
  });

  it('migrates legacy v0 project with edit_layers and generated_layers to custom_layers', () => {
    const v0Data = {
      root_node_ids: ['node-1'],
      nodes: {
        'node-1': { id: 'node-1', type: 'manual', name: 'WP 1' },
      },
      edit_layers: [
        {
          id: 'manual-1',
          name: 'Manual Edit Layer',
          visible: true,
          opacity: 0.9,
          z_index: 2,
          editObjects: [{ id: 'rect-1', type: 'rect' }],
        },
      ],
      generated_layers: [
        {
          id: 'gen-1',
          name: 'Plugin Layer',
          plugin_id: 'test-plugin',
          z_index: 0,
          opacity: 0.8,
        },
      ],
    };

    const normalized = migrateAndNormalizeProjectData(v0Data);
    expect(normalized.version).toBe(1);
    expect(normalized.custom_layers).toHaveLength(2);
    // Should be sorted by original z_index and reindexed to 0, 1
    expect(normalized.custom_layers[0].id).toBe('gen-1');
    expect(normalized.custom_layers[0].type).toBe('plugin');
    expect(normalized.custom_layers[0].z_index).toBe(0);
    expect(normalized.custom_layers[1].id).toBe('manual-1');
    expect(normalized.custom_layers[1].type).toBe('manual');
    expect(normalized.custom_layers[1].z_index).toBe(1);
    expect((normalized.custom_layers[1] as any).editObjects).toHaveLength(1);
  });

  it('promotes default_export_formats string array to object array', () => {
    const legacyFormats = {
      default_export_formats: ['yaml', '.json'],
    };

    const normalized = migrateAndNormalizeProjectData(legacyFormats);
    expect(normalized.default_export_formats).toEqual([
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
  });

  it('deeply merges partially missing occupancy_settings and robot_footprint', () => {
    const partialData = {
      robot_footprint: {
        radius: 0.5,
      },
      occupancy_settings: {
        defaultOccupiedThresh: 0.8,
      },
    };

    const normalized = migrateAndNormalizeProjectData(partialData);
    expect(normalized.robot_footprint).toEqual({
      type: 'circular',
      radius: 0.5,
    });
    expect(normalized.occupancy_settings).toEqual({
      defaultOccupiedThresh: 0.8,
      defaultFreeThresh: 0.196,
      defaultNegate: 0,
    });
  });

  it('preserves falsy values like 0 or false without overwriting with defaults', () => {
    const dataWithFalsy = {
      index_start_index: 0,
      decimal_precision: 0,
      auto_recalculate_path: false,
      sync_path_width_with_footprint: false,
      default_map_opacity: 0,
    };

    const normalized = migrateAndNormalizeProjectData(dataWithFalsy);
    expect(normalized.index_start_index).toBe(0);
    expect(normalized.decimal_precision).toBe(0);
    expect(normalized.auto_recalculate_path).toBe(false);
    expect(normalized.sync_path_width_with_footprint).toBe(false);
    expect(normalized.default_map_opacity).toBe(0);
  });

  it('normalizes camelCase keys to snake_case', () => {
    const camelData = {
      rootNodeIds: ['n1'],
      mapLayers: [
        {
          id: 'ml1',
          name: 'Map 1',
          imageBase64: 'b64string',
          width: 500,
          height: 500,
        },
      ],
      annotationObjects: [
        { id: 'ann-1', name: 'Point Ann' },
      ],
      leftPanelViewMode: 'split',
      rightPanelViewMode: 'tabs',
      activePathCalculatorPluginId: 'plug-1',
      pathCalculatorParams: { step: 1 },
      autoRecalculatePath: false,
      pathColor: '#ff0000',
      pathWidth: 0.3,
      pathOpacity: 0.5,
      syncPathWidthWithFootprint: true,
      indexStartIndex: 1,
      decimalPrecision: 4,
    };

    const normalized = migrateAndNormalizeProjectData(camelData);
    expect(normalized.root_node_ids).toEqual(['n1']);
    expect(normalized.map_layers[0].image_base64).toBe('b64string');
    expect(normalized.annotation_objects[0].id).toBe('ann-1');
    expect(normalized.left_panel_view_mode).toBe('split');
    expect(normalized.right_panel_view_mode).toBe('tabs');
    expect(normalized.active_path_calculator_plugin_id).toBe('plug-1');
    expect(normalized.path_calculator_params).toEqual({ step: 1 });
    expect(normalized.auto_recalculate_path).toBe(false);
    expect(normalized.path_color).toBe('#ff0000');
    expect(normalized.path_width).toBe(0.3);
    expect(normalized.path_opacity).toBe(0.5);
    expect(normalized.sync_path_width_with_footprint).toBe(true);
    expect(normalized.index_start_index).toBe(1);
    expect(normalized.decimal_precision).toBe(4);
  });

  it('normalizes legacy top-level workflow_state and custom_ui_data.workflow_state', () => {
    // 1. Top-level workflow_state
    const legacyWorkflow = {
      workflow_state: {
        current_step_index: 2,
        max_reached_step_index: 3,
        workflow_variables: { count: 10 },
        step_execution_ids: { s1: 'exec-1' },
      },
    };
    const norm1 = migrateAndNormalizeProjectData(legacyWorkflow);
    expect(norm1.custom_ui_data.workflow_state).toEqual({
      current_step_index: 2,
      max_reached_step_index: 3,
      workflow_variables: { count: 10 },
      step_execution_ids: { s1: 'exec-1' },
    });

    // 2. custom_ui_data.workflow_state with camelCase
    const customUiWorkflow = {
      custom_ui_data: {
        theme: 'dark',
        workflow_state: {
          currentStepIndex: 1,
          maxReachedStepIndex: 2,
          workflowVariables: { flag: true },
          stepExecutionIds: { s2: 'exec-2' },
        },
      },
    };
    const norm2 = migrateAndNormalizeProjectData(customUiWorkflow);
    expect(norm2.custom_ui_data.theme).toBe('dark');
    expect(norm2.custom_ui_data.workflow_state).toEqual({
      current_step_index: 1,
      max_reached_step_index: 2,
      workflow_variables: { flag: true },
      step_execution_ids: { s2: 'exec-2' },
    });
  });

  it('handles annotation_objects when given as an object map', () => {
    const dataWithMap = {
      annotation_objects: {
        'ann-1': { id: 'ann-1', name: 'Ann 1' },
        'ann-2': { id: 'ann-2', name: 'Ann 2' },
      },
    };
    const normalized = migrateAndNormalizeProjectData(dataWithMap);
    expect(normalized.annotation_objects).toHaveLength(2);
    expect(normalized.annotation_objects.map((a) => a.id)).toEqual(['ann-1', 'ann-2']);
    expect(normalized.root_annotation_ids).toEqual(['ann-1', 'ann-2']);
  });

  it('fully populates all 27 StrictProjectData fields when input is { version: 1 } without crashing', () => {
    const incompleteV1 = { version: 1 };
    let normalized: any;
    expect(() => {
      normalized = migrateAndNormalizeProjectData(incompleteV1);
    }).not.toThrow();

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

    expect(Object.keys(normalized).sort()).toEqual(expectedKeys.sort());
    expect(normalized.version).toBe(1);
    expect(normalized.root_node_ids).toEqual([]);
    expect(normalized.nodes).toEqual({});
    expect(normalized.map_layers).toEqual([]);
    expect(normalized.custom_layers).toEqual([]);
    expect(normalized.annotation_objects).toEqual([]);
    expect(normalized.annotation_groups).toEqual({});
    expect(normalized.root_annotation_ids).toEqual([]);
    expect(normalized.export_regions).toEqual([]);
    expect(normalized.options_schema).toBeNull();
    expect(normalized.export_templates).toEqual([]);
    expect(normalized.default_export_formats).toEqual(DEFAULT_EXPORT_FORMATS);
    expect(normalized.robot_footprint).toEqual(DEFAULT_ROBOT_FOOTPRINT);
    expect(normalized.occupancy_settings).toEqual(DEFAULT_OCCUPANCY_SETTINGS);
    expect(normalized.default_map_opacity).toBe(DEFAULT_MAP_OPACITY);
    expect(normalized.left_panel_view_mode).toBe('tabs');
    expect(normalized.right_panel_view_mode).toBe('tabs');
    expect(normalized.active_path_calculator_plugin_id).toBeNull();
    expect(normalized.path_calculator_params).toEqual({});
    expect(normalized.auto_recalculate_path).toBe(true);
    expect(normalized.path_width).toBe(0.1);
    expect(normalized.path_opacity).toBe(0.7);
    expect(normalized.sync_path_width_with_footprint).toBe(false);
    expect(normalized.index_start_index).toBe(0);
    expect(normalized.decimal_precision).toBe(6);
    expect(normalized.custom_ui_data).toEqual({});
  });

  it('does not leave radius property when footprint is rectangular or polygon', () => {
    const rectangularData = {
      robot_footprint: {
        type: 'rectangular',
        length: 1.0,
        width: 0.5,
        radius: 0.3, // spurious radius
      },
    };
    const normRect = migrateAndNormalizeProjectData(rectangularData);
    expect(normRect.robot_footprint.type).toBe('rectangular');
    expect(normRect.robot_footprint).toEqual({
      type: 'rectangular',
      length: 1.0,
      width: 0.5,
    });
    expect('radius' in normRect.robot_footprint).toBe(false);

    const polygonData = {
      robot_footprint: {
        type: 'polygon',
        points: [[0, 0], [1, 0], [0, 1]],
        radius: 0.5, // spurious radius
      },
    };
    const normPoly = migrateAndNormalizeProjectData(polygonData);
    expect(normPoly.robot_footprint.type).toBe('polygon');
    expect('radius' in normPoly.robot_footprint).toBe(false);
  });

  it('resolves and cleans up camelCase workflowState without leaving duplicate keys', () => {
    const camelWorkflowData = {
      custom_ui_data: {
        workflowState: {
          currentStepIndex: 3,
          maxReachedStepIndex: 4,
          workflowVariables: { testKey: 'val' },
          stepExecutionIds: { step1: 'exec-1' },
        },
        otherParam: 123,
      },
    };
    const normalized = migrateAndNormalizeProjectData(camelWorkflowData);
    expect(normalized.custom_ui_data.workflow_state).toEqual({
      current_step_index: 3,
      max_reached_step_index: 4,
      workflow_variables: { testKey: 'val' },
      step_execution_ids: { step1: 'exec-1' },
    });
    expect(normalized.custom_ui_data.otherParam).toBe(123);
    expect('workflowState' in normalized.custom_ui_data).toBe(false);
  });

  it('normalizes index_start_index strictly to 0 | 1', () => {
    expect(migrateAndNormalizeProjectData({ index_start_index: 1 }).index_start_index).toBe(1);
    expect(migrateAndNormalizeProjectData({ index_start_index: 0 }).index_start_index).toBe(0);
    expect(migrateAndNormalizeProjectData({ index_start_index: 99 }).index_start_index).toBe(0);
    expect(migrateAndNormalizeProjectData({ indexStartIndex: 1 }).index_start_index).toBe(1);
  });

  it('safely handles non-array values for array properties without throwing', () => {
    const corruptData = {
      root_node_ids: 'not an array',
      map_layers: { not: 'array' },
      custom_layers: 'string',
      annotation_objects: 123,
      root_annotation_ids: true,
      export_regions: null,
      export_templates: false,
      default_export_formats: 456,
    };
    expect(() => migrateAndNormalizeProjectData(corruptData)).not.toThrow();
    const normalized = migrateAndNormalizeProjectData(corruptData);
    expect(Array.isArray(normalized.root_node_ids)).toBe(true);
    expect(Array.isArray(normalized.map_layers)).toBe(true);
    expect(Array.isArray(normalized.custom_layers)).toBe(true);
    expect(Array.isArray(normalized.annotation_objects)).toBe(true);
    expect(Array.isArray(normalized.root_annotation_ids)).toBe(true);
    expect(Array.isArray(normalized.export_regions)).toBe(true);
    expect(Array.isArray(normalized.export_templates)).toBe(true);
    expect(Array.isArray(normalized.default_export_formats)).toBe(true);
  });

  it('infers plugin_id for generator nodes from child options.generated_by if missing', () => {
    const rawData = {
      root_node_ids: ['gen-1'],
      nodes: {
        'gen-1': {
          id: 'gen-1',
          type: 'generator',
          children_ids: ['child-1', 'child-2'],
        },
        'child-1': {
          id: 'child-1',
          type: 'manual',
          options: {
            generated_by: 'my-custom-plugin',
          },
        },
        'child-2': {
          id: 'child-2',
          type: 'manual',
          options: {
            generated_by: 'my-custom-plugin',
          },
        },
      },
    };

    const normalized = migrateAndNormalizeProjectData(rawData);
    expect(normalized.nodes['gen-1'].plugin_id).toBe('my-custom-plugin');
  });
});
