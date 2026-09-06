import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineInspector } from './PipelineInspector';
import { useAppStore } from '../../../stores/appStore';
import { PluginInstance } from '../../../types/store';
import { PipelineMetadata } from '../../../types/pipeline';

vi.mock('../../../stores/appStore', () => ({
  useAppStore: Object.assign(vi.fn(), {
    getState: vi.fn(),
    setState: vi.fn(),
    subscribe: vi.fn(),
  }),
}));

describe('PipelineInspector', () => {
  const mockPlugins: Record<string, PluginInstance> = {
    'step-1': {
      id: 'step-1',
      is_builtin: false,
      manifest: {
        name: 'Step 1 Layer Generator',
        type: 'python',
        executable: 'step1.py',
        inputs: [
          { id: 'roi', name: 'roi', label: 'ROI Region', type: 'rectangle' },
        ],
        properties: [
          { name: 'threshold', label: 'Threshold', type: 'number', default: 50 },
        ],
      },
      folder_path: '/path/1',
    },
    'step-2': {
      id: 'step-2',
      is_builtin: false,
      manifest: {
        name: 'Step 2 Sweep Planner',
        type: 'python',
        executable: 'step2.py',
        inputs: [
          { id: 'input_roi', name: 'input_roi', label: 'Input ROI', type: 'rectangle' },
        ],
        properties: [
          { name: 'num_lines', label: 'Num Lines', type: 'number', default: 6 },
        ],
      },
      folder_path: '/path/2',
    },
    'test-pipe': {
      id: 'test-pipe',
      is_builtin: false,
      manifest: {
        name: 'Sweep Pipeline',
        version: '1.0.0',
        description: 'Test pipeline description',
        type: 'pipeline',
        executable: '',
        inputs: [],
        properties: [],
        pipeline: {
          steps: [
            {
              step_id: 'step1',
              plugin_id: 'step-1',
              name: 'Noise Filter',
            },
            {
              step_id: 'step2',
              plugin_id: 'step-2',
              name: 'Sweep Path',
              bindings: {
                'inputs.input_roi': '$steps.step1.inputs.roi',
              },
            },
          ],
        },
      },
      folder_path: '/path/pipe',
    },
  };

  const mockMetadata: PipelineMetadata = {
    pipeline_id: 'test-pipe',
    pipeline_execution_id: 'exec-123',
    step_id: 'step1',
    step_execution_id: 'step-exec-1',
    pipeline_inputs: {
      step1: { roi: { x: 10, y: 20, width: 30, height: 40 } },
    },
    pipeline_properties: {
      step1: { threshold: 60 },
      step2: { num_lines: 8 },
    },
  };

  let mockStoreState: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStoreState = {
      plugins: mockPlugins,
      activePipelineInputRef: null,
      pluginInteractionData: {},
      decimalPrecision: 2,
      runWithLoading: vi.fn((_opts, fn) => fn()),
      setActivePipelineInputRef: vi.fn(),
      setActiveTool: vi.fn(),
      setActivePlugin: vi.fn(),
      executePipeline: vi.fn().mockResolvedValue({ success: true, pipelineExecutionId: 'exec-123' }),
      detachFromPipeline: vi.fn(),
      updatePluginInteractionData: vi.fn(),
      updateCustomLayer: vi.fn(),
      customLayers: [
        {
          id: 'layer-1',
          name: 'Noise Filter Layer',
          type: 'plugin',
          opacity: 0.7,
          blend_mode: 'overwrite',
          is_reference: false,
          pipeline_metadata: {
            pipeline_id: 'test-pipe',
            pipeline_execution_id: 'exec-123',
            step_id: 'step1',
            step_execution_id: 'step-exec-1',
          },
        },
      ],
      nodes: {
        'node-1': {
          id: 'node-1',
          type: 'generator',
          name: 'Sweep Path Group',
          pipeline_metadata: {
            pipeline_id: 'test-pipe',
            pipeline_execution_id: 'exec-123',
            step_id: 'step2',
            step_execution_id: 'step-exec-2',
          },
        },
      },
      annotationGroups: {},
    };

    (useAppStore as any).mockImplementation((selector: any) => selector(mockStoreState));
    (useAppStore.getState as any).mockReturnValue(mockStoreState);
  });

  it('renders pipeline header, steps, and output summary', () => {
    render(<PipelineInspector pipelineMetadata={mockMetadata} targetCustomLayerId="layer-1" />);

    expect(screen.getByText('Sweep Pipeline')).toBeDefined();
    expect(screen.getByText('Pipeline Instance')).toBeDefined();
    expect(screen.getByText('Noise Filter')).toBeDefined();
    expect(screen.getByText('Sweep Path')).toBeDefined();
    expect(screen.getByText(/1 layer\(s\)/)).toBeDefined();
    expect(screen.getByText(/1 waypoint group\(s\)/)).toBeDefined();
  });

  it('triggers executePipeline with snapshots and existingExecutionId on re-generate click', async () => {
    render(<PipelineInspector pipelineMetadata={mockMetadata} targetCustomLayerId="layer-1" />);

    const regenButton = screen.getByRole('button', { name: /Re-generate Pipeline/i });
    fireEvent.click(regenButton);

    await waitFor(() => {
      expect(mockStoreState.executePipeline).toHaveBeenCalledWith({
        pipelinePlugin: mockPlugins['test-pipe'],
        manualInputs: expect.objectContaining({
          step1: { roi: { x: 10, y: 20, width: 30, height: 40 } },
        }),
        manualProperties: expect.objectContaining({
          step1: { threshold: 60 },
          step2: { num_lines: 8 },
        }),
        existingExecutionId: 'exec-123',
      });
    });
  });

  it('calls detachFromPipeline when Detach is confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<PipelineInspector pipelineMetadata={mockMetadata} targetCustomLayerId="layer-1" />);

    const detachButton = screen.getByRole('button', { name: /Detach/i });
    fireEvent.click(detachButton);

    expect(mockStoreState.detachFromPipeline).toHaveBeenCalledWith({
      nodeId: undefined,
      customLayerId: 'layer-1',
      annotationGroupId: undefined,
    });
  });

  it('renders target custom layer settings and allows modifying opacity, blend mode, and reference', () => {
    render(<PipelineInspector pipelineMetadata={mockMetadata} targetCustomLayerId="layer-1" />);

    // Shows layer title and settings section
    expect(screen.getByText('Layer: Noise Filter Layer')).toBeDefined();
    expect(screen.getByText('Active Layer')).toBeDefined();
    expect(screen.getByText('Reference Layer')).toBeDefined();
    expect(screen.getByText('Opacity')).toBeDefined();
    expect(screen.getByText('Blend Mode')).toBeDefined();

    // Toggle Reference Layer checkbox
    const refCheckbox = screen.getByRole('checkbox');
    fireEvent.click(refCheckbox);
    expect(mockStoreState.updateCustomLayer).toHaveBeenCalledWith('layer-1', { is_reference: true });

    // Change layer name
    const nameInput = screen.getByDisplayValue('Noise Filter Layer');
    fireEvent.change(nameInput, { target: { value: 'Renamed Mask Layer' } });
    expect(mockStoreState.updateCustomLayer).toHaveBeenCalledWith('layer-1', { name: 'Renamed Mask Layer' });
  });
});
