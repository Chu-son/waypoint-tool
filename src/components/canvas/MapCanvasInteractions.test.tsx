/**
 * Behaviour of the canvas tools, driven through pointer events on the viewport.
 *
 * With the default viewport (no pan, scale 1) the world origin sits at screen (400, 400)
 * and world +Y points up, so screen (500, 300) is world (100, 100).
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MapCanvas } from './MapCanvas';
import { renderWithStore } from '../../test/render';
import { getAppState, PAST_WELCOME } from '../../test/store';
import { makeGroup, makeMapLayer, makePlugin, makeTransform, makeWaypoint, waypointTree } from '../../test/fixtures';
import { useAppStore } from '../../stores/appStore';
import { quaternionToYaw } from '../../utils/transformUtils';
import type { AppState } from '../../stores/appStore';

vi.mock('@pixi/react', () => import('../../test/mocks/pixi').then((m) => m.pixiReactMock));
vi.mock('pixi.js', () => import('../../test/mocks/pixi').then((m) => m.pixiJsMock));

const toScreen = (x: number, y: number) => ({ clientX: 400 + x, clientY: 400 - y });

function renderCanvas(state: Partial<AppState> = {}) {
  const utils = renderWithStore(<MapCanvas />, { ...PAST_WELCOME, ...state });
  const viewport = screen.getByTestId('pixi-app').parentElement!;
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 800,
    right: 800,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);

  const pointer = {
    down: (x: number, y: number, init: PointerEventInit = {}) =>
      fireEvent.pointerDown(viewport, { button: 0, pointerId: 1, ...toScreen(x, y), ...init }),
    move: (x: number, y: number, init: PointerEventInit = {}) =>
      fireEvent.pointerMove(viewport, { button: 0, buttons: 1, pointerId: 1, ...toScreen(x, y), ...init }),
    up: (x: number, y: number, init: PointerEventInit = {}) =>
      fireEvent.pointerUp(viewport, { button: 0, pointerId: 1, ...toScreen(x, y), ...init }),
  };
  return { ...utils, viewport, pointer };
}

/**
 * The pickable shape of the waypoint drawn at world (x, y). Under jsdom the PixiJS scene renders
 * as inert elements whose attributes mirror the display-object props, so this is "whatever is
 * under the pointer at that waypoint".
 */
const waypointAt = (container: HTMLElement, x: number, y: number) => {
  const el = container.querySelector(`pixicontainer[x="${x}"][y="${y}"] > pixigraphics[eventmode="dynamic"]`);
  if (!el) throw new Error(`No waypoint drawn at (${x}, ${y})`);
  return el;
};

const selectTool = (tool: AppState['activeTool']) => act(() => getAppState().setActiveTool(tool));
const escape = () => act(() => void getAppState().handleGlobalEscape());

