import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PluginParamsPanel } from './PluginParamsPanel';
import { BackendAPI } from '../../api';
import { renderWithStore } from '../../test/render';
import { getAppState } from '../../test/store';
import { makeMapLayer, makePlugin } from '../../test/fixtures';
import type { AppState } from '../../stores/appStore';
import type { PluginInstance, PluginSetting } from '../../types/store';

const generator = makePlugin('test-plugin', {
  name: 'Test Generator',
  description: 'A test plugin',
  inputs: [{ id: 'in-1', name: 'start', type: 'point', label: 'Start Point', required: true }],
  properties: [{ name: 'count', type: 'integer', default: 5, label: 'Count' }],
});

function renderPanel(active: PluginInstance, state: Partial<AppState> = {}, others: PluginInstance[] = []) {
  const all = [active, ...others];
  return renderWithStore(<PluginParamsPanel />, {
    activeTool: 'add_generator',
    activePluginId: active.id,
    plugins: Object.fromEntries(all.map((p) => [p.id, p])),
    pluginSettings: all.map((p, order) => ({ id: p.id, enabled: true, order }) as PluginSetting),
    ...state,
  });
}

describe('PluginParamsPanel', () => {
  it('renders nothing unless the generator tool is active', () => {
    const { container } = renderPanel(generator, { activeTool: 'select' });
    expect(container.firstChild).toBeNull();
  });

  it('shows the plugin name, inputs and properties', () => {
    renderPanel(generator);
    expect(screen.getByText('Test Generator')).toBeInTheDocument();
    expect(screen.getByText('Start Point')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
  });

  it('disables generation when the plugin needs selected points but none are selected', () => {
    renderPanel(makePlugin('test-plugin', { ...generator.manifest, needs: ['selected_points'] }));
    expect(screen.getByRole('button', { name: /generate path/i })).toBeDisabled();
  });

  it('runs the plugin and adds the generated waypoints under a new generator node', async () => {
    const runPlugin = vi.spyOn(BackendAPI, 'runPlugin').mockResolvedValue([{ x: 10, y: 20, yaw: 0 }]);
    renderPanel(generator, { pluginInteractionData: { start: { x: 1, y: 1 } } });

    fireEvent.click(screen.getByText('Generate Path'));

    await waitFor(() => expect(getAppState().rootNodeIds).toHaveLength(1));
    expect(runPlugin.mock.calls[0][1]).toMatchObject({
      properties: { count: 5 },
      interaction_data: { start: { x: 1, y: 1 } },
    });
    const { nodes, rootNodeIds } = getAppState();
    const created = nodes[rootNodeIds[0]];
    expect(created.type).toBe('generator');
    expect(created.plugin_id).toBe('test-plugin');
    expect(nodes[created.children_ids![0]].transform).toMatchObject({ x: 10, y: 20 });
  });

  it('reloads the installed plugins', async () => {
    const fetchInstalled = vi.spyOn(BackendAPI, 'fetchInstalledPlugins').mockResolvedValue([generator]);
    renderPanel(generator);

    fireEvent.click(screen.getByTitle('Reload Plugin'));

    await waitFor(() => expect(fetchInstalled).toHaveBeenCalled());
  });

  it('sends the visible map layers to plugins that need the occupancy grid', async () => {
    const runPlugin = vi.spyOn(BackendAPI, 'runPlugin').mockResolvedValue([{ x: 1, y: 2, yaw: 0 }]);
    const occPlugin = makePlugin('occ-plugin', { name: 'Occ Generator', needs: ['occupancy_grid'] });
    renderPanel(occPlugin, { mapLayers: [makeMapLayer('m1', { image_base64: 'b64' })] });

    fireEvent.click(screen.getByText('Generate Path'));

    await waitFor(() => expect(runPlugin).toHaveBeenCalled());
    const layersSent = runPlugin.mock.calls[0][3];
    expect(layersSent).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'm1', visible: true })]));
  });

  it('shows the pipeline setup for pipeline plugins', () => {
    const pipeline = makePlugin('test-pipe', {
      name: 'Combined Pipeline',
      type: 'pipeline',
      pipeline: { steps: [{ step_id: 's1', plugin_id: 'test-plugin', name: 'Inner Generator' }] } as any,
    });
    renderPanel(pipeline, {}, [generator]);

    expect(screen.getByText('Combined Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Workflow')).toBeInTheDocument();
    expect(screen.getByText('Inner Generator')).toBeInTheDocument();
  });
});
