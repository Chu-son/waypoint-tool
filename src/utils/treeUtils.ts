import { WaypointNode, AnnotationGroup, AnnotationObject } from '../types/store';

/**
 * ウェイポイントツリーを深さ優先探索 (DFS) で走査し、すべてのマニュアルウェイポイントIDを順序通りに抽出する。
 */
export function getFlattenedWaypointIds(
  rootIds: string[],
  nodes: Record<string, WaypointNode>
): string[] {
  const result: string[] = [];

  function traverse(id: string) {
    const node = nodes[id];
    if (!node) return;

    if (node.children_ids && node.children_ids.length > 0) {
      node.children_ids.forEach(traverse);
    } else if (node.type === 'manual') {
      result.push(id);
    }
  }

  rootIds.forEach(traverse);
  return result;
}

/**
 * ウェイポイントツリーを走査し、グループ・ジェネレーターを含むすべてのノードIDを深さ優先順で抽出する。
 */
export function getFlattenedNodeIds(
  rootIds: string[],
  nodes: Record<string, WaypointNode>
): string[] {
  const result: string[] = [];

  function traverse(id: string) {
    const node = nodes[id];
    if (!node) return;
    result.push(id);
    if (node.children_ids && node.children_ids.length > 0) {
      node.children_ids.forEach(traverse);
    }
  }

  rootIds.forEach(traverse);
  return result;
}

/**
 * アノテーションツリーを深さ優先探索 (DFS) で走査し、すべてのアノテーションオブジェクトIDを順序通りに抽出する。
 */
export function getFlattenedAnnotationIds(
  rootIds: string[],
  annotationGroups: Record<string, AnnotationGroup>,
  annotationObjects: Record<string, AnnotationObject>
): string[] {
  const result: string[] = [];

  function traverse(id: string) {
    if (annotationObjects[id]) {
      result.push(id);
      return;
    }
    const group = annotationGroups[id];
    if (group && group.children_ids && group.children_ids.length > 0) {
      group.children_ids.forEach(traverse);
    }
  }

  rootIds.forEach(traverse);
  return result;
}

/**
 * 指定されたノード/グループの親IDを探索する（ルートに存在する場合は null を返す）。
 */
export function findNodeParentId(
  id: string,
  rootIds: string[],
  nodesOrGroups: Record<string, { children_ids?: string[] }>
): string | null {
  if (rootIds.includes(id)) {
    return null;
  }

  for (const [parentId, item] of Object.entries(nodesOrGroups)) {
    if (item.children_ids && item.children_ids.includes(id)) {
      return parentId;
    }
  }

  return null;
}

/**
 * 指定されたノードの階層深度を計算する（Root直下なら 0、その子なら 1...）。
 */
export function getNodeDepth(
  id: string,
  rootIds: string[],
  nodesOrGroups: Record<string, { children_ids?: string[] }>
): number {
  let depth = 0;
  let currentId: string | null = id;

  const visited = new Set<string>();
  while (currentId) {
    if (visited.has(currentId)) break; // 循環参照防止
    visited.add(currentId);

    if (rootIds.includes(currentId)) {
      return depth;
    }

    const parentId = findNodeParentId(currentId, rootIds, nodesOrGroups);
    if (!parentId) {
      // ルートにも親にも見つからない場合は現在のdepthを返す
      return depth;
    }
    depth++;
    currentId = parentId;
  }

  return depth;
}

/**
 * 指定されたノード/グループのすべての子孫IDを再帰的に収集する。
 */
export function collectDescendantIds(
  id: string,
  nodesOrGroups: Record<string, { children_ids?: string[] }>
): string[] {
  const descendants: string[] = [];
  const visited = new Set<string>();

  function traverse(currId: string) {
    if (visited.has(currId)) return;
    visited.add(currId);

    const item = nodesOrGroups[currId];
    if (item && item.children_ids) {
      item.children_ids.forEach((childId) => {
        descendants.push(childId);
        traverse(childId);
      });
    }
  }

  traverse(id);
  return descendants;
}

/**
 * 複数選択されたアイテム群の中で、最も浅い階層（最上位階層）を特定し、
 * その親IDと新規グループを挿入すべきインデックス位置を決定する。
 */
export function findHighestLevelParent(
  targetIds: string[],
  rootIds: string[],
  nodesOrGroups: Record<string, { children_ids?: string[] }>
): { parentId: string | null; insertIndex: number } {
  if (targetIds.length === 0) {
    return { parentId: null, insertIndex: rootIds.length };
  }

  // 1. 各対象ノードの depth と 親ID を計算
  const itemsWithDepth = targetIds.map((id) => {
    const depth = getNodeDepth(id, rootIds, nodesOrGroups);
    const parentId = findNodeParentId(id, rootIds, nodesOrGroups);
    return { id, depth, parentId };
  });

  // 2. 最小 depth（最も浅い階層）を見つける
  const minDepth = Math.min(...itemsWithDepth.map((item) => item.depth));
  const shallowestItems = itemsWithDepth.filter((item) => item.depth === minDepth);

  // 最も浅い階層の最初のアイテムの親を採用
  const primaryItem = shallowestItems[0];
  const targetParentId = primaryItem.parentId;

  // 3. 親のリスト内での挿入インデックスを決定（最初の対象アイテムがあった位置）
  const siblingList = targetParentId
    ? nodesOrGroups[targetParentId]?.children_ids || []
    : rootIds;

  const firstIndex = siblingList.indexOf(primaryItem.id);
  const insertIndex = firstIndex !== -1 ? firstIndex : siblingList.length;

  return { parentId: targetParentId, insertIndex };
}

export interface VisibleTreeNode {
  id: string;
  depth: number;
}

/**
 * 展開状態（expandedIds）を考慮して、現在画面上に表示されるべきノードを深さ優先順で収集する。
 */
export function getVisibleTreeNodes(
  rootIds: string[],
  nodesOrGroups: Record<string, { children_ids?: string[] }>,
  expandedIds: Set<string>
): VisibleTreeNode[] {
  const result: VisibleTreeNode[] = [];

  function traverse(id: string, depth: number) {
    const item = nodesOrGroups[id];
    if (!item) return;
    result.push({ id, depth });

    if (expandedIds.has(id) && item.children_ids && item.children_ids.length > 0) {
      item.children_ids.forEach((childId) => traverse(childId, depth + 1));
    }
  }

  rootIds.forEach((id) => traverse(id, 0));
  return result;
}

/**
 * アノテーションツリー用：展開状態（expandedIds）を考慮して表示ノードを深さ優先順で収集する。
 */
export function getVisibleAnnotationNodes(
  rootIds: string[],
  groups: Record<string, AnnotationGroup>,
  objects: Record<string, AnnotationObject>,
  expandedIds: Set<string>
): VisibleTreeNode[] {
  const result: VisibleTreeNode[] = [];

  function traverse(id: string, depth: number) {
    if (objects[id]) {
      result.push({ id, depth });
      return;
    }
    const grp = groups[id];
    if (grp) {
      result.push({ id, depth });
      if (expandedIds.has(id) && grp.children_ids && grp.children_ids.length > 0) {
        grp.children_ids.forEach((childId) => traverse(childId, depth + 1));
      }
    }
  }

  rootIds.forEach((id) => traverse(id, 0));
  return result;
}
