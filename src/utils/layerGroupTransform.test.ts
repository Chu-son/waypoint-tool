import { describe, it, expect } from 'vitest';
import { groupWorldBounds, transformEditObject, transformPose, type RigidTransform } from './layerGroupTransform';
import { makeManualCustomLayer, makeResolvedMapLayer } from '../test/fixtures';
import type { EditObject, PluginCustomLayer } from '../types/layer';

const quarterTurn = (pivot = { x: 0, y: 0 }): RigidTransform => ({ dx: 0, dy: 0, dyaw: Math.PI / 2, pivot });

describe('transformPose', () => {
  it('shifts a position and keeps its yaw', () => {
    expect(transformPose([1, 2, 0.5], { dx: 3, dy: -1, dyaw: 0, pivot: { x: 0, y: 0 } })).toEqual([4, 1, 0.5]);
  });

  it('turns the position around the pivot and adds the turn to the yaw', () => {
    const [x, y, yaw] = transformPose([2, 0, 0], quarterTurn({ x: 1, y: 0 }));

    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(1);
    expect(yaw).toBeCloseTo(Math.PI / 2);
  });

  it('turns first and shifts after', () => {
    const [x, y] = transformPose([1, 0, 0], { ...quarterTurn(), dx: 10, dy: 20 });

    expect(x).toBeCloseTo(10);
    expect(y).toBeCloseTo(21);
  });
});

describe('transformEditObject', () => {
  const shift: RigidTransform = { dx: 1, dy: 2, dyaw: 0, pivot: { x: 0, y: 0 } };

  it.each<[string, EditObject, Partial<EditObject>]>([
    [
      'a rect',
      { id: 'o', type: 'rect', fillValue: 0, cx: 1, cy: 1, width: 2, height: 1, angle: 0.1 },
      { cx: 2, cy: 3, width: 2, height: 1, angle: 0.1 },
    ],
    ['a circle', { id: 'o', type: 'circle', fillValue: 0, cx: 1, cy: 1, radius: 3 }, { cx: 2, cy: 3, radius: 3 }],
    ['a line', { id: 'o', type: 'line', fillValue: 0, x1: 0, y1: 0, x2: 4, y2: 0 }, { x1: 1, y1: 2, x2: 5, y2: 2 }],
    [
      'a freehand stroke',
      {
        id: 'o',
        type: 'freehand',
        fillValue: 0,
        brushRadius: 0.2,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      {
        brushRadius: 0.2,
        points: [
          { x: 1, y: 2 },
          { x: 2, y: 3 },
        ],
      },
    ],
  ])('shifts %s without changing its size', (_name, object, expected) => {
    expect(transformEditObject(object, shift)).toMatchObject(expected);
  });

  it('turns a rect together with its centre', () => {
    const rect: EditObject = { id: 'o', type: 'rect', fillValue: 0, cx: 1, cy: 0, width: 2, height: 1, angle: 0 };

    const turned = transformEditObject(rect, quarterTurn());

    expect(turned).toMatchObject({ width: 2, height: 1 });
    expect((turned as typeof rect).cx).toBeCloseTo(0);
    expect((turned as typeof rect).cy).toBeCloseTo(1);
    expect((turned as typeof rect).angle).toBeCloseTo(Math.PI / 2);
  });
});

describe('groupWorldBounds', () => {
  it('is null when nothing in the group has an extent', () => {
    expect(groupWorldBounds([], [makeManualCustomLayer('empty')])).toBeNull();
  });

  it('spans maps and the objects of hand-drawn layers', () => {
    const map = makeResolvedMapLayer('map', { width: 100, height: 100, info: { resolution: 0.1, origin: [0, 0, 0] } });
    const drawn = makeManualCustomLayer('drawn', {
      editObjects: [{ id: 'c', type: 'circle', fillValue: 0, cx: 20, cy: -5, radius: 1 }],
    });

    expect(groupWorldBounds([map], [drawn])).toEqual({ minX: 0, minY: -6, maxX: 21, maxY: 10 });
  });

  it('measures a plugin layer by its image', () => {
    const plugin = {
      id: 'p',
      name: 'p',
      type: 'plugin',
      visible: true,
      opacity: 1,
      plugin_id: 'x',
      params: {},
      image_base64: '',
      info: { resolution: 0.5, origin: [2, 3, 0], width: 4, height: 2 },
    } as PluginCustomLayer;

    expect(groupWorldBounds([], [plugin])).toEqual({ minX: 2, minY: 3, maxX: 4, maxY: 4 });
  });
});
