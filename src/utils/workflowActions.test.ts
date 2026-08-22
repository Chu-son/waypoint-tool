import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../stores/appStore';
import { executeWorkflowAction } from './workflowActions';

describe('workflowActions', () => {
  beforeEach(() => {
    useAppStore.getState().resetProject();
  });

  it('executes triggerFitToMaps action', async () => {
    const prevTimestamp = useAppStore.getState().shouldFitToMaps;
    await executeWorkflowAction('triggerFitToMaps');
    expect(useAppStore.getState().shouldFitToMaps).toBeGreaterThanOrEqual(prevTimestamp || 0);
  });

  it('executes ensureCustomLayer action', async () => {
    expect(useAppStore.getState().customLayers.length).toBe(0);
    await executeWorkflowAction('ensureCustomLayer', { layerName: 'My Layer' });
    expect(useAppStore.getState().customLayers.length).toBe(1);
    expect(useAppStore.getState().customLayers[0].name).toBe('My Layer');

    // Does not create duplicate if one already exists
    await executeWorkflowAction('ensureCustomLayer', { layerName: 'My Layer 2' });
    expect(useAppStore.getState().customLayers.length).toBe(1);
  });

  it('executes setRobotFootprintRadius action', async () => {
    await executeWorkflowAction('setRobotFootprintRadius', { value: 0.25 });
    const footprint = useAppStore.getState().robotFootprint;
    expect(footprint.type).toBe('circular');
    if (footprint.type === 'circular') {
      expect(footprint.radius).toBe(0.25);
    }
  });

  it('executes open_export_modal action', async () => {
    useAppStore.setState({ isExportModalOpen: false });
    await executeWorkflowAction('open_export_modal');
    expect(useAppStore.getState().isExportModalOpen).toBe(true);
  });
});
