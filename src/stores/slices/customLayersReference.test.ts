import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../appStore';
import { normalizeProjectData } from './projectSlice';
import { prepareLayersForExport } from '../../utils/mapRasterize';
import { ProjectMapLayer } from '../../types/store';

describe('Custom Layers Reference Flag', () => {
  beforeEach(() => {
    useAppStore.getState().resetProject();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      rect: vi.fn(),
      arc: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
    } as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,mocked');
  });

  it('adds manual custom layer with default is_reference = false', () => {
    const layer = useAppStore.getState().addManualCustomLayer('Test Layer');
    expect(layer.is_reference).toBe(false);
    expect(useAppStore.getState().customLayers[0].is_reference).toBe(false);
  });

  it('adds manual custom layer with explicit is_reference = true', () => {
    const layer = useAppStore.getState().addManualCustomLayer('Ref Layer', true);
    expect(layer.is_reference).toBe(true);
    expect(useAppStore.getState().customLayers[0].is_reference).toBe(true);
  });

  it('normalizes customLayers preserving is_reference', () => {
    const inputData = {
      custom_layers: [
        {
          id: 'l1',
          name: 'Reference Layer',
          type: 'manual',
          visible: true,
          opacity: 1,
          is_reference: true,
          editObjects: [],
        },
        {
          id: 'l2',
          name: 'Normal Layer',
          type: 'manual',
          visible: true,
          opacity: 1,
          editObjects: [],
        },
      ],
    };

    const normalized = normalizeProjectData(inputData);
    expect(normalized.customLayers).toHaveLength(2);
    expect(normalized.customLayers[0].is_reference).toBe(true);
    expect(normalized.customLayers[1].is_reference).toBe(false);
  });

  it('excludes reference layers from prepareLayersForExport', async () => {
    const mockMapLayers: ProjectMapLayer[] = [
      {
        id: 'map1',
        name: 'Map 1',
        info: { resolution: 0.05, origin: [0, 0, 0] },
        image_base64: 'map-b64',
        width: 100,
        height: 100,
        visible: true,
        opacity: 1.0,
        z_index: 0,
      },
    ];

    const mockCustomLayers = [
      {
        id: 'ref1',
        name: 'Reference Manual Layer',
        type: 'manual' as const,
        visible: true,
        opacity: 1.0,
        z_index: 0,
        is_reference: true,
        editObjects: [
          {
            id: 'obj1',
            type: 'rect' as const,
            cx: 0,
            cy: 0,
            width: 1,
            height: 1,
            angle: 0,
            fillValue: 0,
          },
        ],
      },
      {
        id: 'norm1',
        name: 'Normal Manual Layer',
        type: 'manual' as const,
        visible: true,
        opacity: 1.0,
        z_index: 1,
        is_reference: false,
        editObjects: [
          {
            id: 'obj2',
            type: 'rect' as const,
            cx: 0,
            cy: 0,
            width: 1,
            height: 1,
            angle: 0,
            fillValue: 0,
          },
        ],
      },
      {
        id: 'ref2',
        name: 'Reference Plugin Layer',
        type: 'plugin' as const,
        plugin_id: 'dummy',
        params: {},
        image_base64: 'data:image/png;base64,ref',
        info: { resolution: 0.05, origin: [0, 0, 0] as [number, number, number], width: 100, height: 100 },
        visible: true,
        opacity: 1.0,
        z_index: 2,
        is_reference: true,
      },
      {
        id: 'norm2',
        name: 'Normal Plugin Layer',
        type: 'plugin' as const,
        plugin_id: 'dummy',
        params: {},
        image_base64: 'data:image/png;base64,norm',
        info: { resolution: 0.05, origin: [0, 0, 0] as [number, number, number], width: 100, height: 100 },
        visible: true,
        opacity: 1.0,
        z_index: 3,
        is_reference: false,
      },
    ];

    const result = await prepareLayersForExport(mockMapLayers, mockCustomLayers as any);

    // map1, norm1, norm2 の3つが含まれ、ref1 と ref2 は除外されるべき
    const resultIds = result.map((r) => r.id);
    expect(resultIds).toContain('map1');
    expect(resultIds).toContain('norm1');
    expect(resultIds).toContain('norm2');
    expect(resultIds).not.toContain('ref1');
    expect(resultIds).not.toContain('ref2');
    expect(result).toHaveLength(3);
  });
});
