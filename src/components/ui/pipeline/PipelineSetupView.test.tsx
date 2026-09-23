import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PipelineSetupView } from './PipelineSetupView';
import { BackendAPI } from '../../../api';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makePlugin } from '../../../test/fixtures';
import type { AppState } from '../../../stores/appStore';

const generator = makePlugin('step-plugin-1', {
  name: 'Step 1 Generator',
  primary_output: 'custom_layer',
  inputs: [{ id: 'start_point', name: 'start_point', label: 'Start Point', type: 'point', required: true }],
  properties: [{ name: 'speed', label: 'Speed', type: 'float', default: 1.5 }],
});
const filter = makePlugin('step-plugin-2', {
  name: 'Step 2 Filter',
  inputs: [{ id: 'input_layer', name: 'input_layer', label: 'Input Layer', type: 'custom_layer' }],
  properties: [{ name: 'tolerance', label: 'Tolerance', type: 'float', default: 0.1 }],
});
const pipeline = makePlugin('test-pipeline', {
  name: 'Full Test Pipeline',
  type: 'pipeline',
  pipeline: {
    steps: [
      { step_id: 'gen_step', plugin_id: 'step-plugin-1', name: 'Generate Step' },
      {
        step_id: 'filter_step',
        plugin_id: 'step-plugin-2',
        name: 'Filter Step',
        bindings: { 'inputs.input_layer': '$steps.gen_step.custom_layers[0]' },
        property_overrides: { tolerance: 0.5 },
      },
    ],
  } as any,
});

const renderSetup = (state: Partial<AppState> = {}) =>
  renderWithStore(<PipelineSetupView plugin={pipeline} />, {
    plugins: { [generator.id]: generator, [filter.id]: filter, [pipeline.id]: pipeline },
    ...state,
  });

const generatedLayer = {
  name: 'Generated Layer',
  image_base64: 'aW1n',
  info: { resolution: 0.05, origin: [0, 0, 0], width: 1, height: 1 },
};

describe('PipelineSetupView', () => {
  it('shows the steps, auto-wired bindings and step parameters', () => {
    renderSetup();

    expect(screen.getByText('Full Test Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Generate Step')).toBeInTheDocument();
    expect(screen.getByText('Filter Step')).toBeInTheDocument();
    expect(screen.getByText('(Auto-wired from $steps.gen_step.custom_layers[0])')).toBeInTheDocument();
    expect(screen.getAllByText(/Start Point/).length).toBeGreaterThan(0);
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });

  it('keeps Run Pipeline disabled until the required inputs are set', () => {
    renderSetup();

    expect(screen.getByRole('button', { name: /Run Pipeline/i })).toBeDisabled();
    expect(screen.getByText(/Required inputs need setup: Start Point/i)).toBeInTheDocument();
  });

  it('starts picking an input on the canvas when the input is clicked', () => {
    renderSetup();

    const labels = screen.getAllByText(/Start Point/);
    fireEvent.click(labels[labels.length - 1].closest('div')!);

    expect(getAppState().activePipelineInputRef).toEqual({ stepId: 'gen_step', inputId: 'start_point' });
    expect(getAppState().activeTool).toBe('add_generator');
  });

  it('runs every step, feeding the first step output into the second, then selects the result', async () => {
    const runPlugin = vi
      .spyOn(BackendAPI, 'runPlugin')
      .mockResolvedValueOnce({ custom_layers: [generatedLayer] })
      .mockResolvedValueOnce({ waypoints: [{ x: 1, y: 2, yaw: 0 }] });
    renderSetup({ pluginInteractionData: { start_point: { x: 10, y: 20 } } });

    const run = screen.getByRole('button', { name: /Run Pipeline/i });
    expect(run).toBeEnabled();
    fireEvent.click(run);

    await waitFor(() => expect(getAppState().activeTool).toBe('select'));
    expect(runPlugin).toHaveBeenCalledTimes(2);
    expect(runPlugin.mock.calls[0][1]).toMatchObject({
      properties: { speed: 1.5 },
      interaction_data: { start_point: { x: 10, y: 20 } },
    });
    expect(runPlugin.mock.calls[1][1]).toMatchObject({ properties: { tolerance: 0.5 } });

    const { nodes, selectedNodeIds, customLayers } = getAppState();
    expect(customLayers.some((l) => l.name === 'Generated Layer')).toBe(true);
    expect(selectedNodeIds.length).toBeGreaterThan(0);
    expect(selectedNodeIds.every((id) => nodes[id]?.pipeline_metadata?.pipeline_id === 'test-pipeline')).toBe(true);
    expect(getAppState().activePluginId).toBeNull();
  });

  it('reports a failing step and leaves the project unchanged', async () => {
    vi.spyOn(BackendAPI, 'runPlugin').mockRejectedValue(new Error('Step 1 failed with exit code 1'));
    renderSetup({ pluginInteractionData: { start_point: { x: 5, y: 5 } } });

    fireEvent.click(screen.getByRole('button', { name: /Run Pipeline/i }));

    expect(await screen.findByText('Execution Failed')).toBeInTheDocument();
    expect(screen.getByText(/Step 1 failed with exit code 1/)).toBeInTheDocument();
    expect(getAppState().customLayers).toEqual([]);
    expect(getAppState().rootNodeIds).toEqual([]);
  });

  it('stops canvas input picking when closed', () => {
    const { unmount } = renderSetup({ activePipelineInputRef: { stepId: 'gen_step', inputId: 'start_point' } });

    unmount();

    expect(getAppState().activePipelineInputRef).toBeNull();
  });
});
