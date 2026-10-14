/**
 * Pure helpers for the layer tree: the single source of the layer stacking order.
 *
 * The tree is `rootLayerIds` plus each group's `children_ids`, top of the stack first (the same shape as
 * the waypoint and annotation trees, so moves go through `treeOps.ts`). The compositing order is the tree
 * flattened depth-first (`flattenLayerTree`); groups never take part in blending themselves.
 */
import type { LayerGroup } from '../types/layer';
import { detachFromTree, insertIntoTree, type DropPosition, type TreeShape } from './treeOps';

export interface LayerTree {
  /** Ids of layers and groups at the top level, top of the stack first. */
  rootLayerIds: string[];
  layerGroups: Record<string, LayerGroup>;
}

/** Deepest allowed nesting of groups (a group at the top level has depth 1). */
export const MAX_LAYER_GROUP_DEPTH = 8;

const toShape = (tree: LayerTree): TreeShape<LayerGroup> => ({
  rootIds: tree.rootLayerIds,
  containers: tree.layerGroups,
});
const fromShape = (shape: TreeShape<LayerGroup>): LayerTree => ({
  rootLayerIds: shape.rootIds,
  layerGroups: shape.containers,
});

/** Layer ids (groups left out) from the top of the stack to the bottom. Safe against malformed trees. */
export function flattenLayerTree(tree: LayerTree): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const walk = (ids: string[]) => {
    for (const id of ids) {
      if (visited.has(id)) continue;
      visited.add(id);
      const group = tree.layerGroups[id];
      if (group) walk(group.children_ids);
      else order.push(id);
    }
  };
  walk(tree.rootLayerIds);
  return order;
}

let lastFlattened: { root: string[]; groups: Record<string, LayerGroup>; order: string[] } | null = null;

/**
 * The compositing order of the layers, memoized on the identity of the tree's two fields so that store
 * selectors return the same array until the tree changes.
 */
export function layerOrderOf(tree: LayerTree): string[] {
  if (lastFlattened && lastFlattened.root === tree.rootLayerIds && lastFlattened.groups === tree.layerGroups) {
    return lastFlattened.order;
  }
  const order = flattenLayerTree(tree);
  lastFlattened = { root: tree.rootLayerIds, groups: tree.layerGroups, order };
  return order;
}

/** Parent group id of every item in the tree (null for the top level). */
export function buildLayerParentIndex(tree: LayerTree): Map<string, string | null> {
  const index = new Map<string, string | null>();
  tree.rootLayerIds.forEach((id) => index.set(id, null));
  for (const group of Object.values(tree.layerGroups)) {
    for (const child of group.children_ids) {
      if (!index.has(child)) index.set(child, group.id);
    }
  }
  return index;
}

/** Ids of the groups containing `id`, nearest first. */
export function ancestorGroupIds(
  tree: LayerTree,
  id: string,
  parentIndex: Map<string, string | null> = buildLayerParentIndex(tree),
): string[] {
  const ancestors: string[] = [];
  const seen = new Set<string>([id]);
  let parent = parentIndex.get(id) ?? null;
  while (parent && !seen.has(parent)) {
    ancestors.push(parent);
    seen.add(parent);
    parent = parentIndex.get(parent) ?? null;
  }
  return ancestors;
}

/** Every id (layers and groups) inside `groupId`, in tree order. */
export function descendantIds(tree: LayerTree, groupId: string): string[] {
  const result: string[] = [];
  const visited = new Set<string>([groupId]);
  const walk = (ids: string[]) => {
    for (const id of ids) {
      if (visited.has(id)) continue;
      visited.add(id);
      result.push(id);
      const group = tree.layerGroups[id];
      if (group) walk(group.children_ids);
    }
  };
  walk(tree.layerGroups[groupId]?.children_ids ?? []);
  return result;
}

/** Layer ids inside `groupId` (at any depth), top of the stack first. */
export function descendantLayerIds(tree: LayerTree, groupId: string): string[] {
  return descendantIds(tree, groupId).filter((id) => !tree.layerGroups[id]);
}

/** Number of group levels from `groupId` down to its deepest group (1 for a group holding no groups). */
function groupHeight(tree: LayerTree, groupId: string, seen = new Set<string>()): number {
  if (seen.has(groupId)) return 0;
  seen.add(groupId);
  let deepest = 0;
  for (const child of tree.layerGroups[groupId]?.children_ids ?? []) {
    if (tree.layerGroups[child]) deepest = Math.max(deepest, groupHeight(tree, child, seen));
  }
  return deepest + 1;
}

/**
 * Ids of the layers and groups that are hidden because a group above them is hidden. A layer is shown
 * when its own flag and the flags of every group above it are on.
 */
export function idsHiddenByGroups(tree: LayerTree): Set<string> {
  const hidden = new Set<string>();
  for (const group of Object.values(tree.layerGroups)) {
    if (group.visible || hidden.has(group.id)) continue;
    descendantIds(tree, group.id).forEach((id) => hidden.add(id));
  }
  return hidden;
}

