import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineSetupView } from './PipelineSetupView';
import { useAppStore } from '../../../stores/appStore';
import { PluginInstance } from '../../../types/store';

// Mock the store
vi.mock('../../../stores/appStore', () => ({
  useAppStore: Object.assign(vi.fn(), {
    getState: vi.fn(),
    setState: vi.fn(),
    subscribe: vi.fn(),
  }),
}));

describe('PipelineSetupView', () => {
  const mockPlugins: Record<string, PluginInstance> = {
    'step-plugin-1': {
      id: 'step-plugin-1',
      is_builtin: false,
      manifest: {
        name: 'Step 1 Generator',
        type: 'python',
        executable: 'step1.py',
        inputs: [
          { id: 'start_point', name: 'start_point', label: 'Start Point', type: 'point', required: true },
        ],
        properties: [
          { name: 'speed', label: 'Speed', type: 'number', default: 1.5 },
        ],
      },
      folder_path: '/path/to/step1',
    },
    'step-plugin-2': {
      id: 'step-plugin-2',
      is_builtin: false,
      manifest: {
        name: 'Step 2 Filter',
        type: 'python',
        executable: 'step2.py',
        inputs: [
          { id: 'input_layer', name: 'input_layer', label: 'Input Layer', type: 'custom_layer' },
        ],
        properties: [
          { name: 'tolerance', label: 'Tolerance', type: 'number', default: 0.1 },
        ],
      },
      folder_path: '/path/to/step2',
    },
  };

  const mockPipelinePlugin: PluginInstance = {
    id: 'test-pipeline',
    is_builtin: false,
    manifest: {
      name: 'Full Test Pipeline',
      type: 'pipeline',
      executable: '',
      inputs: [],
      properties: [],
      pipeline: {
        steps: [
          {
            step_id: 'gen_step',
            plugin_id: 'step-plugin-1',
            name: 'Generate Step',
          },
          {
            step_id: 'filter_step',
            plugin_id: 'step-plugin-2',
            name: 'Filter Step',
            bindings: {
              'inputs.input_layer': '$steps.gen_step.custom_layers[0]',
            },
            property_overrides: {
              tolerance: 0.5,
            },
          },
        ],
      },
    },
    folder_path: '/path/to/pipeline',
  };

  const mockExecutePipeline = vi.fn().mockResolvedValue({
    success: true,
    pipelineExecutionId: 'exec-123',
  });
  const mockSetActivePipelineInputRef = vi.fn();
  const mockSetActiveTool = vi.fn();
  const mockSetActivePlugin = vi.fn();
  const mockClearPluginInteractionData = vi.fn();
  const mockSelectNodes = vi.fn();
  const mockUpdatePluginInteractionData = vi.fn();
  const mockRunWithLoading = vi.fn().mockImplementation(async (_, fn) => await fn());

  beforeEach(() => {
    vi.clearAllMocks();

    const state = {
      plugins: mockPlugins,
      activePipelineInputRef: null,
      pluginInteractionData: {},
      decimalPrecision: 2,
      nodes: {
        'res-node-1': {
          id: 'res-node-1',
          name: 'Result Node',
          pipeline_metadata: { pipeline_execution_id: 'exec-123' },
        },
      },
      customLayers: [],
      annotationGroups: {},
      executePipeline: mockExecutePipeline,
      setActivePipelineInputRef: mockSetActivePipelineInputRef,
      setActiveTool: mockSetActiveTool,
      setActivePlugin: mockSetActivePlugin,
      clearPluginInteractionData: mockClearPluginInteractionData,
      selectNodes: mockSelectNodes,
      updatePluginInteractionData: mockUpdatePluginInteractionData,
      runWithLoading: mockRunWithLoading,
    };

    (useAppStore as any).mockImplementation((selector: any) => selector(state));
    (useAppStore.getState as any).mockReturnValue(state);
  });

  it('renders steps, auto-wired bindings, and step parameters', () => {
    render(<PipelineSetupView plugin={mockPipelinePlugin} />);

    expect(screen.getByText('Full Test Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Generate Step')).toBeInTheDocument();
    expect(screen.getByText('Filter Step')).toBeInTheDocument();

    // Auto-wired binding indicator
    expect(screen.getByText('(Auto-wired from $steps.gen_step.custom_layers[0])')).toBeInTheDocument();

    // Manual input for step 1
    expect(screen.getAllByText(/Start Point/).length).toBeGreaterThan(0);

    // Manual property for step 1
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });

  it('disables Run Pipeline until required manual inputs are provided', async () => {
    render(<PipelineSetupView plugin={mockPipelinePlugin} />);

    const runButton = screen.getByRole('button', { name: /Run Pipeline/i });
    expect(runButton).toBeDisabled();
    expect(screen.getByText(/Required inputs need setup: Start Point/i)).toBeInTheDocument();
  });

  it('allows activating canvas mode when an input trigger is clicked', () => {
    render(<PipelineSetupView plugin={mockPipelinePlugin} />);

    const startPointElements = screen.getAllByText(/Start Point/);
    const inputTrigger = startPointElements[startPointElements.length - 1].closest('div');
    if (inputTrigger) {
      fireEvent.click(inputTrigger);
      expect(mockSetActivePipelineInputRef).toHaveBeenCalledWith({
        stepId: 'gen_step',
        inputId: 'start_point',
      });
      expect(mockSetActiveTool).toHaveBeenCalledWith('add_generator');
    }
  });

  it('executes pipeline and selects results when input is ready', async () => {
    // Provide start_point value in store
    const stateWithInput = {
      plugins: mockPlugins,
      activePipelineInputRef: { stepId: 'gen_step', inputId: 'start_point' },
      pluginInteractionData: { start_point: { x: 10, y: 20 } },
      decimalPrecision: 2,
      nodes: {
        'res-node-1': {
          id: 'res-node-1',
          name: 'Result Node',
          pipeline_metadata: { pipeline_execution_id: 'exec-123' },
        },
      },
      customLayers: [],
      annotationGroups: {},
      executePipeline: mockExecutePipeline,
      setActivePipelineInputRef: mockSetActivePipelineInputRef,
      setActiveTool: mockSetActiveTool,
      setActivePlugin: mockSetActivePlugin,
      clearPluginInteractionData: mockClearPluginInteractionData,
      selectNodes: mockSelectNodes,
      updatePluginInteractionData: mockUpdatePluginInteractionData,
      runWithLoading: mockRunWithLoading,
    };

    (useAppStore as any).mockImplementation((selector: any) => selector(stateWithInput));
    (useAppStore.getState as any).mockReturnValue(stateWithInput);

    render(<PipelineSetupView plugin={mockPipelinePlugin} />);

    const runButton = screen.getByRole('button', { name: /Run Pipeline/i });
    expect(runButton).not.toBeDisabled();

    fireEvent.click(runButton);

    await waitFor(() => {
      expect(mockExecutePipeline).toHaveBeenCalledTimes(1);
      expect(mockSelectNodes).toHaveBeenCalledWith(['res-node-1']);
      expect(mockClearPluginInteractionData).toHaveBeenCalled();
      expect(mockSetActivePlugin).toHaveBeenCalledWith(null);
      expect(mockSetActiveTool).toHaveBeenCalledWith('select');
    });
  });

  it('displays error in AlertBox when execution fails', async () => {
    mockExecutePipeline.mockResolvedValueOnce({
      success: false,
      pipelineExecutionId: 'exec-fail',
      error: 'Step 1 failed with exit code 1',
    });

    const stateWithInput = {
      plugins: mockPlugins,
      activePipelineInputRef: null,
      pluginInteractionData: { start_point: { x: 5, y: 5 } },
      decimalPrecision: 2,
      nodes: {},
      customLayers: [],
      annotationGroups: {},
      executePipeline: mockExecutePipeline,
      setActivePipelineInputRef: mockSetActivePipelineInputRef,
      setActiveTool: mockSetActiveTool,
      selectNodes: mockSelectNodes,
      updatePluginInteractionData: mockUpdatePluginInteractionData,
      runWithLoading: mockRunWithLoading,
    };

    (useAppStore as any).mockImplementation((selector: any) => selector(stateWithInput));
    (useAppStore.getState as any).mockReturnValue(stateWithInput);

    render(<PipelineSetupView plugin={mockPipelinePlugin} />);

    const runButton = screen.getByRole('button', { name: /Run Pipeline/i });
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText('Execution Failed')).toBeInTheDocument();
      expect(screen.getByText('Step 1 failed with exit code 1')).toBeInTheDocument();
    });
  });

  it('cleans up activePipelineInputRef on unmount', () => {
    const { unmount } = render(<PipelineSetupView plugin={mockPipelinePlugin} />);
    unmount();
    expect(mockSetActivePipelineInputRef).toHaveBeenCalledWith(null);
  });
});
