/**
 * Test data factories. Each returns a valid, fully-populated object; pass only the fields
 * the test cares about as overrides so the intent of the test stays visible.
 */
import type {
  AnnotationGroup,
  CircleAnnotation,
  LineAnnotation,
  ManualCustomLayer,
  OrientedPointAnnotation,
  PluginInstance,
  PluginManifest,
  PointAnnotation,
  ProjectMapLayer,
  RectAnnotation,
  Transform,
  WaypointNode,
} from '../types/store';
import type { AppState } from '../stores/appStore';
import { yawToQuaternion } from '../utils/transformUtils';

export function makeTransform(x = 0, y = 0, yaw = 0, z = 0): Transform {
  return { x, y, z, ...yawToQuaternion(yaw) };
}

export function makeWaypoint(id: string, overrides: Partial<WaypointNode> = {}): WaypointNode {
  return { id, type: 'manual', name: id, transform: makeTransform(), options: {}, ...overrides };
}

export function makeGroup(id: string, childrenIds: string[], overrides: Partial<WaypointNode> = {}): WaypointNode {
  return { id, type: 'manual_group', name: id, children_ids: childrenIds, ...overrides };
}

/**
 * Build the `nodes` / `rootNodeIds` pair for a waypoint tree. Nodes listed as children of a
 * group are excluded from the roots automatically.
 *
 *   resetAppStore(waypointTree([makeWaypoint('a'), makeGroup('g', ['b']), makeWaypoint('b')]))
 */
export function waypointTree(nodes: WaypointNode[]): Pick<AppState, 'nodes' | 'rootNodeIds'> {
  const childIds = new Set(nodes.flatMap((n) => n.children_ids ?? []));
  return {
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
    rootNodeIds: nodes.filter((n) => !childIds.has(n.id)).map((n) => n.id),
  };
}

const annotationBase = { visible: true, labelVisible: true } as const;

export function makePointAnnotation(id: string, overrides: Partial<PointAnnotation> = {}): PointAnnotation {
  return { ...annotationBase, id, name: id, type: 'point', x: 0, y: 0, ...overrides };
}

export function makeOrientedPointAnnotation(
  id: string,
  overrides: Partial<OrientedPointAnnotation> = {},
): OrientedPointAnnotation {
  return { ...annotationBase, id, name: id, type: 'oriented_point', x: 0, y: 0, yaw: 0, ...overrides };
}

export function makeLineAnnotation(id: string, overrides: Partial<LineAnnotation> = {}): LineAnnotation {
  return { ...annotationBase, id, name: id, type: 'line', x1: 0, y1: 0, x2: 1, y2: 0, ...overrides };
}

export function makeRectAnnotation(id: string, overrides: Partial<RectAnnotation> = {}): RectAnnotation {
  return { ...annotationBase, id, name: id, type: 'rect', cx: 0, cy: 0, width: 1, height: 1, angle: 0, ...overrides };
}

export function makeCircleAnnotation(id: string, overrides: Partial<CircleAnnotation> = {}): CircleAnnotation {
  return { ...annotationBase, id, name: id, type: 'circle', cx: 0, cy: 0, radius: 1, ...overrides };
}

export function makeAnnotationGroup(
  id: string,
  childrenIds: string[],
  overrides: Partial<AnnotationGroup> = {},
): AnnotationGroup {
  return { id, name: id, type: 'manual_group', visible: true, children_ids: childrenIds, ...overrides };
}

export function makeManualCustomLayer(id: string, overrides: Partial<ManualCustomLayer> = {}): ManualCustomLayer {
  return { id, name: id, type: 'manual', visible: true, opacity: 1, z_index: 0, editObjects: [], ...overrides };
}

export function makeMapLayer(id: string, overrides: Partial<ProjectMapLayer> = {}): ProjectMapLayer {
  return {
    id,
    name: id,
    info: {
      image: `${id}.pgm`,
      resolution: 0.05,
      origin: [0, 0, 0],
      initial_origin: [0, 0, 0],
      negate: 0,
      occupied_thresh: 0.65,
      free_thresh: 0.196,
    },
    image_base64: '',
    width: 100,
    height: 100,
    visible: true,
    opacity: 1,
    z_index: 0,
    blend_mode: 'overwrite',
    ...overrides,
  };
}

export function makePluginManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    name: 'Test Plugin',
    type: 'python',
    executable: 'main.py',
    primary_output: 'waypoints',
    inputs: [],
    properties: [],
    ...overrides,
  };
}

export function makePlugin(id: string, manifest: Partial<PluginManifest> = {}): PluginInstance {
  return {
    id,
    manifest: makePluginManifest(manifest),
    folder_path: `/plugins/${id}`,
    is_builtin: false,
  };
}