/**
 * Makes the tree well formed for the layers that exist:
 * - references to unknown ids, repeated references and cycles are dropped;
 * - groups nested deeper than `MAX_LAYER_GROUP_DEPTH` are dissolved into their parent;
 * - groups referenced from nowhere are put back at the top, keeping their contents;
 * - layers missing from the tree are added at the top (where newly added layers appear).
 * Empty groups are kept: a user may build the structure before filling it.
 */
export function normalizeLayerTree(tree: LayerTree, existingLayerIds: readonly string[]): LayerTree {
  const layerIds = new Set(existingLayerIds);
  const sourceGroups = tree.layerGroups;
  const isGroup = (id: string) => !layerIds.has(id) && !!sourceGroups[id];
  const placed = new Set<string>();
  const groups: Record<string, LayerGroup> = {};

  // Returns the ids that take `ids`' place at `depth` (a dissolved group contributes its children).
  const place = (ids: readonly string[], depth: number, path: Set<string>): string[] => {
    const out: string[] = [];
    for (const id of ids) {
      if (placed.has(id)) continue;
      if (layerIds.has(id)) {
        placed.add(id);
        out.push(id);
      } else if (isGroup(id) && !path.has(id)) {
        const nextPath = new Set(path).add(id);
        if (depth > MAX_LAYER_GROUP_DEPTH) {
          placed.add(id);
          out.push(...place(sourceGroups[id].children_ids, depth, nextPath));
          continue;
        }
        placed.add(id);
        const children = place(sourceGroups[id].children_ids, depth + 1, nextPath);
        groups[id] = { ...sourceGroups[id], children_ids: children };
        out.push(id);
      }
    }
    return out;
  };

  const root = place(tree.rootLayerIds, 1, new Set());
  const orphanGroups = Object.keys(sourceGroups).filter((id) => isGroup(id) && !placed.has(id));
  const orphanRoot = place(orphanGroups, 1, new Set());
  const missingLayers = existingLayerIds.filter((id) => !placed.has(id));
  return { rootLayerIds: [...missingLayers, ...orphanRoot, ...root], layerGroups: groups };
}

/** The parent of `id` (null at the top level), or undefined when `id` is not in the tree. */
export function parentOf(tree: LayerTree, id: string): string | null | undefined {
  return buildLayerParentIndex(tree).get(id);
}

/** Where a new item goes: inside `parentId` (null for the top level), directly above `beforeId` or at the top. */
export interface LayerTreePlacement {
  parentId: string | null;
  beforeId: string | null;
}

/** `tree` with `ids` inserted at `placement`. */
export function insertIntoLayerTree(tree: LayerTree, ids: string[], placement: LayerTreePlacement): LayerTree {
  const { parentId, beforeId } = placement;
  const parent = parentId ? tree.layerGroups[parentId] : undefined;
  const siblings = parent ? parent.children_ids : tree.rootLayerIds;
  const at = beforeId ? siblings.indexOf(beforeId) : -1;
  const next = at < 0 ? [...ids, ...siblings] : [...siblings.slice(0, at), ...ids, ...siblings.slice(at)];
  if (parent) return { ...tree, layerGroups: { ...tree.layerGroups, [parent.id]: { ...parent, children_ids: next } } };
  return { ...tree, rootLayerIds: next };
}

/** The placement directly above `id`, in the same parent. */
export function placementAbove(tree: LayerTree, id: string): LayerTreePlacement {
  const parentId = parentOf(tree, id);
  return parentId === undefined ? { parentId: null, beforeId: null } : { parentId, beforeId: id };
}

/** `tree` without any reference to `ids` (the referenced layers and groups themselves are not touched). */
export function detachFromLayerTree(tree: LayerTree, ids: Iterable<string>): LayerTree {
  return fromShape(detachFromTree(toShape(tree), ids));
}

/**
 * Of `ids`, those not inside another of `ids`, in stack order (top first). Moving or wrapping a group
 * already brings its contents along.
 */
export function topLevelInStackOrder(tree: LayerTree, ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  const index = buildLayerParentIndex(tree);
  const result: string[] = [];
  const visited = new Set<string>();
  const walk = (list: string[]) => {
    for (const id of list) {
      if (visited.has(id)) continue;
      visited.add(id);
      if (wanted.has(id) && !ancestorGroupIds(tree, id, index).some((a) => wanted.has(a))) {
        result.push(id);
        continue;
      }
      const group = tree.layerGroups[id];
      if (group) walk(group.children_ids);
    }
  };
  walk(tree.rootLayerIds);
  return result;
}

