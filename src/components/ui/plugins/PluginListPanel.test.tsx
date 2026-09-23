import { fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PluginListPanel } from './PluginListPanel';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makePlugin } from '../../../test/fixtures';
import type { PluginInstance, PluginSetting } from '../../../types/store';

const renderPanel = (plugins: PluginInstance[]) =>
  renderWithStore(<PluginListPanel />, {
    plugins: Object.fromEntries(plugins.map((p) => [p.id, p])),
    pluginSettings: plugins.map((p, order) => ({ id: p.id, enabled: true, order }) as PluginSetting),
  });

const lineSweep = makePlugin('plugin-1', { name: 'Line Sweep', description: 'Draws lines' });
const rectSweep = makePlugin('plugin-2', { name: 'Rectangle Sweep', description: 'Draws area' });

describe('PluginListPanel', () => {
  it('lists every enabled plugin', () => {
    renderPanel([lineSweep, rectSweep]);
    expect(screen.getByText('Line Sweep')).toBeInTheDocument();
    expect(screen.getByText('Rectangle Sweep')).toBeInTheDocument();
  });

  it('activates the generator tool for the clicked plugin', () => {
    renderPanel([lineSweep, rectSweep]);

    fireEvent.click(screen.getByText('Line Sweep'));

    expect(getAppState().activePluginId).toBe('plugin-1');
    expect(getAppState().activeTool).toBe('add_generator');
  });

  it('opens the plugin settings', () => {
    renderPanel([lineSweep]);

    fireEvent.click(screen.getByTitle('Open Settings'));

    expect(getAppState().isSettingsModalOpen).toBe(true);
    expect(getAppState().settingsModalTab).toBe('plugins');
  });

  it('renders even when persisted plugin settings are malformed', () => {
    expect(() =>
      renderWithStore(<PluginListPanel />, { pluginSettings: { corrupted: true } as unknown as PluginSetting[] }),
    ).not.toThrow();
  });

  it('lists pipelines separately and flags pipelines with missing steps', () => {
    const step = makePlugin('p-1', { name: 'Step 1 Plugin', version: '1.0.0' });
    const pipeline = makePlugin('pipeline-test', {
      name: 'My Pipeline',
      type: 'pipeline',
      pipeline: {
        steps: [
          { step_id: 'step1', plugin_id: 'p-1' },
          { step_id: 'step2', plugin_id: 'missing-plugin' },
        ],
      } as any,
    });
    renderPanel([step, pipeline]);

    fireEvent.click(screen.getByRole('button', { name: 'Pipelines' }));

    expect(screen.getByText('My Pipeline')).toBeInTheDocument();
    expect(screen.queryByText('Step 1 Plugin')).not.toBeInTheDocument();
    expect(screen.getByText('pipeline')).toBeInTheDocument();
    expect(screen.getByText('Issue')).toBeInTheDocument();
  });
});
