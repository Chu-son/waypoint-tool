import { WaypointNode, AnnotationGroup, AnnotationObject, InsertionTarget } from '../types/store';

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

/**
 * グループとオブジェクトの両方を含む、深さ優先探索での全アノテーションノードIDリストを取得する。
 */
export function getFlattenedAnnotationNodeIds(
  rootIds: string[],
  groups: Record<string, AnnotationGroup>,
  objects: Record<string, AnnotationObject>
): string[] {
  const result: string[] = [];

  function traverse(id: string) {
    if (objects[id]) {
      result.push(id);
      return;
    }
    const grp = groups[id];
    if (grp) {
      result.push(id);
      if (grp.children_ids && grp.children_ids.length > 0) {
        grp.children_ids.forEach(traverse);
      }
    }
  }

  rootIds.forEach(traverse);
  return result;
}

/**
 * リスト上の表示順（orderedIds）に基づいて、Shift範囲選択されたID配列を計算する。
 */
export function computeRangeSelection(
  targetId: string,
  lastSelectedId: string | null,
  orderedIds: string[],
  currentSelectedIds: string[],
  isCtrlOrMeta: boolean
): string[] {
  if (!lastSelectedId || !orderedIds.includes(lastSelectedId) || !orderedIds.includes(targetId)) {
    return [targetId];
  }

  const fromIdx = orderedIds.indexOf(lastSelectedId);
  const toIdx = orderedIds.indexOf(targetId);
  const start = Math.min(fromIdx, toIdx);
  const end = Math.max(fromIdx, toIdx);
  const rangeIds = orderedIds.slice(start, end + 1);

  if (isCtrlOrMeta) {
    return Array.from(new Set([...currentSelectedIds, ...rangeIds]));
  }
  return rangeIds;
}

/**
 * ドラッグ中のアイテムとドロップ先アイテムのインデックス関係から、挿入方向（'before' | 'after'）を計算する。
 */
export function computeDragDropPosition(
  activeId: string,
  overId: string,
  visibleIds: string[]
): 'before' | 'after' {
  const activeIdx = visibleIds.indexOf(activeId);
  const overIdx = visibleIds.indexOf(overId);
  return activeIdx < overIdx ? 'after' : 'before';
}

/**
 * 既存の名前リストから、指定プレフィックスに続く最小の未使用正の整数（連番）を割り当てた名前を生成する。
 * 例: prefix = "Point", existingNames = ["Point 1", "Point 2", "Point 4"] -> "Point 3"
 */
export function getNextSequentialName(
  prefix: string,
  existingNames: (string | undefined | null)[]
): string {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escapedPrefix}\\s+(\\d+)$`);
  const usedNumbers = new Set<number>();

  existingNames.forEach((name) => {
    if (!name) return;
    const match = name.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) {
        usedNumbers.add(num);
      }
    }
  });

  let num = 1;
  while (usedNumbers.has(num)) {
    num++;
  }

  return `${prefix} ${num}`;
}

/**
 * insertionTarget より後方にあるノードIDの Set を返す。
 * insertionTarget が null の場合（末尾挿入）は空の Set を返す。
 */
export function getNodesAfterInsertionTarget(
  rootNodeIds: string[],
  nodes: Record<string, WaypointNode>,
  insertionTarget: InsertionTarget | null
): Set<string> {
  const result = new Set<string>();
  if (!insertionTarget) return result;

  const target = insertionTarget;
  let passedInsertion = false;

  function traverseList(parentId: string | null, list: string[]) {
    list.forEach((id, idx) => {
      if (!passedInsertion && target.parentId === parentId && target.index === idx) {
        passedInsertion = true;
      }
      if (passedInsertion) {
        result.add(id);
      }
      const node = nodes[id];
      if (node && node.children_ids && node.children_ids.length > 0) {
        traverseList(id, node.children_ids);
      }
    });

    if (!passedInsertion && target.parentId === parentId && target.index >= list.length) {
      passedInsertion = true;
    }
  }

  traverseList(null, rootNodeIds);
  return result;
}

/**
 * 深さ優先探索 (DFS) 順で走査し、insertionTarget の直前にある有効なマニュアルウェイポイント（transform を保持）を返す。
 * insertionTarget が null の場合は、ツリー全体の最後のマニュアルウェイポイントを返す。
 */
export function getPrecedingManualWaypoint(
  rootNodeIds: string[],
  nodes: Record<string, WaypointNode>,
  insertionTarget: InsertionTarget | null
): WaypointNode | null {
  let lastManual: WaypointNode | null = null;
  let targetFound = false;
  let result: WaypointNode | null = null;

  function traverse(parentId: string | null, list: string[]) {
    for (let i = 0; i < list.length; i++) {
      if (insertionTarget && !targetFound && insertionTarget.parentId === parentId && insertionTarget.index === i) {
        targetFound = true;
        result = lastManual;
        return;
      }
      const id = list[i];
      const node = nodes[id];
      if (!node) continue;

      if (node.type === 'manual' && node.transform) {
        lastManual = node;
      }

      if (node.children_ids && node.children_ids.length > 0) {
        traverse(id, node.children_ids);
        if (targetFound) return;
      }
    }

    if (insertionTarget && !targetFound && insertionTarget.parentId === parentId && insertionTarget.index >= list.length) {
      targetFound = true;
      result = lastManual;
      return;
    }
  }

  traverse(null, rootNodeIds);
  return insertionTarget ? (targetFound ? result : lastManual) : lastManual;
}

/**
 * insertionTarget の親ノード存在チェックおよびインデックス範囲の安全クランプを行う。
 * 親が存在しない場合はルートへフォールバックし、インデックスを有効範囲 [0, length] にクランプする。
 */
export function validateAndCorrectInsertionTarget(
  target: InsertionTarget | null,
  rootNodeIds: string[],
  nodes: Record<string, WaypointNode>
): InsertionTarget | null {
  if (!target) return null;

  let effectiveParentId = target.parentId;
  let maxLen = rootNodeIds.length;

  if (effectiveParentId !== null) {
    const parentNode = nodes[effectiveParentId];
    if (!parentNode) {
      effectiveParentId = null;
      maxLen = rootNodeIds.length;
    } else {
      maxLen = (parentNode.children_ids || []).length;
    }
  }

  const safeIndex = Math.max(0, Math.min(target.index, maxLen));
  return {
    parentId: effectiveParentId,
    index: safeIndex,
  };
}