/** Whether `movingIds` may be dropped at `targetId` / `position` without a cycle or exceeding the depth limit. */
export function canMoveInLayerTree(
  tree: LayerTree,
  movingIds: readonly string[],
  targetId: string,
  position: DropPosition,
): boolean {
  const index = buildLayerParentIndex(tree);
  if (!index.has(targetId)) return false;
  if (position === 'inside' && !tree.layerGroups[targetId]) return false;
  const newParent = position === 'inside' ? targetId : (index.get(targetId) ?? null);
  const moving = topLevelInStackOrder(tree, movingIds);
  if (moving.length === 0) return false;
  if (position !== 'inside' && moving.includes(targetId)) return false;
  // A group cannot go into itself or into one of its own descendants.
  const newParentChain = newParent ? [newParent, ...ancestorGroupIds(tree, newParent, index)] : [];
  if (moving.some((id) => newParentChain.includes(id))) return false;
  const parentDepth = newParentChain.length;
  return moving.every((id) => !tree.layerGroups[id] || parentDepth + groupHeight(tree, id) <= MAX_LAYER_GROUP_DEPTH);
}

/**
 * `tree` with `movingIds` moved before / after / inside `targetId`; null when the move is not allowed.
 * Items keep their stacking order relative to each other.
 */
export function moveInLayerTree(
  tree: LayerTree,
  movingIds: readonly string[],
  targetId: string,
  position: DropPosition,
): LayerTree | null {
  if (!canMoveInLayerTree(tree, movingIds, targetId, position)) return null;
  const moving = topLevelInStackOrder(tree, movingIds);
  const detached = toShape(detachFromLayerTree(tree, moving));
  if (position === 'inside') {
    // A drop onto a group puts the items at its top, where they are seen.
    const group = detached.containers[targetId];
    return fromShape({
      ...detached,
      containers: {
        ...detached.containers,
        [targetId]: { ...group, children_ids: [...moving, ...group.children_ids] },
      },
    });
  }
  const parentId = parentOf(fromShape(detached), targetId);
  return fromShape(insertIntoTree(detached, moving, targetId, position, parentId ?? undefined));
}

/**
 * `tree` with `ids` wrapped in a new group, placed where the topmost of them was. The new group must not
 * exceed the depth limit; null when nothing can be wrapped.
 */
export function wrapInLayerGroup(
  tree: LayerTree,
  ids: readonly string[],
  group: Pick<LayerGroup, 'id' | 'name'>,
): LayerTree | null {
  const moving = topLevelInStackOrder(tree, ids);
  if (moving.length === 0) return null;
  const index = buildLayerParentIndex(tree);
  const anchor = moving[0];
  const parentId = index.get(anchor) ?? null;
  const parentDepth = parentId ? ancestorGroupIds(tree, parentId, index).length + 1 : 0;
  const height = 1 + Math.max(0, ...moving.map((id) => (tree.layerGroups[id] ? groupHeight(tree, id) : 0)));
  if (parentDepth + height > MAX_LAYER_GROUP_DEPTH) return null;

  // Insert the new group above the anchor, then move the items into it.
  const siblings = parentId ? tree.layerGroups[parentId].children_ids : tree.rootLayerIds;
  const withGroup = insertIntoLayerTree(
    { ...tree, layerGroups: { ...tree.layerGroups, [group.id]: { ...group, visible: true, children_ids: [] } } },
    [group.id],
    { parentId, beforeId: siblings.includes(anchor) ? anchor : null },
  );
  const detached = detachFromLayerTree(withGroup, moving);
  return {
    ...detached,
    layerGroups: { ...detached.layerGroups, [group.id]: { ...detached.layerGroups[group.id], children_ids: moving } },
  };
}

/** `tree` with `groupId` replaced by its children (in place). */
export function ungroupInLayerTree(tree: LayerTree, groupId: string): LayerTree {
  const group = tree.layerGroups[groupId];
  if (!group) return tree;
  const replace = (list: string[]) => list.flatMap((id) => (id === groupId ? group.children_ids : [id]));
  const layerGroups: Record<string, LayerGroup> = {};
  for (const [id, g] of Object.entries(tree.layerGroups)) {
    if (id !== groupId) layerGroups[id] = { ...g, children_ids: replace(g.children_ids) };
  }
  return { rootLayerIds: replace(tree.rootLayerIds), layerGroups };
}

/** `tree` without `groupId` and everything inside it. Returns the tree and the layer ids that were inside. */
export function removeGroupDeep(tree: LayerTree, groupId: string): { tree: LayerTree; removedLayerIds: string[] } {
  if (!tree.layerGroups[groupId]) return { tree, removedLayerIds: [] };
  const inside = descendantIds(tree, groupId);
  const removedGroups = new Set([groupId, ...inside.filter((id) => tree.layerGroups[id])]);
  const detached = detachFromLayerTree(tree, [groupId]);
  const layerGroups = Object.fromEntries(Object.entries(detached.layerGroups).filter(([id]) => !removedGroups.has(id)));
  return {
    tree: { rootLayerIds: detached.rootLayerIds, layerGroups },
    removedLayerIds: inside.filter((id) => !tree.layerGroups[id]),
  };
}

/** Ids of every layer and group in the tree, in tree order (groups before their contents). */
export function allTreeIds(tree: LayerTree): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const walk = (ids: string[]) => {
    for (const id of ids) {
      if (visited.has(id)) continue;
      visited.add(id);
      result.push(id);
      const group = tree.layerGroups[id];
      if (group) walk(group.children_ids);
    }
  };
  walk(tree.rootLayerIds);
  return result;
}
