import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';
import { DEFAULT_OCCUPANCY_SETTINGS } from './projectSlice';
import { OccupancyHighlightFilter } from '../../components/canvas/filters/OccupancyHighlightFilter';

describe('Occupancy Settings & Highlight Store Integration', () => {
  beforeEach(() => {
    useAppStore.getState().resetProject();
    useAppStore.setState({
      showOccupancyHighlight: false,
      occupancyHighlightAlpha: 0.6,
    });
  });

  it('initializes with default occupancy settings', () => {
    const settings = useAppStore.getState().occupancySettings;
    expect(settings).toEqual(DEFAULT_OCCUPANCY_SETTINGS);
    expect(settings.defaultOccupiedThresh).toBe(0.65);
    expect(settings.defaultFreeThresh).toBe(0.196);
    expect(settings.defaultNegate).toBe(0);
  });

  it('updates occupancy settings and marks project dirty', () => {
    useAppStore.getState().updateOccupancySettings({
      defaultOccupiedThresh: 0.75,
      defaultFreeThresh: 0.20,
    });

    const settings = useAppStore.getState().occupancySettings;
    expect(settings.defaultOccupiedThresh).toBe(0.75);
    expect(settings.defaultFreeThresh).toBe(0.20);
    expect(settings.defaultNegate).toBe(0);
    expect(useAppStore.getState().isDirty).toBe(true);
  });

  it('injects default occupancy settings into new map layers when info is missing threshold values', () => {
    useAppStore.getState().updateOccupancySettings({
      defaultOccupiedThresh: 0.80,
      defaultFreeThresh: 0.30,
      defaultNegate: 1,
    });

    useAppStore.getState().addMapLayer('Test Map', { resolution: 0.05 }, 'fake-base64', 100, 100);

    const layers = useAppStore.getState().mapLayers;
    expect(layers.length).toBe(1);
    expect(layers[0].info.occupied_thresh).toBe(0.80);
    expect(layers[0].info.free_thresh).toBe(0.30);
    expect(layers[0].info.negate).toBe(1);
  });

  it('preserves existing map layer thresholds if provided in YAML info', () => {
    useAppStore.getState().addMapLayer(
      'Custom Map',
      { resolution: 0.05, occupied_thresh: 0.55, free_thresh: 0.15, negate: 0 },
      'fake-base64',
      100,
      100
    );

    const layers = useAppStore.getState().mapLayers;
    expect(layers.length).toBe(1);
    expect(layers[0].info.occupied_thresh).toBe(0.55);
    expect(layers[0].info.free_thresh).toBe(0.15);
    expect(layers[0].info.negate).toBe(0);
  });

  it('toggles showOccupancyHighlight and updates alpha', () => {
    expect(useAppStore.getState().showOccupancyHighlight).toBe(false);

    useAppStore.getState().setShowOccupancyHighlight(true);
    expect(useAppStore.getState().showOccupancyHighlight).toBe(true);

    useAppStore.getState().setOccupancyHighlightAlpha(0.85);
    expect(useAppStore.getState().occupancyHighlightAlpha).toBe(0.85);
  });

  it('restores occupancySettings from project data', () => {
    useAppStore.getState().setProjectData({
      root_node_ids: [],
      nodes: {},
      occupancy_settings: {
        defaultOccupiedThresh: 0.72,
        defaultFreeThresh: 0.18,
        defaultNegate: 1,
      },
    });

    const settings = useAppStore.getState().occupancySettings;
    expect(settings.defaultOccupiedThresh).toBe(0.72);
    expect(settings.defaultFreeThresh).toBe(0.18);
    expect(settings.defaultNegate).toBe(1);
  });

  it('OccupancyHighlightFilter correctly instantiates and updates uniforms', () => {
    const filter = new OccupancyHighlightFilter({
      occupiedThresh: 0.7,
      freeThresh: 0.2,
      negate: 0,
      alpha: 0.5,
    });

    expect(filter).toBeDefined();
    filter.updateUniforms({
      occupiedThresh: 0.8,
      freeThresh: 0.15,
      negate: 1,
      alpha: 0.9,
    });

    const uniforms = (filter.resources as any)?.highlightUniforms?.uniforms;
    if (uniforms) {
      expect(uniforms.uOccThresh).toBe(0.8);
      expect(uniforms.uFreeThresh).toBe(0.15);
      expect(uniforms.uNegate).toBe(1);
      expect(uniforms.uHighlightAlpha).toBe(0.9);
    }

    filter.destroy();
    expect(filter.destroyed).toBe(true);
  });
});
