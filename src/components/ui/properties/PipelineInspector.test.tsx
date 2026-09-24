import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PipelineInspector } from './PipelineInspector';
import { BackendAPI, DialogAPI } from '../../../api';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makePlugin, makeWaypoint, waypointTree } from '../../../test/fixtures';
import type { PluginCustomLayer } from '../../../types/store';
import type { PipelineMetadata } from '../../../types/pipeline';

const step1 = makePlugin('step-1', {
  name: 'Step 1 Layer Generator',
  inputs: [{ id: 'roi', name: 'roi', label: 'ROI Region', type: 'rectangle' }],
  properties: [{ name: 'threshold', label: 'Threshold', type: 'integer', default: 50 }],
});
const step2 = makePlugin('step-2', {
  name: 'Step 2 Sweep Planner',
  inputs: [{ id: 'input_roi', name: 'input_roi', label: 'Input ROI', type: 'rectangle' }],
  properties: [{ name: 'num_lines', label: 'Num Lines', type: 'integer', default: 6 }],
});
const pipeline = makePlugin('test-pipe', {
  name: 'Sweep Pipeline',
  version: '1.0.0',
  description: 'Test pipeline description',
  type: 'pipeline',
  pipeline: {
    steps: [
      { step_id: 'step1', plugin_id: 'step-1', name: 'Noise Filter' },
      {
        step_id: 'step2',
        plugin_id: 'step-2',
        name: 'Sweep Path',
        bindings: { 'inputs.input_roi': '$steps.step1.inputs.roi' },
      },
    ],
  } as any,
});

const metadata: PipelineMetadata = {
  pipeline_id: 'test-pipe',
  pipeline_execution_id: 'exec-123',
  step_id: 'step1',
  step_execution_id: 'step-exec-1',
  pipeline_inputs: { step1: { roi: { x: 10, y: 20, width: 30, height: 40 } } },
  pipeline_properties: { step1: { threshold: 60 }, step2: { num_lines: 8 } },
};

const pipelineLayer: PluginCustomLayer = {
  id: 'layer-1',
  name: 'Noise Filter Layer',
  type: 'plugin',
  plugin_id: 'step-1',
  visible: true,
  opacity: 0.7,
  z_index: 0,
  blend_mode: 'overwrite',
  is_reference: false,
  params: {},
  image_base64: '',
  info: { resolution: 0.05, origin: [0, 0, 0], width: 1, height: 1 },
  pipeline_metadata: { ...metadata, step_execution_id: 'step-exec-1' },
};

const renderInspector = () =>
  renderWithStore(<PipelineInspector pipelineMetadata={metadata} targetCustomLayerId="layer-1" />, {
    plugins: { [step1.id]: step1, [step2.id]: step2, [pipeline.id]: pipeline },
    customLayers: [pipelineLayer],
    ...waypointTree([
      makeWaypoint('node-1', {
        type: 'generator',
        name: 'Sweep Path Group',
        children_ids: [],
        pipeline_metadata: { ...metadata, step_id: 'step2', step_execution_id: 'step-exec-2' },
      }),
    ]),
  });

const layer = () => getAppState().customLayers.find((l) => l.id === 'layer-1')!;

describe('PipelineInspector', () => {
  it('summarises the pipeline, its steps and outputs', () => {
    renderInspector();

    expect(screen.getByText('Sweep Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Instance')).toBeInTheDocument();
    expect(screen.getByText('Noise Filter')).toBeInTheDocument();
    expect(screen.getByText('Sweep Path')).toBeInTheDocument();
    expect(screen.getByText(/1 layer\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 waypoint group\(s\)/)).toBeInTheDocument();
  });

  it('skips re-running steps whose inputs and properties are unchanged', async () => {
    const runPlugin = vi.spyOn(BackendAPI, 'runPlugin').mockResolvedValue([]);
    renderInspector();

    fireEvent.click(screen.getByRole('button', { name: /Re-generate Pipeline/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Re-generate Pipeline/i })).toBeEnabled());
    expect(runPlugin).not.toHaveBeenCalled();
  });

  it('re-runs an edited step and every step downstream of it', async () => {
    const runPlugin = vi.spyOn(BackendAPI, 'runPlugin').mockResolvedValue([]);
    renderInspector();

    fireEvent.change(screen.getByDisplayValue('60'), { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: /Re-generate Pipeline/i }));

    await waitFor(() => expect(runPlugin).toHaveBeenCalledTimes(2));
    const [firstPlugin, firstContext] = runPlugin.mock.calls[0];
    const [secondPlugin, secondContext] = runPlugin.mock.calls[1];
    expect(firstPlugin.id).toBe('step-1');
    expect(firstContext).toMatchObject({
      properties: { threshold: 70 },
      interaction_data: { roi: { x: 10, y: 20, width: 30, height: 40 } },
    });
    expect(secondPlugin.id).toBe('step-2');
    expect(secondContext).toMatchObject({
      properties: { num_lines: 8 },
      interaction_data: { input_roi: { x: 10, y: 20, width: 30, height: 40 } },
    });
  });

  it('detaches the layer from the pipeline after confirmation', async () => {
    vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);
    renderInspector();

    fireEvent.click(screen.getByRole('button', { name: /Detach/i }));

    await waitFor(() => expect(layer().pipeline_metadata).toBeUndefined());
  });

  it('keeps the layer attached when the user cancels detaching', async () => {
    const ask = vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);
    renderInspector();

    fireEvent.click(screen.getByRole('button', { name: /Detach/i }));

    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(layer().pipeline_metadata).toBeDefined();
  });

  it('edits the target layer name and reference flag', () => {
    renderInspector();

    expect(screen.getByText('Layer: Noise Filter Layer')).toBeInTheDocument();
    expect(screen.getByText('Active Layer')).toBeInTheDocument();
    expect(screen.getByText('Opacity')).toBeInTheDocument();
    expect(screen.getByText('Blend Mode')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByDisplayValue('Noise Filter Layer'), { target: { value: 'Renamed Mask Layer' } });

    expect(layer()).toMatchObject({ is_reference: true, name: 'Renamed Mask Layer' });
  });
});
