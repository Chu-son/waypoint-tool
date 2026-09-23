/** Generic list-of-children tree operations shared by the waypoint and annotation trees. */

export interface ChildrenContainer {
  children_ids?: string[];
}

export type DropPosition = 'before' | 'after' | 'inside';

export interface TreeShape<T extends ChildrenContainer> {
  rootIds: string[];
  /** Every item that can hold children, by id. Items without `children_ids` are left untouched. */
  containers: Record<string, T>;
}

/** Remove `movingIds` from the root list and from every container's children. Returns new objects. */
export function detachFromTree<T extends ChildrenContainer>(
  tree: TreeShape<T>,
  movingIds: Iterable<string>,
): TreeShape<T> {
  const moving = new Set(movingIds);
  const containers = { ...tree.containers };
  for (const [id, container] of Object.entries(containers)) {
    if (container.children_ids) {
      containers[id] = { ...container, children_ids: container.children_ids.filter((c) => !moving.has(c)) };
    }
  }
  return { rootIds: tree.rootIds.filter((id) => !moving.has(id)), containers };
}

/**
 * Insert `ids` relative to `targetId`.
 * - `inside`: appended to the target's children.
 * - `before` / `after`: placed next to the target within `targetParentId`'s children, or in the root list
 *   when `targetParentId` is undefined or not a container.
 * Returns the new tree and the id of the parent the items ended up under (undefined for root).
 */
export function insertIntoTree<T extends ChildrenContainer>(
  tree: TreeShape<T>,
  ids: string[],
  targetId: string,
  position: DropPosition,
  targetParentId: string | undefined,
): TreeShape<T> & { parentId: string | undefined } {
  const containers = { ...tree.containers };
  const rootIds = [...tree.rootIds];

  if (position === 'inside') {
    const target = containers[targetId];
    if (!target) return { rootIds, containers, parentId: undefined };
    containers[targetId] = { ...target, children_ids: [...(target.children_ids || []), ...ids] };
    return { rootIds, containers, parentId: targetId };
  }

  const insertAt = (list: string[]) => {
    let index = list.indexOf(targetId);
    if (index === -1) index = list.length;
    else if (position === 'after') index += 1;
    list.splice(index, 0, ...ids);
  };

  const parent = targetParentId ? containers[targetParentId] : undefined;
  if (targetParentId && parent) {
    const siblings = [...(parent.children_ids || [])];
    insertAt(siblings);
    containers[targetParentId] = { ...parent, children_ids: siblings };
    return { rootIds, containers, parentId: targetParentId };
  }

  insertAt(rootIds);
  return { rootIds, containers, parentId: undefined };
}
