import { describe, it, expect } from 'vitest';
import { extractPipelineParameters } from './pipelineParameterExtractor';
import { PluginInstance } from '../types/store';

describe('pipelineParameterExtractor', () => {
  const mockPlugin1: PluginInstance = {
    id: 'layer_gen',
    folder_path: '/plugins/layer_gen',
    is_builtin: true,
    manifest: {
      name: 'Layer Generator',
      type: 'python',
      executable: 'main.py',
      inputs: [
        { id: 'start_pos', name: 'start_pos', label: 'Start Position', type: 'point' },
        { id: 'area_rect', name: 'area_rect', label: 'Area Rect', type: 'rectangle' },
      ],
      properties: [
        { name: 'expansion', label: 'Expansion Rate', type: 'float', default: 1.5 },
        { name: 'invert', label: 'Invert Layer', type: 'boolean', default: false },
      ],
    },
  };

  const mockPlugin2: PluginInstance = {
    id: 'path_calc',
    folder_path: '/plugins/path_calc',
    is_builtin: true,
    manifest: {
      name: 'Path Calculator',
      type: 'python',
      executable: 'main.py',
      inputs: [
        { id: 'cost_layer', name: 'cost_layer', label: 'Cost Layer', type: 'custom_layer' },
        { id: 'goal_pos', name: 'goal_pos', label: 'Goal Position', type: 'point' },
      ],
      properties: [
        { name: 'tolerance', label: 'Goal Tolerance', type: 'float', default: 0.2 },
      ],
    },
  };

  const allPlugins: Record<string, PluginInstance> = {
    layer_gen: mockPlugin1,
    path_calc: mockPlugin2,
  };

  it('handles empty pipeline recipe gracefully', () => {
    const emptyPipeline: PluginInstance = {
      id: 'empty_pipe',
      folder_path: '/plugins/empty',
      is_builtin: false,
      manifest: {
        name: 'Empty Pipeline',
        type: 'pipeline',
        executable: '',
        inputs: [],
        properties: [],
      },
    };

    const setup = extractPipelineParameters(emptyPipeline, allPlugins);
    expect(setup.pipelineId).toBe('empty_pipe');
    expect(setup.manualInputs).toHaveLength(0);
    expect(setup.manualProperties).toHaveLength(0);
    expect(setup.errors).toHaveLength(0);
  });

  it('correctly filters out bound inputs and property overrides', () => {
    const pipeline: PluginInstance = {
      id: 'pipeline_1',
      folder_path: '/plugins/p1',
      is_builtin: false,
      manifest: {
        name: 'Test Pipeline',
        type: 'pipeline',
        executable: '',
        inputs: [],
        properties: [],
        pipeline: {
          steps: [
            {
              step_id: 'step_layer',
              plugin_id: 'layer_gen',
              name: 'Generate Cost Layer',
              property_overrides: {
                expansion: 3.0,
              },
              // start_pos and area_rect are NOT bound -> manual
            },
            {
              step_id: 'step_path',
              plugin_id: 'path_calc',
              name: 'Calculate Path',
              bindings: {
                'inputs.cost_layer': '$steps.step_layer.custom_layers[0]',
              },
              // cost_layer is bound -> NOT manual
              // goal_pos is NOT bound -> manual
            },
          ],
        },
      },
    };

    const setup = extractPipelineParameters(pipeline, allPlugins);

    expect(setup.errors).toHaveLength(0);
    expect(setup.missingPlugins).toHaveLength(0);

    // Manual inputs: start_pos and area_rect from step_layer, goal_pos from step_path
    expect(setup.manualInputs).toHaveLength(3);
    expect(setup.manualInputs.map((i) => `${i.stepId}.${i.inputId}`)).toEqual([
      'step_layer.start_pos',
      'step_layer.area_rect',
      'step_path.goal_pos',
    ]);

    // Manual properties:
    // step_layer has 'expansion' overridden to 3.0 -> excluded from manualProperties!
    // step_layer has 'invert' (default false) -> in manualProperties
    // step_path has 'tolerance' (default 0.2) -> in manualProperties
    expect(setup.manualProperties).toHaveLength(2);
    expect(setup.manualProperties.map((p) => `${p.stepId}.${p.propertyName}`)).toEqual([
      'step_layer.invert',
      'step_path.tolerance',
    ]);

    // Default properties should include the override for expansion
    expect(setup.defaultProperties['step_layer']['expansion']).toBe(3.0);
    expect(setup.defaultProperties['step_layer']['invert']).toBe(false);
    expect(setup.defaultProperties['step_path']['tolerance']).toBe(0.2);
  });

  it('supports binding keys without "inputs." prefix', () => {
    const pipeline: PluginInstance = {
      id: 'pipeline_2',
      folder_path: '/plugins/p2',
      is_builtin: false,
      manifest: {
        name: 'Direct Binding Pipeline',
        type: 'pipeline',
        executable: '',
        inputs: [],
        properties: [],
        pipeline: {
          steps: [
            {
              step_id: 'step_layer',
              plugin_id: 'layer_gen',
              bindings: {
                start_pos: 'pre_bound_point',
                'properties.invert': 'pre_bound_invert',
              },
            },
          ],
        },
      },
    };

    const setup = extractPipelineParameters(pipeline, allPlugins);

    // start_pos is bound -> only area_rect is manual
    expect(setup.manualInputs).toHaveLength(1);
    expect(setup.manualInputs[0].inputId).toBe('area_rect');

    // invert is bound -> only expansion is manual
    expect(setup.manualProperties).toHaveLength(1);
    expect(setup.manualProperties[0].propertyName).toBe('expansion');
  });

  it('records missing plugins as errors', () => {
    const pipeline: PluginInstance = {
      id: 'pipeline_missing',
      folder_path: '/plugins/pm',
      is_builtin: false,
      manifest: {
        name: 'Missing Plugin Pipeline',
        type: 'pipeline',
        executable: '',
        inputs: [],
        properties: [],
        pipeline: {
          steps: [
            {
              step_id: 'unknown_step',
              plugin_id: 'non_existent_plugin',
            },
          ],
        },
      },
    };

    const setup = extractPipelineParameters(pipeline, allPlugins);

    expect(setup.missingPlugins).toContain('non_existent_plugin');
    expect(setup.errors.length).toBeGreaterThan(0);
    expect(setup.errors[0]).toContain('non_existent_plugin');
  });

  it('uses canonical inp.name || inp.id for manual inputs when id and name differ', () => {
    const customPlugin: PluginInstance = {
      id: 'custom_differ',
      folder_path: '/plugins/cd',
      is_builtin: false,
      manifest: {
        name: 'Custom Differ Plugin',
        type: 'python',
        executable: 'main.py',
        inputs: [
          { id: 'input_uuid_1', name: 'target_goal', label: 'Target Goal', type: 'point' },
        ],
        properties: [],
      },
    };

    const pipeline: PluginInstance = {
      id: 'pipe_differ',
      folder_path: '/plugins/pd',
      is_builtin: false,
      manifest: {
        name: 'Differ Pipeline',
        type: 'pipeline',
        executable: '',
        inputs: [],
        properties: [],
        pipeline: {
          steps: [
            {
              step_id: 'step_goal',
              plugin_id: 'custom_differ',
            },
          ],
        },
      },
    };

    const setup = extractPipelineParameters(pipeline, { custom_differ: customPlugin });
    expect(setup.manualInputs).toHaveLength(1);
    expect(setup.manualInputs[0].inputId).toBe('target_goal');
  });

  it('records error for invalid step missing step_id or plugin_id', () => {
    const pipeline: PluginInstance = {
      id: 'pipe_invalid',
      folder_path: '/plugins/pi',
      is_builtin: false,
      manifest: {
        name: 'Invalid Step Pipeline',
        type: 'pipeline',
        executable: '',
        inputs: [],
        properties: [],
        pipeline: {
          steps: [
            { step_id: '', plugin_id: 'layer_gen' } as any,
          ],
        },
      },
    };

    const setup = extractPipelineParameters(pipeline, allPlugins);
    expect(setup.errors.length).toBeGreaterThan(0);
    expect(setup.errors[0]).toContain('missing step_id or plugin_id');
  });
});
