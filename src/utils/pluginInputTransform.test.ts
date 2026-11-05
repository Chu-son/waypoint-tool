import { describe, it, expect } from 'vitest';
import { moveFollowing, transformInteractionData } from './pluginInputTransform';
import type { PluginInputDef, PluginManifest } from '../types/plugin';
import rectSearch from '../../python_sdk/rect_search_generator/manifest.json';
import rectSearchObstacle from '../../python_sdk/rect_search_obstacle_generator/manifest.json';
import interpolation from '../../python_sdk/interpolation_generator/manifest.json';
import drivableAreaAnnotations from '../../python_sdk/drivable_area_annotation_generator/manifest.json';
import type { RigidTransform } from './rigidTransform';

const asManifest = (json: unknown) => json as Pick<PluginManifest, 'inputs' | 'needs'>;
const quarterTurn: RigidTransform = { dx: 0, dy: 0, dyaw: Math.PI / 2, pivot: { x: 0, y: 0 } };
const shift: RigidTransform = { dx: 1, dy: 2, dyaw: 0, pivot: { x: 0, y: 0 } };
const input = (def: Partial<PluginInputDef> & Pick<PluginInputDef, 'type'>): PluginInputDef => ({
  id: def.name ?? def.type,
  name: def.name ?? def.type,
  label: '',
  ...def,
});

describe('moveFollowing', () => {
  it.each<[string, unknown, string]>([
    ['coordinates only (rect search)', rectSearch, 'full'],
    ['the fixed waypoint range (interpolation)', interpolation, 'full'],
    ['coordinates read against the map (obstacle-aware rect search)', rectSearchObstacle, 'partial'],
    ['seeds taken from other annotations (drivable area)', drivableAreaAnnotations, 'none'],
  ])('follows a move for %s', (_, manifest, expected) => {
    expect(moveFollowing(asManifest(manifest))).toBe(expected);
  });

  it('does not follow when nothing it is given moves', () => {
    expect(moveFollowing({ inputs: [input({ type: 'annotation' })], needs: [] })).toBe('none');
    expect(moveFollowing({ inputs: [], needs: ['occupancy_grid'] })).toBe('none');
  });

  it('follows only partly when it also reads other objects', () => {
    expect(moveFollowing({ inputs: [input({ type: 'point' }), input({ type: 'custom_layer', name: 'l' })] })).toBe(
      'partial',
    );
    expect(moveFollowing({ inputs: [input({ type: 'rectangle' })], needs: ['selected_points'] })).toBe('partial');
  });
});

describe('transformInteractionData', () => {
  it('turns a clicked point and its heading', () => {
    const moved = transformInteractionData(
      [input({ type: 'point', name: 'goal' })],
      { goal: { x: 1, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } },
      quarterTurn,
    )!;

    const goal = moved.goal as Record<string, number>;
    expect(goal.x).toBeCloseTo(0);
    expect(goal.y).toBeCloseTo(1);
    expect(goal.qz).toBeCloseTo(Math.sin(Math.PI / 4));
    expect(goal.qw).toBeCloseTo(Math.cos(Math.PI / 4));
  });

  it('moves listed points, turning their heading only when the input has one', () => {
    const data = { pts: [{ x: 1, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 }] };

    const plain = transformInteractionData([input({ type: 'points', name: 'pts' })], data, quarterTurn)!;
    const withYaw = transformInteractionData(
      [input({ type: 'points', name: 'pts', allow_yaw: true })],
      data,
      quarterTurn,
    )!;

    const [p] = plain.pts as Array<Record<string, number>>;
    expect(p.y).toBeCloseTo(1);
    expect(p.qw).toBe(1);
    expect((withYaw.pts as Array<Record<string, number>>)[0].qz).toBeCloseTo(Math.sin(Math.PI / 4));
  });

  it('moves a rectangle by its centre and turns its yaw', () => {
    const moved = transformInteractionData(
      [input({ type: 'rectangle', name: 'area' })],
      { area: { center: { x: 2, y: 0 }, origin: { x: 1, y: -1 }, width: 2, height: 2, yaw: 0.1 } },
      quarterTurn,
    )!;

    const area = moved.area as { center: { x: number; y: number }; origin: { x: number; y: number }; yaw: number };
    expect(area.center.x).toBeCloseTo(0);
    expect(area.center.y).toBeCloseTo(2);
    expect(area.origin.x).toBeCloseTo(1);
    expect(area.origin.y).toBeCloseTo(1);
    expect(area.yaw).toBeCloseTo(0.1 + Math.PI / 2);
    expect(area).toMatchObject({ width: 2, height: 2 });
  });

  it('keeps references and resolved payloads as they are', () => {
    const layer = { id: 'l', image_base64: 'AAAA', info: { origin: [0, 0, 0] } };
    const data = { goal: { x: 0, y: 0 }, layer, picked: [3, 4] };

    const moved = transformInteractionData(
      [
        input({ type: 'point', name: 'goal' }),
        input({ type: 'custom_layer', name: 'layer' }),
        input({ type: 'waypoint', name: 'picked' }),
      ],
      data,
      shift,
    )!;

    expect(moved.goal).toMatchObject({ x: 1, y: 2 });
    expect(moved.layer).toBe(layer);
    expect(moved.picked).toBe(data.picked);
  });

  it('gives the same data back when no coordinate input has a value', () => {
    const data = { other: 1 };

    expect(transformInteractionData([input({ type: 'point', name: 'goal' })], data, shift)).toBe(data);
  });
});
