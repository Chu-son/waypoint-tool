/**
 * Moving a waypoint group/generator or an annotation group as one body, together with the other outputs
 * of the same plugin runs. One run can produce a waypoint generator, an annotation group and plugin layers
 * at once, and rerunning any of them replaces all of them, so they move together or their inputs disagree.
 * Spans several slices, so it lives outside them; the slices only record history and apply the result.
 */
import type { AppState } from './appStore';
import type { CustomLayer } from '../types/layer';
import type { Pose2D } from '../types/geometry';
import { followingOf, moveStoredInputs, type MoveContext } from '../utils/pluginInputTransform';
import { composePose, isIdentityTransform, transformPose, type RigidTransform } from '../utils/rigidTransform';
import { annotationSubtreeIds, effectiveAnnotationBasePose, moveAnnotations } from '../utils/annotationGroupTransform';
import { effectiveNodeBasePose, moveNodes, nodeSubtreeIds } from '../utils/waypointGroupTransform';
import { collectDescendantIds } from '../utils/treeUtils';

export type GroupDomain = 'node' | 'annotation';

export type GroupMoveResult = Pick<AppState, 'nodes' | 'annotationObjects' | 'annotationGroups' | 'customLayers'> & {
  movesWaypoints: boolean;
};

export interface GroupMoveOptions {
  /** False for the later steps of one gesture (a held nudge, a drag): only its first step records history. */
  recordHistory?: boolean;
  /** True while a drag is under way: the path is recalculated once when it ends. */
  skipRecalculate?: boolean;
}

type MoveSource = Pick<AppState, 'nodes' | 'annotationObjects' | 'annotationGroups' | 'customLayers' | 'plugins'>;

/** Run ids of the generators among the given waypoint nodes and annotation groups. */
function runIdsOf(state: MoveSource, nodeIds: string[], groupIds: string[]): Set<string> {
  const runs = new Set<string>();
  for (const id of nodeIds) {
    const node = state.nodes[id];
    if (node.type === 'generator' && node.source_execution_id) runs.add(node.source_execution_id);
  }
  for (const id of groupIds) {
    const group = state.annotationGroups[id];
    if (group.type === 'generator' && group.source_execution_id) runs.add(group.source_execution_id);
  }
  return runs;
}

/** Other outputs of the given runs: waypoint generators, annotation groups and plugin layers. */
function outputsOfRuns(state: MoveSource, runs: Set<string>) {
  return {
    generatorIds: Object.values(state.nodes)
      .filter((n) => n.type === 'generator' && !!n.source_execution_id && runs.has(n.source_execution_id))
      .map((n) => n.id),
    annotationGroupIds: Object.values(state.annotationGroups)
      .filter((g) => g.type === 'generator' && !!g.source_execution_id && runs.has(g.source_execution_id))
      .map((g) => g.id),
    layerIds: state.customLayers
      .filter((l) => l.type === 'plugin' && !!l.source_execution_id && runs.has(l.source_execution_id))
      .map((l) => l.id),
  };
}

/** The ids moving when `id` is moved: its contents and the other outputs of the runs inside it. */
export function groupMoveScope(state: MoveSource, domain: GroupDomain, id: string) {
  const own =
    domain === 'node'
      ? { nodeIds: nodeSubtreeIds(state.nodes, [id]), groupIds: [] as string[] }
      : {
          nodeIds: [] as string[],
          groupIds: annotationSubtreeIds(state.annotationGroups, state.annotationObjects, [id]).groupIds,
        };
  const siblings = outputsOfRuns(state, runIdsOf(state, own.nodeIds, own.groupIds));
  const nodeIds = nodeSubtreeIds(state.nodes, [...own.nodeIds, ...siblings.generatorIds]);
  const annotations = annotationSubtreeIds(state.annotationGroups, state.annotationObjects, [
    ...(domain === 'annotation' ? [id] : []),
    ...siblings.annotationGroupIds,
  ]);
  return { nodeIds, ...annotations, layerIds: siblings.layerIds };
}

/** The reference pose of `id` (stored, or the centre of its contents); null when it holds nothing to move. */
export function effectiveBasePose(
  state: Pick<AppState, 'nodes' | 'annotationGroups' | 'annotationObjects'>,
  domain: GroupDomain,
  id: string,
): Pose2D | null {
  return domain === 'node'
    ? effectiveNodeBasePose(state.nodes, id)
    : effectiveAnnotationBasePose(state.annotationGroups, state.annotationObjects, id);
}

function movePluginLayer(layer: CustomLayer, t: RigidTransform, ctx: MoveContext): CustomLayer {
  if (layer.type !== 'plugin') return layer;
  const next = { ...layer, info: { ...layer.info, origin: transformPose(layer.info.origin, t) } };
  if (followingOf(layer, ctx.plugins) !== 'none') {
    next.interaction_data = moveStoredInputs(
      layer.interaction_data,
      ctx.plugins[layer.plugin_id].manifest.inputs ?? [],
      t,
      ctx.moved,
    );
  }
  return next;
}

