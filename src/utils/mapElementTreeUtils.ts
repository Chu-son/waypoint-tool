import { v4 as uuidv4 } from 'uuid';

/**
 * 選択されたID群から、親も選択されているような子孫IDを除外し、
 * ツリー全体の走査順（flatOrderedIds）を維持した最上位要素IDリストを返す。
 */
export function filterTopLevelIds(
  selectedIds: string[],
  flatOrderedIds: string[],
  getDescendantIds: (id: string) => string[]
): string[] {
  if (!selectedIds || selectedIds.length === 0) return [];

  const selectedSet = new Set(selectedIds);
  const topLevelIds: string[] = [];

  flatOrderedIds.forEach((id) => {
    if (selectedSet.has(id)) {
      const isDescendantOfTopLevel = topLevelIds.some((pId) => {
        const descendants = getDescendantIds(pId);
        return descendants.includes(id);
      });
      if (!isDescendantOfTopLevel) {
        topLevelIds.push(id);
      }
    }
  });

  // flatOrderedIds に含まれていなかった選択IDがある場合のフォールバック
  selectedIds.forEach((id) => {
    if (!topLevelIds.includes(id)) {
      const isDescendantOfTopLevel = topLevelIds.some((pId) => {
        const descendants = getDescendantIds(pId);
        return descendants.includes(id);
      });
      if (!isDescendantOfTopLevel) {
        topLevelIds.push(id);
      }
    }
  });

  return topLevelIds;
}

export interface IdRemapResult<T> {
  idMap: Map<string, string>; // 旧ID -> 新UUID
  newTopLevelIds: string[];
  newItems: Record<string, T>;
}

/**
 * 任意の階層要素ツリー（children_ids を持つオブジェクト群）について、
 * トップレベルIDおよびその子孫すべてのIDを新UUIDに再採番し、
 * children_ids や親参照フィールド（parent_id, group_id 等）を新UUIDに更新したクローンを作成する。
 */
export function remapHierarchicalIds<T extends { id: string; children_ids?: string[] }>(
  topLevelIds: string[],
  items: Record<string, T>,
  options?: {
    parentRefField?: keyof T;
    onCloneItem?: (cloned: T, origId: string, newId: string) => void;
  }
): IdRemapResult<T> {
  const idMap = new Map<string, string>();
  const allTargetIds: string[] = [];

  // 1. 対象となる全ID（トップレベル＋全子孫）を収集し、新UUIDを発行
  function collectIds(id: string) {
    if (idMap.has(id)) return;
    const item = items[id];
    if (!item) return;

    idMap.set(id, uuidv4());
    allTargetIds.push(id);

    if (item.children_ids && item.children_ids.length > 0) {
      item.children_ids.forEach(collectIds);
    }
  }

  topLevelIds.forEach(collectIds);

  const newItems: Record<string, T> = {};
  const parentRefField = options?.parentRefField;

  // 2. 全アイテムをディープコピーし、ID・リレーションを更新
  allTargetIds.forEach((oldId) => {
    const orig = items[oldId];
    if (!orig) return;

    const newId = idMap.get(oldId)!;
    const cloned: T = structuredClone(orig);
    cloned.id = newId;

    if (cloned.children_ids && cloned.children_ids.length > 0) {
      cloned.children_ids = cloned.children_ids
        .map((cid) => idMap.get(cid) || cid)
        .filter(Boolean);
    }

    if (parentRefField && cloned[parentRefField]) {
      const oldParentId = cloned[parentRefField] as unknown as string;
      const newParentId = idMap.get(oldParentId);
      if (newParentId) {
        (cloned as any)[parentRefField] = newParentId;
      }
    }

    if (options?.onCloneItem) {
      options.onCloneItem(cloned, oldId, newId);
    }

    newItems[newId] = cloned;
  });

  const newTopLevelIds = topLevelIds
    .map((tid) => idMap.get(tid)!)
    .filter(Boolean);

  return {
    idMap,
    newTopLevelIds,
    newItems,
  };
}

export interface NameResolutionOptions {
  existingNames: Set<string>;
  forceCopySuffix?: boolean;
}

/**
 * 重複チェックおよび (Copy) サフィックス付加ルールを共通処理する。
 * - forceCopySuffix が true: 必ず "(Copy)" または "(Copy N)" を付与
 * - forceCopySuffix が false: 既存名と衝突する場合のみ "(Copy)" を付与、衝突がなければ元の名前を維持
 */
export function resolveMapElementName(
  name: string | undefined,
  options: NameResolutionOptions
): string | undefined {
  if (!name) return undefined;

  const { existingNames, forceCopySuffix } = options;

  if (!forceCopySuffix && !existingNames.has(name)) {
    return name;
  }

  // (Copy) パターンのマッチング
  // 例: "Node 1" -> "Node 1 (Copy)"
  // "Node 1 (Copy)" -> "Node 1 (Copy 2)"
  // "Node 1 (Copy 2)" -> "Node 1 (Copy 3)"
  const copyMatch = name.match(/^(.*?)\s*\(Copy(?: (\d+))?\)$/);
  let baseName = name;
  if (copyMatch) {
    baseName = copyMatch[1];
  }

  let candidate = `${baseName} (Copy)`;
  if (!existingNames.has(candidate)) {
    return candidate;
  }

  let count = 2;
  while (existingNames.has(`${baseName} (Copy ${count})`)) {
    count++;
  }

  return `${baseName} (Copy ${count})`;
}