describe('MapCanvas tools', () => {
  describe('add waypoint', () => {
    it('places a waypoint where clicked and selects it', () => {
      const { pointer } = renderCanvas();
      selectTool('add_point');

      pointer.down(100, 100);
      pointer.up(100, 100);

      const { rootNodeIds, nodes, selectedNodeIds } = getAppState();
      expect(rootNodeIds).toHaveLength(1);
      expect(nodes[rootNodeIds[0]].transform).toMatchObject({ x: 100, y: 100 });
      expect(selectedNodeIds).toEqual(rootNodeIds);
    });

    it('sets the heading by dragging from the placed point', () => {
      const { pointer } = renderCanvas();
      selectTool('add_point');

      pointer.down(100, 100);
      pointer.move(100, 150); // straight "up" in world space
      pointer.up(100, 150);

      const [id] = getAppState().rootNodeIds;
      expect(quaternionToYaw(getAppState().nodes[id].transform)).toBeCloseTo(Math.PI / 2, 5);
    });

    it('undoes placement and heading together in one step', () => {
      const { pointer } = renderCanvas();
      selectTool('add_point');

      pointer.down(100, 100);
      pointer.move(150, 100);
      pointer.up(150, 100);
      expect(getAppState().rootNodeIds).toHaveLength(1);

      act(() => getAppState().undo());

      expect(getAppState().rootNodeIds).toEqual([]);
    });

    it('rolls back a half-finished placement on Escape', () => {
      const { pointer } = renderCanvas();
      selectTool('add_point');

      pointer.down(100, 100);
      pointer.move(150, 100);
      escape();

      expect(getAppState().rootNodeIds).toEqual([]);
    });
  });

  describe('measure', () => {
    it('measures between two clicked points', () => {
      const { pointer } = renderCanvas();
      selectTool('measure');

      pointer.down(0, 0);
      pointer.up(0, 0);
      pointer.down(30, 40);
      pointer.up(30, 40);

      const { measureStartPoint, measureEndPoint } = getAppState();
      expect(measureStartPoint).toMatchObject({ x: 0, y: 0 });
      expect(measureEndPoint).toMatchObject({ x: 30, y: 40 });
    });
  });

  describe('export region', () => {
    it('creates a region spanning the dragged rectangle', () => {
      const { pointer } = renderCanvas();
      selectTool('add_export_region');

      pointer.down(100, 100);
      pointer.move(200, 0);
      pointer.up(200, 0);

      const regions = getAppState().exportRegions;
      expect(regions).toHaveLength(1);
      expect(regions[0].name).toBe('Region 1');
      const { x, y, width, height } = regions[0].rect;
      expect({ x, y, width: Math.abs(width), height: Math.abs(height) }).toMatchObject({ width: 100, height: 100 });
      expect(Math.min(x, x + width)).toBeCloseTo(100);
      expect(Math.min(y, y + height)).toBeCloseTo(0);
    });

    it('discards a region that is still being drawn on Escape', () => {
      const { pointer } = renderCanvas();
      selectTool('add_export_region');

      pointer.down(100, 100);
      pointer.move(200, 0);
      escape();

      expect(getAppState().exportRegions).toEqual([]);
    });
  });

  describe('marquee selection', () => {
    it('selects the waypoints inside a Shift+drag rectangle', () => {
      const { pointer } = renderCanvas(
        waypointTree([
          makeWaypoint('inside-1', { transform: makeTransform(10, 10) }),
          makeWaypoint('inside-2', { transform: makeTransform(90, 50) }),
          makeWaypoint('outside', { transform: makeTransform(300, 300) }),
        ]),
      );

      pointer.down(0, 100, { shiftKey: true });
      pointer.move(100, 0, { shiftKey: true });
      pointer.up(100, 0, { shiftKey: true });

      expect(getAppState().selectedNodeIds.sort()).toEqual(['inside-1', 'inside-2']);
    });
  });

  describe('dragging waypoints', () => {
    const twoWaypoints = () =>
      waypointTree([
        makeWaypoint('a', { transform: makeTransform(10, 20) }),
        makeWaypoint('b', { transform: makeTransform(50, 20) }),
      ]);

    it('selects and moves a waypoint by the dragged distance', () => {
      const { pointer, container } = renderCanvas(twoWaypoints());

      fireEvent.pointerDown(waypointAt(container, 10, 20), { button: 0, pointerId: 1, ...toScreen(10, 20) });
      pointer.move(40, 60);
      pointer.up(40, 60);

      expect(getAppState().selectedNodeIds).toEqual(['a']);
      expect(getAppState().nodes.a.transform).toMatchObject({ x: 40, y: 60 });
      expect(getAppState().nodes.b.transform).toMatchObject({ x: 50, y: 20 });
    });

    it('moves every selected waypoint together', () => {
      const { pointer, container } = renderCanvas(twoWaypoints());
      act(() => getAppState().selectNodes(['a', 'b']));

      fireEvent.pointerDown(waypointAt(container, 10, 20), { button: 0, pointerId: 1, ...toScreen(10, 20) });
      pointer.move(20, 30);
      pointer.up(20, 30);

      expect(getAppState().nodes.a.transform).toMatchObject({ x: 20, y: 30 });
      expect(getAppState().nodes.b.transform).toMatchObject({ x: 60, y: 30 });
    });

    it('adds a waypoint to the selection with Shift+click', () => {
      const { pointer, container } = renderCanvas(twoWaypoints());
      act(() => getAppState().selectNodes(['a']));

      fireEvent.pointerDown(waypointAt(container, 50, 20), {
        button: 0,
        pointerId: 1,
        shiftKey: true,
        ...toScreen(50, 20),
      });
      pointer.up(50, 20);

      expect(getAppState().selectedNodeIds).toEqual(['a', 'b']);
    });

    it('undoes a drag in one step', () => {
      const { pointer, container } = renderCanvas(twoWaypoints());

      fireEvent.pointerDown(waypointAt(container, 10, 20), { button: 0, pointerId: 1, ...toScreen(10, 20) });
      pointer.move(25, 20);
      pointer.move(40, 60);
      pointer.up(40, 60);
      act(() => getAppState().undo());

      expect(getAppState().nodes.a.transform).toMatchObject({ x: 10, y: 20 });
    });

    it('returns the waypoint to where it started when Escape is pressed mid-drag', () => {
      const { pointer, container } = renderCanvas(twoWaypoints());

      fireEvent.pointerDown(waypointAt(container, 10, 20), { button: 0, pointerId: 1, ...toScreen(10, 20) });
      pointer.move(40, 60);
      escape();

      expect(getAppState().nodes.a.transform).toMatchObject({ x: 10, y: 20 });
    });
  });

  describe('fit to maps', () => {
    it('frames both the maps and every waypoint, including ones added after the map', () => {
      const { viewport } = renderCanvas({
        mapLayers: [makeMapLayer('m', { width: 100, height: 100, info: { resolution: 0.1, origin: [0, 0, 0] } })],
      });
      // A waypoint far outside the map, nested in a group, added after the map was loaded.
      act(() =>
        useAppStore.setState(
          waypointTree([makeGroup('g', ['far']), makeWaypoint('far', { transform: makeTransform(200, 200) })]),
        ),
      );

      act(() => getAppState().triggerFitToMaps());
      selectTool('add_point');
      // Screen coordinates: after fitting, the viewport is no longer the identity transform.
      fireEvent.pointerDown(viewport, { button: 0, pointerId: 1, clientX: 400, clientY: 400 });

      // The screen centre now shows the centre of map (0..10) ∪ waypoint (200): about (100, 100).
      const placed = Object.values(getAppState().nodes).find((n) => n.id !== 'far' && n.type === 'manual')!;
      expect(placed.transform!.x).toBeCloseTo(100, 0);
      expect(placed.transform!.y).toBeCloseTo(100, 0);
    });
  });

  describe('select tool', () => {
    // MapCanvas has a "click on empty space clears the selection" branch, but a press in select
    // mode always starts panning, so a real click (down + up) never reaches it. Pending a spec
    // decision on whether a click without movement should deselect.
    it.todo('clears the selection when empty space is clicked without dragging');
  });

  describe('generator input', () => {
    it('records a clicked point for the active plugin input', () => {
      const plugin = makePlugin('gen', {
        inputs: [{ id: 'start', name: 'start', label: 'Start', type: 'point', required: true }],
      });
      const { pointer } = renderCanvas({ plugins: { gen: plugin } });
      act(() => {
        getAppState().setActivePlugin('gen');
        getAppState().setActiveTool('add_generator');
      });

      pointer.down(25, -40);
      pointer.up(25, -40);

      expect(getAppState().pluginInteractionData.start).toMatchObject({ x: 25, y: -40 });
    });
  });
});