/**
 * The state after moving `id` (a waypoint group/generator or an annotation group) by `t`, or null when
 * there is nothing to move (no such item, or it holds no waypoint or annotation).
 */
export function planGroupMove(
  state: MoveSource,
  domain: GroupDomain,
  id: string,
  t: RigidTransform,
): GroupMoveResult | null {
  const pose = effectiveBasePose(state, domain, id);
  if (!pose) return null;

  const scope = groupMoveScope(state, domain, id);
  const ctx: MoveContext = { plugins: state.plugins, moved: new Map() };
  const movedNodes = moveNodes(state.nodes, scope.nodeIds, t, ctx);
  const movedAnnotations = moveAnnotations(state.annotationGroups, state.annotationObjects, scope, t, ctx);
  // The moved item keeps its reference pose from now on (until then it was the centre of its contents).
  const basePose = composePose(pose, t);
  if (domain === 'node') movedNodes[id] = { ...movedNodes[id], base_pose: basePose };
  else movedAnnotations.groups[id] = { ...movedAnnotations.groups[id], base_pose: basePose };
  const layerIds = new Set(scope.layerIds);
  return {
    movesWaypoints: scope.nodeIds.length > 0,
    // A domain with nothing moved keeps its map, so what depends on it (layers, memos) is not rebuilt.
    nodes: withChanges(state.nodes, movedNodes),
    annotationGroups: withChanges(state.annotationGroups, movedAnnotations.groups),
    annotationObjects: withChanges(state.annotationObjects, movedAnnotations.objects),
    customLayers: layerIds.size
      ? state.customLayers.map((layer) => (layerIds.has(layer.id) ? movePluginLayer(layer, t, ctx) : layer))
      : state.customLayers,
  };
}

const withChanges = <T>(items: Record<string, T>, changes: Record<string, T>): Record<string, T> =>
  Object.keys(changes).length > 0 ? { ...items, ...changes } : items;

/** Modes whose inspector is not the selection's, so no group pose is being adjusted. */
const MODES_WITH_OWN_INSPECTOR = new Set([
  'generator_add',
  'plugin_interaction',
  'custom_layer_edit',
  'annotation_edit',
]);

/**
 * The group whose reference pose the inspector shows: a waypoint group or generator selected with its
 * contents, or one annotation group. Pipeline outputs have the pipeline inspector instead. Null otherwise.
 */
export function basePoseTarget(
  state: Pick<AppState, 'appMode' | 'selection' | 'nodes' | 'annotationGroups'>,
): { domain: GroupDomain; id: string } | null {
  if (MODES_WITH_OWN_INSPECTOR.has(state.appMode.mode)) return null;
  const { selection } = state;
  if (selection.type === 'nodes') {
    const [first, ...rest] = selection.ids;
    const node = state.nodes[first];
    if (!node || node.type === 'manual' || node.pipeline_metadata) return null;
    const inside = new Set(collectDescendantIds(first, state.nodes));
    return rest.every((id) => inside.has(id)) ? { domain: 'node', id: first } : null;
  }
  if (selection.type === 'annotations' && selection.ids.length === 1) {
    const group = state.annotationGroups[selection.ids[0]];
    return group && !group.pipeline_metadata ? { domain: 'annotation', id: group.id } : null;
  }
  return null;
}

type GetState = () => AppState;
type SetState = (partial: Partial<AppState>) => void;

/** Moves `id` and applies it to the store as one undo step (see `GroupMoveOptions`). False when nothing moved. */
export function commitGroupMove(
  get: GetState,
  set: SetState,
  domain: GroupDomain,
  id: string,
  t: RigidTransform,
  options?: GroupMoveOptions,
): boolean {
  if (isIdentityTransform(t)) return false;
  const result = planGroupMove(get(), domain, id, t);
  if (!result) return false;
  const { movesWaypoints, ...changes } = result;
  if (options?.recordHistory !== false) get().pushHistorySnapshot();
  set({ ...changes, isDirty: true });
  const state = get();
  if (movesWaypoints && !options?.skipRecalculate && state.autoRecalculatePath && state.activePathCalculatorPluginId) {
    state.debouncedRecalculatePath(200);
  }
  return true;
}

/** Forgets the stored reference pose of `id`, so the centre of its contents stands in again. Contents stay. */
export function commitClearBasePose(get: GetState, set: SetState, domain: GroupDomain, id: string): void {
  const state = get();
  const withoutPose = <T extends { base_pose?: unknown }>(item: T): T => {
    const next = { ...item };
    delete next.base_pose;
    return next;
  };
  if (domain === 'node') {
    if (!state.nodes[id]?.base_pose) return;
    state.pushHistorySnapshot();
    set({ nodes: { ...state.nodes, [id]: withoutPose(state.nodes[id]) }, isDirty: true });
  } else {
    if (!state.annotationGroups[id]?.base_pose) return;
    state.pushHistorySnapshot();
    set({
      annotationGroups: { ...state.annotationGroups, [id]: withoutPose(state.annotationGroups[id]) },
      isDirty: true,
    });
  }
}
