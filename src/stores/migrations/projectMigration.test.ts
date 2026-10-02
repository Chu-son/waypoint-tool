import { describe, it, expect } from 'vitest';
import { StrictProjectData } from '../../types/store';
import {
  migrateAndNormalizeProjectData,
  createDefaultProjectData,
  DEFAULT_ROBOT_FOOTPRINT,
  DEFAULT_OCCUPANCY_SETTINGS,
  DEFAULT_MAP_OPACITY,
  DEFAULT_EXPORT_FORMATS,
  DEFAULT_CONDITIONAL_STYLES,
  DEFAULT_CONDITIONAL_STYLES_ENABLED,
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
    expect(defaultData.conditional_styles).toEqual(DEFAULT_CONDITIONAL_STYLES);
    expect(defaultData.conditional_styles_enabled).toBe(DEFAULT_CONDITIONAL_STYLES_ENABLED);
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
    // Should be ordered by the original z_index, and the stacking order now lives in layer_order
    expect(normalized.custom_layers[0].id).toBe('gen-1');
    expect(normalized.custom_layers[0].type).toBe('plugin');
    expect(normalized.custom_layers[1].id).toBe('manual-1');
    expect(normalized.custom_layers[1].type).toBe('manual');
    expect(normalized.layer_order).toEqual(['gen-1', 'manual-1']);
    expect(normalized.custom_layers[0]).not.toHaveProperty('z_index');
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
      annotationObjects: [{ id: 'ann-1', name: 'Point Ann' }],
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
    expect(normalized.map_sources[0].image_base64).toBe('b64string');
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

  it('fully populates all 33 StrictProjectData fields when input is { version: 1 } without crashing', () => {
    const incompleteV1 = { version: 1 };
    let normalized: any;
    expect(() => {
      normalized = migrateAndNormalizeProjectData(incompleteV1);
    }).not.toThrow();

    const expectedKeys: (keyof StrictProjectData)[] = [
      'version',
      'root_node_ids',
      'nodes',
      'map_sources',
      'map_layers',
      'layer_order',
      'custom_layers',
      'annotation_objects',
      'annotation_groups',
      'root_annotation_ids',
      'export_regions',
      'layer_visibility_sets',
      'active_layer_visibility_set_id',
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
      'export_integers_as_float',
      'decimal_precision',
      'conditional_styles',
      'conditional_styles_enabled',
      'export_profiles',
      'active_export_profile_id',
      'geo_map',
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
        points: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
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

  it('defaults export_integers_as_float to true for projects saved before the setting existed', () => {
    expect(migrateAndNormalizeProjectData({}).export_integers_as_float).toBe(true);
    expect(migrateAndNormalizeProjectData({ export_integers_as_float: true }).export_integers_as_float).toBe(true);
    expect(migrateAndNormalizeProjectData({ export_integers_as_float: false }).export_integers_as_float).toBe(false);
    expect(migrateAndNormalizeProjectData({ exportIntegersAsFloat: false }).export_integers_as_float).toBe(false);
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
    expect(normalized.nodes['gen-1'].plugin_id).toBe('my_custom_plugin');
  });

  it('unconditionally normalizes generator plugin_id and handles CamelCase/acronyms', () => {
    const rawData = {
      root_node_ids: ['gen-1', 'gen-2', 'gen-3'],
      nodes: {
        'gen-1': {
          id: 'gen-1',
          type: 'generator',
          plugin_id: 'SweepOffsetLinesGenerator',
        },
        'gen-2': {
          id: 'gen-2',
          type: 'generator',
          plugin_id: 'SweepGeneratorRS',
        },
        'gen-3': {
          id: 'gen-3',
          type: 'generator',
          children_ids: ['child-3'],
        },
        'child-3': {
          id: 'child-3',
          type: 'manual',
          options: {
            generated_by: 'SweepOffsetLinesGenerator',
          },
        },
      },
    };

    const normalized = migrateAndNormalizeProjectData(rawData);
    expect(normalized.nodes['gen-1'].plugin_id).toBe('sweep_offset_lines_generator');
    expect(normalized.nodes['gen-2'].plugin_id).toBe('sweep_generator_rs');
    expect(normalized.nodes['gen-3'].plugin_id).toBe('sweep_offset_lines_generator');
  });

  it('normalizes map layer origin and initial_origin properly', () => {
    const rawData = {
      map_layers: [
        {
          id: 'map-1',
          name: 'Map 1',
          info: {
            origin: [1.5, 2.5, 0.1],
          },
        },
        {
          id: 'map-2',
          name: 'Map 2',
          info: {
            origin: [5.0, 5.0, 0.0],
            initial_origin: [0.0, 0.0, 0.0],
          },
        },
        {
          id: 'map-3',
          name: 'Map 3',
          info: {},
        },
      ],
    };

    const normalized = migrateAndNormalizeProjectData(rawData);
    expect(normalized.map_layers).toHaveLength(3);
    expect(normalized.map_sources).toHaveLength(3);

    // Map 1: initial_origin should be copied from origin if missing
    expect(normalized.map_sources[0].info.origin).toEqual([1.5, 2.5, 0.1]);
    expect(normalized.map_sources[0].info.initial_origin).toEqual([1.5, 2.5, 0.1]);

    // Map 2: initial_origin should be preserved if already present
    expect(normalized.map_sources[1].info.origin).toEqual([5.0, 5.0, 0.0]);
    expect(normalized.map_sources[1].info.initial_origin).toEqual([0.0, 0.0, 0.0]);

    // Map 3: fallback to [0, 0, 0]
    expect(normalized.map_sources[2].info.origin).toEqual([0, 0, 0]);
    expect(normalized.map_sources[2].info.initial_origin).toEqual([0, 0, 0]);
  });

  describe('map layer stack', () => {
    const legacyMap = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      name: id,
      info: { resolution: 0.05, origin: [1, 2, 0] },
      image_base64: `img-${id}`,
      width: 10,
      height: 20,
      visible: true,
      opacity: 0.7,
      ...extra,
    });

    it('splits each map of an older project into a source and one instance that keeps the old layer id', () => {
      const normalized = migrateAndNormalizeProjectData({
        map_layers: [legacyMap('m1', { blend_mode: 'merge_free' }), legacyMap('m2', { visible: false })],
      });

      expect(normalized.map_sources.map((s) => s.image_base64)).toEqual(['img-m1', 'img-m2']);
      expect(normalized.map_layers.map((l) => l.id)).toEqual(['m1', 'm2']);
      expect(normalized.map_layers[0]).toMatchObject({
        sourceId: normalized.map_sources[0].id,
        opacity: 0.7,
        blend_mode: 'merge_free',
        clip: null,
      });
      expect(normalized.map_layers[1].visible).toBe(false);
      expect(normalized.map_layers[0]).not.toHaveProperty('z_index');
    });

    it('keeps the replace blend mode and falls back to overwrite for an unknown one', () => {
      const normalized = migrateAndNormalizeProjectData({
        map_layers: [legacyMap('m1', { blend_mode: 'replace' }), legacyMap('m2', { blend_mode: 'bogus' })],
      });

      expect(normalized.map_layers.map((l) => l.blend_mode)).toEqual(['replace', 'overwrite']);
    });

    it('keeps custom layers above every map when reading an older project', () => {
      const normalized = migrateAndNormalizeProjectData({
        map_layers: [legacyMap('m1'), legacyMap('m2')],
        custom_layers: [
          { id: 'c-low', type: 'manual', name: 'low', visible: true, opacity: 1, z_index: 1, editObjects: [] },
          { id: 'c-high', type: 'manual', name: 'high', visible: true, opacity: 1, z_index: 0, editObjects: [] },
        ],
      });

      expect(normalized.layer_order).toEqual(['c-high', 'c-low', 'm1', 'm2']);
    });

    it('reads instances, their clips and the stacking order back from a current project', () => {
      const normalized = migrateAndNormalizeProjectData({
        map_sources: [
          {
            id: 's1',
            name: 'Warehouse',
            info: { resolution: 0.05, origin: [0, 0, 0] },
            image_base64: 'img',
            width: 10,
            height: 10,
          },
        ],
        map_layers: [
          {
            id: 'left',
            sourceId: 's1',
            name: 'Left',
            visible: true,
            opacity: 1,
            blend_mode: 'overwrite',
            clip: { rects: [{ x: 0, y: 0, width: 2, height: 4 }] },
          },
          {
            id: 'right',
            sourceId: 's1',
            name: 'Right',
            visible: true,
            opacity: 1,
            blend_mode: 'overwrite',
            clip: null,
          },
        ],
        custom_layers: [{ id: 'wall', type: 'manual', name: 'Wall', visible: true, opacity: 1, editObjects: [] }],
        layer_order: ['left', 'wall', 'right'],
      });

      expect(normalized.map_sources).toHaveLength(1);
      expect(normalized.map_layers.map((l) => l.sourceId)).toEqual(['s1', 's1']);
      expect(normalized.map_layers[0].clip).toEqual({ rects: [{ x: 0, y: 0, width: 2, height: 4 }] });
      expect(normalized.layer_order).toEqual(['left', 'wall', 'right']);
    });

    it('repairs a stacking order that lists unknown layers or forgets existing ones', () => {
      const normalized = migrateAndNormalizeProjectData({
        map_sources: [{ id: 's1', name: 'M', info: {}, image_base64: '', width: 1, height: 1 }],
        map_layers: [
          { id: 'a', sourceId: 's1' },
          { id: 'b', sourceId: 's1' },
        ],
        layer_order: ['b', 'ghost'],
      });

      expect(normalized.layer_order).toEqual(['a', 'b']);
    });

    it('drops instances of a missing source and sources nobody uses', () => {
      const normalized = migrateAndNormalizeProjectData({
        map_sources: [
          { id: 's1', name: 'Used', info: {}, image_base64: '', width: 1, height: 1 },
          { id: 's2', name: 'Unused', info: {}, image_base64: '', width: 1, height: 1 },
        ],
        map_layers: [
          { id: 'ok', sourceId: 's1' },
          { id: 'orphan', sourceId: 'missing' },
        ],
      });

      expect(normalized.map_layers.map((l) => l.id)).toEqual(['ok']);
      expect(normalized.map_sources.map((s) => s.id)).toEqual(['s1']);
    });

    it('ignores malformed clip rectangles and treats a clip without any valid one as no clip', () => {
      const normalized = migrateAndNormalizeProjectData({
        map_sources: [{ id: 's1', name: 'M', info: {}, image_base64: '', width: 1, height: 1 }],
        map_layers: [
          {
            id: 'a',
            sourceId: 's1',
            clip: {
              rects: [
                { x: 0, y: 0, width: 1, height: 1 },
                { x: 'bad', y: 0, width: 1, height: 1 },
              ],
            },
          },
          { id: 'b', sourceId: 's1', clip: { rects: [{ x: 0, y: 0, width: -1, height: 1 }] } },
        ],
      });

      expect(normalized.map_layers[0].clip).toEqual({ rects: [{ x: 0, y: 0, width: 1, height: 1 }] });
      expect(normalized.map_layers[1].clip).toBeNull();
    });
  });

  describe('layer visibility sets', () => {
    const layers = {
      map_sources: [{ id: 's1', name: 'a', info: {}, image_base64: '', width: 1, height: 1 }],
      map_layers: [{ id: 'map', sourceId: 's1', name: 'a', visible: true, opacity: 1, blend_mode: 'overwrite' }],
      custom_layers: [{ id: 'wall', name: 'Wall', type: 'manual', visible: true, opacity: 1, editObjects: [] }],
    };

    it('gives a project saved before visibility sets existed none', () => {
      const normalized = migrateAndNormalizeProjectData({ version: 1, ...layers });

      expect(normalized.layer_visibility_sets).toEqual([]);
      expect(normalized.active_layer_visibility_set_id).toBeNull();
    });

    it('keeps the sets of a current project', () => {
      const sets = [{ id: 'v1', name: 'Localization', visibility: { map: true, wall: false } }];

      const normalized = migrateAndNormalizeProjectData({
        version: 1,
        ...layers,
        layer_visibility_sets: sets,
        active_layer_visibility_set_id: 'v1',
      });

      expect(normalized.layer_visibility_sets).toEqual(sets);
      expect(normalized.active_layer_visibility_set_id).toBe('v1');
    });

    it('drops entries for layers that no longer exist and values that are not on/off', () => {
      const normalized = migrateAndNormalizeProjectData({
        version: 1,
        ...layers,
        layer_visibility_sets: [{ id: 'v1', name: 'Nav', visibility: { map: true, gone: true, wall: 'yes' } }],
      });

      expect(normalized.layer_visibility_sets[0].visibility).toEqual({ map: true });
    });

    it('repairs sets that are missing an id or a name, and ignores an active id that points nowhere', () => {
      const normalized = migrateAndNormalizeProjectData({
        version: 1,
        ...layers,
        layer_visibility_sets: [null, { visibility: { map: false } }],
        active_layer_visibility_set_id: 'missing',
      });

      expect(normalized.layer_visibility_sets).toHaveLength(1);
      expect(normalized.layer_visibility_sets[0].id).toEqual(expect.any(String));
      expect(normalized.layer_visibility_sets[0].name).not.toBe('');
      expect(normalized.active_layer_visibility_set_id).toBeNull();
    });
  });

  describe('export item map list', () => {
    const normalizeItem = (extra: Record<string, unknown>) =>
      migrateAndNormalizeProjectData({
        version: 1,
        export_profiles: [
          {
            id: 'p',
            name: 'P',
            items: [
              { id: 'i', type: 'map_all_regions', sourceId: 'all', relativePathPattern: 'Map/{{name}}.pgm', ...extra },
            ],
          },
        ],
      }).export_profiles[0].items[0];

    it('keeps the list setting of a map item', () => {
      const item = normalizeItem({ mapList: { fileName: 'map_list.txt', existing: 'conflict_setting' } });

      expect(item.mapList).toEqual({ fileName: 'map_list.txt', existing: 'conflict_setting' });
    });

    it('appends to an existing list unless told otherwise', () => {
      expect(normalizeItem({ mapList: { fileName: 'map_list.txt' } }).mapList?.existing).toBe('append');
      expect(normalizeItem({ mapList: { fileName: 'map_list.txt', existing: 'bogus' } }).mapList?.existing).toBe(
        'append',
      );
    });

    it('writes no list for a project saved before the setting existed, or one with a blank name', () => {
      expect(normalizeItem({}).mapList).toBeUndefined();
      expect(normalizeItem({ mapList: { fileName: '  ', existing: 'append' } }).mapList).toBeUndefined();
      expect(normalizeItem({ mapList: 'map_list.txt' }).mapList).toBeUndefined();
    });
  });

  describe('option schema globals', () => {
    const globals = [{ name: 'default_speed', label: 'Default Speed', type: 'float', value: 0.5 }];

    it('adds an empty globals list to a project saved before global fields existed', () => {
      const normalized = migrateAndNormalizeProjectData({
        version: 1,
        options_schema: { options: [{ name: 'speed', label: 'Speed', type: 'float' }] },
      });

      expect(normalized.options_schema?.options).toHaveLength(1);
      expect(normalized.options_schema?.globals).toEqual([]);
    });

    it('keeps the global fields and their values of a current project', () => {
      const normalized = migrateAndNormalizeProjectData({ version: 1, options_schema: { options: [], globals } });

      expect(normalized.options_schema?.globals).toEqual(globals);
    });

    it('reads the schema from a camelCase optionsSchema key too', () => {
      const normalized = migrateAndNormalizeProjectData({ version: 1, optionsSchema: { options: [], globals } });

      expect(normalized.options_schema?.globals).toEqual(globals);
    });
  });

  it('preserves conditional_styles and normalizes annotation options', () => {
    const rawData = {
      conditional_styles: [
        {
          id: 'rule-1',
          name: 'Fast Speed Red',
          targetElement: 'waypoint',
          enabled: true,
          stopIfMatched: false,
          condition: {
            id: 'g-1',
            type: 'group',
            logicalOperator: 'and',
            children: [
              {
                id: 'r-1',
                type: 'rule',
                property: 'options.speed',
                operator: 'greater_than',
                value: 1.5,
              },
            ],
          },
          style: {
            waypoint: {
              color: '#FF0000',
              shape: 'star',
            },
          },
        },
      ],
      conditional_styles_enabled: false,
      annotation_objects: [
        {
          id: 'ann-1',
          name: 'Zone A',
          type: 'rect',
          visible: true,
          labelVisible: true,
          options: { zone_type: 'danger' },
        },
        {
          id: 'ann-2',
          name: 'Point B',
          type: 'point',
          visible: true,
          labelVisible: false,
          // options missing
        },
      ],
    };

    const normalized = migrateAndNormalizeProjectData(rawData);
    expect(normalized.conditional_styles).toHaveLength(1);
    expect(normalized.conditional_styles[0].name).toBe('Fast Speed Red');
    expect(normalized.conditional_styles_enabled).toBe(false);

    expect(normalized.annotation_objects).toHaveLength(2);
    expect(normalized.annotation_objects[0].options).toEqual({ zone_type: 'danger' });
    expect(normalized.annotation_objects[1].options).toEqual({});
  });
});
