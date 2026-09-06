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
 * 汎用的なツリー先祖ID探索関数（親からルートに向かって全先祖IDを収集、循環参照保護付き）
 */
export function getAncestorIds(
  id: string,
  getParentId: (currId: string) => string | null
): string[] {
  const ancestors: string[] = [];
  const visited = new Set<string>([id]);
  let curr = getParentId(id);
  while (curr && !visited.has(curr)) {
    visited.add(curr);
    ancestors.push(curr);
    curr = getParentId(curr);
  }
  return ancestors;
}

/**
 * 選択された要素群（selectedIds）から、子孫に選択要素を持つすべての親コンテナIDを算出する
 */
export function getHighlightedContainerIds(
  selectedIds: string[],
  getParentId: (currId: string) => string | null
): Set<string> {
  const highlighted = new Set<string>();
  for (const id of selectedIds) {
    const ancestors = getAncestorIds(id, getParentId);
    for (const ancId of ancestors) {
      highlighted.add(ancId);
    }
  }
  return highlighted;
}

/**
 * アノテーション用親ID解決アダプター
 */
export function getAnnotationParentId(
  id: string,
  rootAnnotationIds: string[],
  annotationGroups: Record<string, AnnotationGroup>,
  annotationObjects: Record<string, AnnotationObject>
): string | null {
  const obj = annotationObjects[id];
  if (obj) return obj.group_id ?? null;
  const grp = annotationGroups[id];
  if (grp) return grp.parent_id ?? findNodeParentId(id, rootAnnotationIds, annotationGroups);
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
 * 挿入先コンテナとして受け入れ可能かを判定する（Rootまたはmanual_group/groupのみ）。
 */
export function isInsertableContainer(node: WaypointNode | null | undefined): boolean {
  if (!node) return true; // Rootは挿入可能
  return node.type === 'manual_group' || node.type === 'group';
}

/**
 * 与えられたノードIDリストを展開し、グループノードが含まれる場合はその全子孫ノードID（generatorは除外）を含めたID配列を返す。
 */
export function expandSelectionWithDescendants(
  ids: string[],
  nodes: Record<string, WaypointNode>
): string[] {
  const expanded = new Set<string>();
  ids.forEach((id) => {
    expanded.add(id);
    const node = nodes[id];
    if (node && (node.type === 'manual_group' || node.type === 'group')) {
      collectDescendantIds(id, nodes).forEach((dId) => expanded.add(dId));
    }
  });
  return Array.from(expanded);
}

/**
 * insertionTarget の親ノード存在チェック、非コンテナ（generator等）からの強制エスケープ、
 * およびインデックス範囲の安全クランプを行う。
 */
export function validateAndCorrectInsertionTarget(
  target: InsertionTarget | null,
  rootNodeIds: string[],
  nodes: Record<string, WaypointNode>
): InsertionTarget | null {
  if (!target) return null;

  let effectiveParentId = target.parentId;
  let effectiveIndex = target.index;

  // 親が存在しない場合はRootへ
  if (effectiveParentId !== null && !nodes[effectiveParentId]) {
    effectiveParentId = null;
  }

  // 親が generator 等の挿入不能コンテナである場合は、外側（Generator直後）へ自動エスケープ
  while (effectiveParentId !== null && (!nodes[effectiveParentId] || !isInsertableContainer(nodes[effectiveParentId]))) {
    const invalidParentId = effectiveParentId;
    const grandParentId = findNodeParentId(invalidParentId, rootNodeIds, nodes);
    const siblings = grandParentId ? (nodes[grandParentId]?.children_ids || []) : rootNodeIds;
    const parentIdx = siblings.indexOf(invalidParentId);
    effectiveParentId = grandParentId;
    effectiveIndex = parentIdx !== -1 ? parentIdx + 1 : siblings.length;
  }

  const siblings = effectiveParentId !== null
    ? (nodes[effectiveParentId]?.children_ids || [])
    : rootNodeIds;

  const safeIndex = Math.max(0, Math.min(effectiveIndex, siblings.length));
  return {
    parentId: effectiveParentId,
    index: safeIndex,
  };
}

/**
 * 折りたたまれたグループ（非表示コンテナ）の内部に insertionTarget がある場合、
 * 可視境界原則（Visible Boundary Invariant）に基づき、
 * 最も近い可視先祖の外側直後（親コンテナ内での該当先祖の直後）へエスケープ（正規化）する。
 */
export function escapeCollapsedInsertionTarget(
  target: InsertionTarget | null,
  expandedNodes: Set<string>,
  rootNodeIds: string[],
  nodes: Record<string, WaypointNode>
): InsertionTarget | null {
  if (!target || target.parentId === null) return target;

  let currentParentId: string | null = target.parentId;
  let needsEscape = false;
  let escapeAncestorId: string | null = null;
  const visited = new Set<string>();

  while (currentParentId) {
    if (visited.has(currentParentId)) break;
    visited.add(currentParentId);

    if (!expandedNodes.has(currentParentId)) {
      needsEscape = true;
      escapeAncestorId = currentParentId;
    }
    currentParentId = findNodeParentId(currentParentId, rootNodeIds, nodes);
  }

  if (needsEscape && escapeAncestorId) {
    const parentOfEscape = findNodeParentId(escapeAncestorId, rootNodeIds, nodes);
    const siblings = parentOfEscape ? (nodes[parentOfEscape]?.children_ids || []) : rootNodeIds;
    const idx = siblings.indexOf(escapeAncestorId);
    return {
      parentId: parentOfEscape,
      index: idx !== -1 ? idx + 1 : 0,
    };
  }

  return target;
}

/**
 * Head Anchor (P, HEAD) の解決:
 * コンテナ P の先頭境界を、Pの生存・消滅・解除状態に応じて新ツリーへ写像する。
 */
function resolveHeadAnchor(
  parentId: string | null,
  oldRootIds: string[],
  oldNodes: Record<string, WaypointNode>,
  newRootIds: string[],
  newNodes: Record<string, WaypointNode>,
  visited: Set<string> = new Set()
): { parentId: string | null; index: number } {
  if (parentId === null) {
    return { parentId: null, index: 0 };
  }

  // 親コンテナが新ツリーに存在し、挿入可能コンテナである場合
  if (newNodes[parentId] && isInsertableContainer(newNodes[parentId])) {
    return { parentId, index: 0 };
  }

  if (visited.has(parentId)) {
    return { parentId: null, index: 0 };
  }
  visited.add(parentId);

  // 親コンテナが解除(ungroup)された場合: 旧子ノードのうち新ツリーに生存している先頭の子の直前へ写像
  const oldChildren = oldNodes[parentId]?.children_ids || [];
  for (const cid of oldChildren) {
    if (newNodes[cid]) {
      const newParent = findNodeParentId(cid, newRootIds, newNodes);
      const newSibs = newParent ? (newNodes[newParent]?.children_ids || []) : newRootIds;
      const idx = newSibs.indexOf(cid);
      if (idx !== -1) {
        return { parentId: newParent, index: idx };
      }
    }
  }

  // 親コンテナが削除された場合: 旧ツリーにおける親の位置(oldGrandParentId, oldParentIdx)を特定
  const oldGrandParentId = findNodeParentId(parentId, oldRootIds, oldNodes);
  const oldParentSiblings = oldGrandParentId
    ? (oldNodes[oldGrandParentId]?.children_ids || [])
    : oldRootIds;
  const oldParentIdx = oldParentSiblings.indexOf(parentId);

  if (oldParentIdx !== -1) {
    // 1. 旧コンテナより手前の生存兄弟を後退探索
    for (let k = oldParentIdx - 1; k >= 0; k--) {
      const prevId = oldParentSiblings[k];
      if (newNodes[prevId]) {
        const newParent = findNodeParentId(prevId, newRootIds, newNodes);
        const newSibs = newParent ? (newNodes[newParent]?.children_ids || []) : newRootIds;
        const idx = newSibs.indexOf(prevId);
        if (idx !== -1) {
          return { parentId: newParent, index: idx + 1 };
        }
      }
    }

    // 2. 手前に生存兄弟がいなければ後続の生存兄弟を前方探索
    for (let k = oldParentIdx + 1; k < oldParentSiblings.length; k++) {
      const nextId = oldParentSiblings[k];
      if (newNodes[nextId]) {
        const newParent = findNodeParentId(nextId, newRootIds, newNodes);
        const newSibs = newParent ? (newNodes[newParent]?.children_ids || []) : newRootIds;
        const idx = newSibs.indexOf(nextId);
        if (idx !== -1) {
          return { parentId: newParent, index: idx };
        }
      }
    }
  }

  // 3. 祖先を再帰的に解決
  return resolveHeadAnchor(oldGrandParentId, oldRootIds, oldNodes, newRootIds, newNodes, visited);
}

/**
 * ツリー構造の変形（ノード削除、グループ化、グループ解除、移動、複製など）前後のトポロジーから、
 * 直前ノード（隣接論理境界）を追跡して新しい挿入位置（InsertionTarget）を決定論的に導出する写像関数。
 */
export function mapInsertionTarget(
  currentTarget: InsertionTarget | null,
  oldRootIds: string[],
  oldNodes: Record<string, WaypointNode>,
  newRootIds: string[],
  newNodes: Record<string, WaypointNode>
): InsertionTarget | null {
  if (!currentTarget) return null;

  const oldSiblings = currentTarget.parentId
    ? (oldNodes[currentTarget.parentId]?.children_ids || [])
    : oldRootIds;

  let mapped: { parentId: string | null; index: number };

  if (currentTarget.index === 0) {
    mapped = resolveHeadAnchor(
      currentTarget.parentId,
      oldRootIds,
      oldNodes,
      newRootIds,
      newNodes
    );
  } else {
    // index > 0: After Anchor (S = siblings[index - 1], AFTER)
    const anchorIdx = Math.min(currentTarget.index - 1, oldSiblings.length - 1);
    const anchorId = oldSiblings[anchorIdx];

    if (anchorId && newNodes[anchorId]) {
      // アンカーノードが存続している場合、その新しい位置の直後へ写像
      const newParent = findNodeParentId(anchorId, newRootIds, newNodes);
      const newSiblings = newParent ? (newNodes[newParent]?.children_ids || []) : newRootIds;
      const idx = newSiblings.indexOf(anchorId);
      mapped = {
        parentId: newParent,
        index: idx !== -1 ? idx + 1 : newSiblings.length,
      };
    } else {
      // アンカーノードが削除された場合: 直前の生存兄弟ノードを後退探索
      let survivorFound = false;
      let foundParent: string | null = null;
      let foundIndex = 0;

      for (let k = anchorIdx - 1; k >= 0; k--) {
        const prevId = oldSiblings[k];
        if (newNodes[prevId]) {
          foundParent = findNodeParentId(prevId, newRootIds, newNodes);
          const newSiblings = foundParent ? (newNodes[foundParent]?.children_ids || []) : newRootIds;
          const idx = newSiblings.indexOf(prevId);
          if (idx !== -1) {
            foundIndex = idx + 1;
            survivorFound = true;
            break;
          }
        }
      }

      if (survivorFound) {
        mapped = { parentId: foundParent, index: foundIndex };
      } else {
        // 手前に生存兄弟が存在しない場合: コンテナ先頭境界 (P, HEAD) として解決
        mapped = resolveHeadAnchor(
          currentTarget.parentId,
          oldRootIds,
          oldNodes,
          newRootIds,
          newNodes
        );
      }
    }
  }

  // Generator 内部エスケープおよび有効コンテナ検証
  return validateAndCorrectInsertionTarget(
    mapped,
    newRootIds,
    newNodes
  );
}

export interface MultiDepthDropOptions {
  activeId: string;
  overId: string;
  relativeX: number; // ドロップ対象要素の左端からの相対X座標 (px) または offset
  position: 'before' | 'after';
  rootNodeIds: string[];
  nodes: Record<string, WaypointNode>;
  expandedNodes: Set<string>;
  indentThreshold?: number; // default 28px
}

/**
 * グループ境界（グループヘッダーまたは末尾子ノード）へのドラッグドロップ時、
 * 水平X座標（インデント量）に基づいて深さ（Group内 vs Group外/親レベル）を判定して
 * 適切な InsertionTarget を導出する。
 */
export function determineMultiDepthDropTarget(
  options: MultiDepthDropOptions
): InsertionTarget | null {
  const {
    activeId: _activeId,
    overId,
    relativeX,
    position,
    rootNodeIds,
    nodes,
    expandedNodes,
    indentThreshold = 28,
  } = options;

  if (rootNodeIds.length === 0) return null;

  const overNode = nodes[overId];
  const isOverContainer = overNode && (overNode.type === 'manual_group' || overNode.type === 'group' || overNode.type === 'generator');
  const isOverInsertable = isInsertableContainer(overNode);
  const isOverExpanded = isOverContainer && expandedNodes.has(overId);

  // 1. position === 'before' の場合
  if (position === 'before') {
    let parentId = findNodeParentId(overId, rootNodeIds, nodes);
    let refId = overId;
    while (parentId && !isInsertableContainer(nodes[parentId])) {
      refId = parentId;
      parentId = findNodeParentId(parentId, rootNodeIds, nodes);
    }
    const siblings = parentId ? (nodes[parentId]?.children_ids || []) : rootNodeIds;
    const idx = siblings.indexOf(refId);
    return {
      parentId,
      index: Math.max(0, idx !== -1 ? idx : 0),
    };
  }

  // 2. position === 'after' の場合
  // (A) overId が挿入可能なグループヘッダー自身である場合
  if (isOverInsertable && isOverContainer) {
    if (isOverExpanded) {
      if (relativeX >= indentThreshold) {
        // Group内先頭
        return { parentId: overId, index: 0 };
      } else {
        // Group外直後
        let parentId = findNodeParentId(overId, rootNodeIds, nodes);
        while (parentId && !isInsertableContainer(nodes[parentId])) {
          parentId = findNodeParentId(parentId, rootNodeIds, nodes);
        }
        const siblings = parentId ? (nodes[parentId]?.children_ids || []) : rootNodeIds;
        const idx = siblings.indexOf(overId);
        return idx !== -1 && parentId === null && idx === rootNodeIds.length - 1
          ? null
          : { parentId, index: idx !== -1 ? idx + 1 : siblings.length };
      }
    }
    // 折りたたまれている場合のヘッダー直後ドロップ:
    // 可視境界原則により常にGroup外
    let parentId = findNodeParentId(overId, rootNodeIds, nodes);
    while (parentId && !isInsertableContainer(nodes[parentId])) {
      parentId = findNodeParentId(parentId, rootNodeIds, nodes);
    }
    const siblings = parentId ? (nodes[parentId]?.children_ids || []) : rootNodeIds;
    const idx = siblings.indexOf(overId);
    return idx !== -1 && parentId === null && idx === rootNodeIds.length - 1
      ? null
      : { parentId, index: idx !== -1 ? idx + 1 : siblings.length };
  }

  // (B) overId が通常ノードまたは子ノードである場合
  let immediateParentId = findNodeParentId(overId, rootNodeIds, nodes);
  let refId = overId;
  while (immediateParentId && !isInsertableContainer(nodes[immediateParentId])) {
    refId = immediateParentId;
    immediateParentId = findNodeParentId(immediateParentId, rootNodeIds, nodes);
  }

  const siblings = immediateParentId ? (nodes[immediateParentId]?.children_ids || []) : rootNodeIds;
  const idx = siblings.indexOf(refId);

  // immediateParentId 内で最後の兄弟かどうかを判定
  const isLastSibling = idx !== -1 && idx === siblings.length - 1;

  if (!isLastSibling || immediateParentId === null) {
    // 途中のノードまたはRoot直下のノード（親境界なし）
    if (immediateParentId === null && idx === rootNodeIds.length - 1) {
      return null; // Root末尾
    }
    return {
      parentId: immediateParentId,
      index: idx !== -1 ? idx + 1 : siblings.length,
    };
  }

  // 末尾子ノードの場合: 複数の先祖境界候補を収集 (Innermost -> Outermost)
  interface Candidate {
    parentId: string | null;
    index: number;
    depth: number;
  }

  const candidates: Candidate[] = [];

  // Level 0: immediateParentId の末尾（Group内）
  const baseDepth = getNodeDepth(overId, rootNodeIds, nodes);
  candidates.push({
    parentId: immediateParentId,
    index: siblings.length,
    depth: baseDepth,
  });

  // Level 1+: 祖先がその親の末尾である限り上に辿る
  let currChildId: string = immediateParentId;
  let currParentId = findNodeParentId(currChildId, rootNodeIds, nodes);

  while (true) {
    while (currParentId && !isInsertableContainer(nodes[currParentId])) {
      currChildId = currParentId;
      currParentId = findNodeParentId(currParentId, rootNodeIds, nodes);
    }

    const currSiblings = currParentId ? (nodes[currParentId]?.children_ids || []) : rootNodeIds;
    const currIdx = currSiblings.indexOf(currChildId);

    const targetIndex = currIdx !== -1 ? currIdx + 1 : currSiblings.length;
    const depth = currParentId ? getNodeDepth(currParentId, rootNodeIds, nodes) + 1 : 0;

    candidates.push({
      parentId: currParentId,
      index: targetIndex,
      depth,
    });

    // currChildId がその親の末尾でなければこれ以上祖先へエスケープできない
    if (currIdx === -1 || currIdx < currSiblings.length - 1 || currParentId === null) {
      break;
    }

    currChildId = currParentId;
    currParentId = findNodeParentId(currParentId, rootNodeIds, nodes);
  }

  if (candidates.length === 1) {
    const c = candidates[0];
    return c.parentId === null && c.index >= rootNodeIds.length ? null : { parentId: c.parentId, index: c.index };
  }

  if (relativeX >= indentThreshold) {
    // ユーザーが右側にドラッグ -> Group内（最深）
    const c = candidates[0];
    return { parentId: c.parentId, index: c.index };
  } else {
    // ユーザーが左側にドラッグ -> Group外（親コンテナまたはRoot）
    const c = candidates[candidates.length - 1];
    return c.parentId === null && c.index >= rootNodeIds.length ? null : { parentId: c.parentId, index: c.index };
  }
}

