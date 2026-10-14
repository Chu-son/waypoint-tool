import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MapLayerInspector } from './MapLayerInspector';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { layerStackState, makeLayerGroup, makeMap } from '../../../test/fixtures';

const rotatedMap = (origin: [number, number, number]) =>
  layerStackState(
    makeMap('l1', { name: 'Map 1', opacity: 0.8, info: { resolution: 0.05, origin, initial_origin: [10, 20, 0] } }),
  );

describe('MapLayerInspector', () => {
  it('shows pose, opacity, blend and threshold settings, and rotates the map by +90°', () => {
    renderWithStore(<MapLayerInspector id="l1" />, rotatedMap([10, 20, 0]));

    expect(screen.getByText('Layer Opacity')).toBeInTheDocument();
    expect(screen.getByText('Blend Mode')).toBeInTheDocument();
    expect(screen.getByText('Occupancy Thresholds')).toBeInTheDocument();
    expect(screen.getByText(/YAML Origin:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Rotate +90° (Clockwise)'));

    expect(getAppState().mapSources[0].info).toMatchObject({
      origin: [10, 20, Math.PI / 2],
      initial_origin: [10, 20, 0],
    });
  });

  it('lets a map layer replace the cells below it, unknown ones included', () => {
    renderWithStore(<MapLayerInspector id="l1" />, layerStackState(makeMap('l1'), makeMap('l2')));

    fireEvent.change(screen.getByRole('combobox', { name: 'Blend Mode' }), { target: { value: 'replace' } });

    expect(getAppState().mapLayers.find((l) => l.id === 'l1')?.blend_mode).toBe('replace');
    expect(getAppState().mapLayers.find((l) => l.id === 'l2')?.blend_mode).toBe('overwrite');
  });

  it('resets the pose to the origin from the YAML file', () => {
    renderWithStore(<MapLayerInspector id="l1" />, rotatedMap([15, 25, Math.PI / 4]));

    fireEvent.click(screen.getByTitle('Reset pose to YAML origin'));

    expect(getAppState().mapSources[0].info).toMatchObject({ origin: [10, 20, 0], initial_origin: [10, 20, 0] });
  });

  it('nudges the pose with the adjuster buttons and arrow keys', () => {
    renderWithStore(<MapLayerInspector id="l1" />, rotatedMap([10, 20, 0]));

    fireEvent.click(screen.getByRole('button', { name: /Move right/ }));
    fireEvent.click(screen.getByRole('button', { name: /Move up/ }));
    expect(getAppState().mapSources[0].info.origin).toEqual([10.1, 20.1, 0]);

    fireEvent.keyDown(screen.getByRole('group', { name: 'Pose adjuster' }), { key: 'ArrowLeft', shiftKey: true });
    expect(getAppState().mapSources[0].info.origin[0]).toBeCloseTo(9.1);

    fireEvent.click(screen.getByRole('button', { name: /counter-clockwise/ }));
    expect(getAppState().mapSources[0].info.origin[2]).toBeCloseTo(Math.PI / 180);
  });

  it('renames the layer from its name field', () => {
    renderWithStore(<MapLayerInspector id="l1" />, rotatedMap([10, 20, 0]));

    const name = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Warehouse' } });
    fireEvent.keyDown(name, { key: 'Enter' });

    expect(getAppState().mapLayers[0].name).toBe('Warehouse');
  });

  it('says when a group above hides the layer, keeping its own flag on', () => {
    renderWithStore(
      <MapLayerInspector id="l1" />,
      layerStackState(makeLayerGroup('g', [makeMap('l1')], { visible: false })),
    );

    const eye = screen.getByRole('button', { name: '非表示にする' });
    expect(eye).toHaveAttribute('title', '上のグループが非表示のため表示されていません');
  });

  describe('copies of one map', () => {
    const twoCopies = () => {
      const state = layerStackState(makeMap('l1', { name: 'Map 1' }));
      renderWithStore(<MapLayerInspector id="l1" />, state);
      act(() => {
        getAppState().duplicateMapLayer('l1');
      });
    };

    it('applies a pose change made on one copy to every copy of the map', () => {
      twoCopies();

      fireEvent.click(screen.getByTitle('Rotate +90° (Clockwise)'));

      expect(getAppState().mapSources).toHaveLength(1);
      expect(getAppState().mapSources[0].info.origin[2]).toBeCloseTo(Math.PI / 2);
    });

    it('lets one copy be nudged on its own after unlinking its pose', () => {
      twoCopies();

      fireEvent.click(screen.getByRole('switch', { name: 'Link pose' }));
      fireEvent.click(screen.getByTitle('Rotate +90° (Clockwise)'));

      const { mapLayers, mapSources } = getAppState();
      expect(mapSources[0].info.origin).toEqual([0, 0, 0]);
      expect(mapLayers.find((l) => l.id === 'l1')?.origin_override?.[2]).toBeCloseTo(Math.PI / 2);
    });

    it('offers no pose link for a map that has no other copy', () => {
      renderWithStore(<MapLayerInspector id="l1" />, layerStackState(makeMap('l1')));
      expect(screen.queryByRole('switch', { name: 'Link pose' })).not.toBeInTheDocument();
    });
  });

  describe('using only part of a map', () => {
    // 100 × 100 px at 0.05 m/px with origin (0, 0): the map covers (0, 0)–(5, 5) m.
    const open = () =>
      renderWithStore(<MapLayerInspector id="l1" />, layerStackState(makeMap('l1', { name: 'Map 1' })));
    const toggleClip = () => fireEvent.click(screen.getByRole('switch', { name: 'Use only part of this map' }));

    it('starts using the whole map and can be limited to one half of it', () => {
      open();
      expect(getAppState().mapLayers[0].clip).toBeNull();

      toggleClip();
      expect(getAppState().mapLayers[0].clip).toEqual({ rects: [{ x: 0, y: 0, width: 5, height: 5 }] });

      fireEvent.click(screen.getByRole('button', { name: 'Right half' }));
      expect(getAppState().mapLayers[0].clip).toEqual({ rects: [{ x: 2.5, y: 0, width: 2.5, height: 5 }] });
    });

    it('builds an L-shaped area from several rectangles', () => {
      open();
      toggleClip();

      fireEvent.click(screen.getByRole('button', { name: 'Add area' }));
      expect(getAppState().mapLayers[0].clip?.rects).toHaveLength(2);
      expect(screen.getByRole('group', { name: 'Area 2' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Remove area 2' }));
      expect(getAppState().mapLayers[0].clip?.rects).toHaveLength(1);
    });

    it('goes back to the whole map when switched off', () => {
      open();
      toggleClip();
      fireEvent.click(screen.getByRole('button', { name: 'Left half' }));

      toggleClip();

      expect(getAppState().mapLayers[0].clip).toBeNull();
    });

    it('undoes a preset and typed changes to the area, each in one step', () => {
      open();
      toggleClip();
      fireEvent.click(screen.getByRole('button', { name: 'Left half' }));

      const width = within(screen.getByRole('group', { name: 'Area 1' })).getByLabelText('W');
      fireEvent.focus(width);
      fireEvent.change(width, { target: { value: '1' } });
      fireEvent.blur(width);
      expect(getAppState().mapLayers[0].clip?.rects[0].width).toBe(1);

      getAppState().undo();
      expect(getAppState().mapLayers[0].clip?.rects[0].width).toBe(2.5);

      getAppState().undo();
      expect(getAppState().mapLayers[0].clip).toEqual({ rects: [{ x: 0, y: 0, width: 5, height: 5 }] });
    });

    it('switches to drawing the area on the canvas and back', () => {
      open();
      toggleClip();

      fireEvent.click(screen.getByRole('button', { name: 'Draw on canvas' }));
      expect(getAppState().appMode).toEqual({ mode: 'map_clip_edit', layerId: 'l1' });

      fireEvent.click(screen.getByRole('button', { name: 'Done drawing' }));
      expect(getAppState().appMode.mode).toBe('select');
    });

    it('stops drawing when the area is switched off', () => {
      open();
      toggleClip();
      fireEvent.click(screen.getByRole('button', { name: 'Draw on canvas' }));

      toggleClip();

      expect(getAppState().appMode.mode).toBe('select');
      expect(getAppState().mapLayers[0].clip).toBeNull();
    });
  });
});
