/** A drag or a typed value on the layer panels and the map inspector is one undo step, and the panel follows undo. */
import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { layerStackState, makeMap } from '../../../test/fixtures';
import { DEFAULT_GEO_MAP } from '../../../stores/migrations/geoMapNormalization';
import type { ExportRegion } from '../../../types/layer';
import { MapLayerInspector } from '../properties/MapLayerInspector';
import { GeoMapCard } from './GeoMapCard';
import { LayerPanel } from './LayerPanel';

const dragSlider = (slider: HTMLElement, ...values: string[]) => {
  fireEvent.pointerDown(slider, { button: 0 });
  values.forEach((value) => fireEvent.change(slider, { target: { value } }));
  fireEvent.pointerUp(window);
};

const typeInto = (input: HTMLElement, ...values: string[]) => {
  fireEvent.focus(input);
  values.forEach((value) => fireEvent.change(input, { target: { value } }));
  fireEvent.blur(input);
};

const expectOneStep = () => expect(getAppState().historyPast).toHaveLength(1);
const undo = () => act(() => getAppState().undo());

describe('MapLayerInspector', () => {
  const map = makeMap('mapA', { info: { origin: [1, 0, 0], initial_origin: [1, 0, 0] } });
  beforeEach(() => {
    renderWithStore(<MapLayerInspector id="mapA" />, layerStackState(map));
  });

  it('undoes an opacity drag in one step and shows the restored value', () => {
    const before = getAppState().mapLayers[0].opacity;
    const [slider] = screen.getAllByRole('slider');

    dragSlider(slider, '0.2', '0.1');

    expectOneStep();
    undo();
    expect(getAppState().mapLayers[0].opacity).toBe(before);
    expect(slider).toHaveValue(String(before));
  });

  it('undoes a threshold drag in one step', () => {
    const before = getAppState().mapSources[0].info.occupied_thresh;

    const [, occupiedThresh] = screen.getAllByRole('slider');

    dragSlider(occupiedThresh, '0.8', '0.9');

    expectOneStep();
    undo();
    expect(getAppState().mapSources[0].info.occupied_thresh).toBe(before);
  });

  it('undoes a typed pose offset in one step', () => {
    typeInto(screen.getByLabelText('ΔX (m)'), '1', '1.5');

    expectOneStep();
    undo();
    expect(getAppState().mapSources[0].info.origin).toEqual([1, 0, 0]);
  });
});

describe('GeoMapCard', () => {
  const custom = { geoMap: { ...DEFAULT_GEO_MAP, enabled: true, basemapId: 'custom' as const } };
  beforeEach(() => {
    renderWithStore(<GeoMapCard />, custom);
    fireEvent.click(screen.getByRole('button', { name: 'Expand settings' }));
  });

  it('undoes an opacity drag in one step', () => {
    dragSlider(screen.getByRole('slider', { name: 'Base map opacity' }), '0.2', '0.1');

    expectOneStep();
    undo();
    expect(getAppState().geoMap.opacity).toBe(DEFAULT_GEO_MAP.opacity);
  });

  it('undoes typing a tile URL in one step', () => {
    const before = getAppState().geoMap.customBasemap.urlTemplate;

    typeInto(screen.getByLabelText('Tile URL template'), 'h', 'ht');

    expectOneStep();
    undo();
    expect(getAppState().geoMap.customBasemap.urlTemplate).toBe(before);
  });
});

describe('export regions on LayerPanel', () => {
  const region = (id: string): ExportRegion => ({
    id,
    name: id,
    rect: { x: 0, y: 0, width: 1, height: 1 },
    visible: true,
    layerVisibility: {},
  });
  beforeEach(() => {
    renderWithStore(<LayerPanel />, { exportRegions: [region('a'), region('b')] });
  });

  it('hides all regions in one step', () => {
    fireEvent.click(screen.getByTitle('Hide All Regions'));

    expect(getAppState().exportRegions.map((r) => r.visible)).toEqual([false, false]);
    expectOneStep();
    undo();
    expect(getAppState().exportRegions.map((r) => r.visible)).toEqual([true, true]);
  });

  it('undoes typing a region name in one step', () => {
    typeInto(screen.getAllByPlaceholderText('Region Name')[0], 'N', 'Ne');

    expectOneStep();
    undo();
    expect(getAppState().exportRegions[0].name).toBe('a');
  });
});
