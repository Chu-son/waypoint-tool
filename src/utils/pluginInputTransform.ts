/**
 * Moving the coordinates a user gave a plugin (its interaction inputs) along with a rigid move of what the
 * plugin produced, so running it again puts the output where it was moved to.
 */
import type { PluginInputDef, PluginManifest } from '../types/plugin';
import { rotateQuaternionAboutZ } from './transformUtils';
import { transformPoint, type RigidTransform } from './rigidTransform';

const COORDINATE_INPUTS = new Set(['point', 'points', 'point_list', 'rectangle']);
const REFERENCE_INPUTS = new Set(['waypoint', 'annotation', 'custom_layer']);

/** The key a plugin input's value is stored under in `interaction_data`. */
export const interactionKeyOf = (input: Pick<PluginInputDef, 'name' | 'id'>): string => input.name || input.id;

/**
 * How a plugin's output follows a move when it is run again:
 * - `full`: every position comes from inputs that move (coordinates, or the fixed waypoint range).
 * - `partial`: some positions come from things that do not move (referenced objects, the map, the selection).
 * - `none`: no input moves, so it comes out where it was first made.
 */
export type MoveFollowing = 'full' | 'partial' | 'none';

export function moveFollowing(manifest: Pick<PluginManifest, 'inputs' | 'needs'>): MoveFollowing {
  const types = (manifest.inputs ?? []).map((input) => input.type);
  const needs = manifest.needs ?? [];
  const usesRange = needs.includes('waypoint_range');
  if (!usesRange && !types.some((type) => COORDINATE_INPUTS.has(type))) return 'none';
  // With a range, the `waypoint` input only picks the range, which is fixed at the first run and moves.
  const referencesOthers = types.some((type) => REFERENCE_INPUTS.has(type) && !(usesRange && type === 'waypoint'));
  const readsSurroundings = needs.some((need) => need !== 'waypoint_range' && need !== 'robot_footprint');
  return referencesOthers || readsSurroundings ? 'partial' : 'full';
}

type Point = { x: number; y: number };
const isPoint = (value: unknown): value is Point =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as Point).x === 'number' &&
  typeof (value as Point).y === 'number';

/** A clicked point after the move; its heading (quaternion, and `yaw` when stored) turns only when `turn`. */
function movePointItem<T extends Point>(item: T, t: RigidTransform, turn: boolean): T {
  const moved: Record<string, unknown> = { ...item, ...transformPoint(item, t) };
  if (turn) {
    Object.assign(moved, rotateQuaternionAboutZ(item as Partial<Record<'qx' | 'qy' | 'qz' | 'qw', number>>, t.dyaw));
    const yaw = (item as { yaw?: unknown }).yaw;
    if (typeof yaw === 'number') moved.yaw = yaw + t.dyaw;
  }
  return moved as T;
}

function moveInputValue(input: PluginInputDef, value: unknown, t: RigidTransform): unknown {
  switch (input.type) {
    case 'point':
      return isPoint(value) ? movePointItem(value, t, input.allow_yaw !== false) : value;
    case 'points':
    case 'point_list':
      return Array.isArray(value)
        ? value.map((item) => (isPoint(item) ? movePointItem(item, t, input.allow_yaw === true) : item))
        : value;
    case 'rectangle': {
      if (!value || typeof value !== 'object') return value;
      const rect = value as { center?: unknown; origin?: unknown; yaw?: unknown };
      return {
        ...rect,
        ...(isPoint(rect.center) && { center: transformPoint(rect.center, t) }),
        ...(isPoint(rect.origin) && { origin: transformPoint(rect.origin, t) }),
        yaw: (typeof rect.yaw === 'number' ? rect.yaw : 0) + t.dyaw,
      };
    }
    default:
      return value;
  }
}

/**
 * `data` with the values of the coordinate inputs moved. Which values are coordinates is read from the
 * manifest's input types only. Everything else (references, resolved payloads such as layer images) keeps
 * its reference, and `data` itself comes back when nothing moved.
 */
export function transformInteractionData(
  inputs: PluginInputDef[],
  data: Record<string, unknown> | undefined,
  t: RigidTransform,
): Record<string, unknown> | undefined {
  if (!data) return data;
  let next: Record<string, unknown> | undefined;
  for (const input of inputs) {
    if (!COORDINATE_INPUTS.has(input.type)) continue;
    const key = interactionKeyOf(input);
    if (!(key in data)) continue;
    next ??= { ...data };
    next[key] = moveInputValue(input, data[key], t);
  }
  return next ?? data;
}
