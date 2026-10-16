/**
 * Pure helpers behind the shared tree view (`components/ui/trees/core/TreeView.tsx`).
 *
 * A tree is described by `TreeModel` only (top-level ids and the children of containers), so the same
 * row listing and drop logic serves every tree whatever its data: layers, annotations, waypoints.
 */
import type { DropPosition } from './treeOps';

export interface TreeModel {
  rootIds: readonly string[];
  /** Children of a container, top first; undefined for an item that cannot hold children. */
  childrenOf: (id: string) => readonly string[] | undefined;
}

/** One row on screen. */
export interface TreeRowInfo {
  id: string;
  depth: number;
  parentId: string | null;
  isContainer: boolean;
  isExpanded: boolean;
}

/** The rows shown, depth-first, given which containers are expanded. Safe against cycles. */
export function visibleTreeRows(model: TreeModel, expanded: ReadonlySet<string>): TreeRowInfo[] {
  const rows: TreeRowInfo[] = [];
  const visited = new Set<string>();
  const walk = (ids: readonly string[], depth: number, parentId: string | null) => {
    for (const id of ids) {
      if (visited.has(id)) continue;
      visited.add(id);
      const children = model.childrenOf(id);
      const isExpanded = !!children && expanded.has(id);
      rows.push({ id, depth, parentId, isContainer: !!children, isExpanded });
      if (children && isExpanded) walk(children, depth + 1, id);
    }
  };
  walk(model.rootIds, 0, null);
  return rows;
}

/** The parent of every item reachable from the top (null at the top level). */
export function treeParentIndex(model: TreeModel): Map<string, string | null> {
  const index = new Map<string, string | null>();
  const walk = (ids: readonly string[], parentId: string | null) => {
    for (const id of ids) {
      if (index.has(id)) continue;
      index.set(id, parentId);
      const children = model.childrenOf(id);
      if (children) walk(children, id);
    }
  };
  walk(model.rootIds, null);
  return index;
}

/** The containers above `id`, nearest first. */
export function treeAncestorIds(parentIndex: Map<string, string | null>, id: string): string[] {
  const ancestors: string[] = [];
  let parent = parentIndex.get(id) ?? null;
  while (parent && !ancestors.includes(parent)) {
    ancestors.push(parent);
    parent = parentIndex.get(parent) ?? null;
  }
  return ancestors;
}

/** Where dragged items go: before / after `targetId`, or `inside` it at the top of its children. */
export interface DropTarget {
  targetId: string;
  position: DropPosition;
}

/** The pointer relative to the row it is over: from the row's top edge, and from where depth 0 starts. */
export interface DropPointer {
  offsetY: number;
  height: number;
  offsetX: number;
}

/**
 * The drop target for the pointer over row `overId`.
 * - On a container: the top quarter drops before it, the bottom quarter after it, the rest inside it.
 *   On other rows: the top half drops before, the bottom half after.
 * - After an expanded container with children means at the top of its children (the row right below).
 * - After the last row of a group, the horizontal position picks how far out of the group the items go:
 *   one step to the left for every `indentPx` (as drawn by the indentation).
 */
export function computeDropTarget(
  model: TreeModel,
  rows: readonly TreeRowInfo[],
  overId: string,
  pointer: DropPointer,
  indentPx: number,
): DropTarget | null {
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const row = rowById.get(overId);
  if (!row || pointer.height <= 0) return null;

  const fraction = pointer.offsetY / pointer.height;
  let position: DropPosition;
  if (row.isContainer) position = fraction < 0.25 ? 'before' : fraction > 0.75 ? 'after' : 'inside';
  else position = fraction < 0.5 ? 'before' : 'after';
  if (position !== 'after') return { targetId: row.id, position };

  if (row.isExpanded && (model.childrenOf(row.id)?.length ?? 0) > 0) return { targetId: row.id, position: 'inside' };

  // The row and every group it closes (it is the last row of each), innermost first.
  const candidates: TreeRowInfo[] = [row];
  let current = row;
  while (current.parentId !== null) {
    const siblings = model.childrenOf(current.parentId) ?? [];
    if (siblings[siblings.length - 1] !== current.id) break;
    const parent = rowById.get(current.parentId);
    if (!parent) break;
    candidates.push(parent);
    current = parent;
  }
  const desiredDepth = Math.floor(pointer.offsetX / indentPx);
  const chosen = candidates.find((c) => c.depth <= desiredDepth) ?? candidates[candidates.length - 1];
  return { targetId: chosen.id, position: 'after' };
}
