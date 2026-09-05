import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { WaypointNode, InsertionTarget } from '../../types/store';
import { v4 as uuidv4 } from 'uuid';
import {
  findHighestLevelParent,
  findNodeParentId,
  collectDescendantIds,
  getFlattenedNodeIds,
  getNextSequentialName,
  validateAndCorrectInsertionTarget,
  isInsertableContainer,
  expandSelectionWithDescendants,
  mapInsertionTarget,
} from '../../utils/treeUtils';

export type NodeSlice = {
  nodes: Record<string, WaypointNode>;
  rootNodeIds: string[];
  selectedNodeIds: string[];
  insertionTarget: InsertionTarget | null;
  
  anchorNodeId: string | null;
  setAnchorNode: (id: string | null) => void;
  addNode: (node: WaypointNode, parentId?: string | null, options?: { skipRecalculate?: boolean }) => void;
  addNodes: (
    nodes: WaypointNode[],
    parentId?: string | null,
    targetIndex?: number,
    options?: { skipRecalculate?: boolean }
  ) => void;
  updateNode: (id: string, updates: Partial<WaypointNode>, options?: { skipRecalculate?: boolean }) => void;
  updateNodes: (updates: Record<string, Partial<WaypointNode>>, options?: { skipRecalculate?: boolean }) => void;
  renameNode: (id: string, name: string) => void;
  groupNodes: (selectedIds: string[]) => string | null;
  ungroupNode: (groupId: string) => void;
  moveNodesInTree: (movingIds: string[], targetId: string, position: 'before' | 'after' | 'inside') => void;
  removeNodes: (ids: string[]) => void;
  reorderNodes: (fromIndex: number, toIndex: number) => void;
  reorderMultipleNodes: (movingIds: string[], targetId: string, position: 'before' | 'after') => void;
  selectNodes: (ids: string[], multi?: boolean) => void;
  selectAllNodes: () => void;
  deselectAllNodes: () => void;
  explodeGenerator: (id: string) => void;
  duplicateNodes: (ids: string[]) => string[];
  setInsertionTarget: (target: InsertionTarget | null) => void;
};

export const createNodeSlice: StateCreator<AppState, [], [], NodeSlice> = (set, get) => ({
  nodes: {},
  rootNodeIds: [],
  selectedNodeIds: [],
  insertionTarget: null,
  anchorNodeId: null,

  setAnchorNode: (id: string | null) => set({ anchorNodeId: id }),

  setInsertionTarget: (target: InsertionTarget | null) => set((state) => ({
    insertionTarget: validateAndCorrectInsertionTarget(target, state.rootNodeIds, state.nodes),
  })),

  addNodes: (
    nodesToAdd: WaypointNode[],
    parentId?: string | null,
    targetIndex?: number,
    options?: { skipRecalculate?: boolean }
  ) => {
    if (!nodesToAdd || nodesToAdd.length === 0) return;
    get().pushHistorySnapshot();
    set((state) => {
      const newNodes = { ...state.nodes };
      nodesToAdd.forEach((n) => {
        newNodes[n.id] = n;
      });
      const nodeIds = nodesToAdd.map((n) => n.id);
      let newRootIds = [...state.rootNodeIds];

      const isExplicitPlacement = parentId !== undefined || targetIndex !== undefined;
      const effectiveParentId = parentId !== undefined
        ? (parentId ?? undefined)
        : (state.insertionTarget?.parentId ?? undefined);

      let nextInsertionTarget = state.insertionTarget;

      if (effectiveParentId && newNodes[effectiveParentId]) {
        const parent = newNodes[effectiveParentId];
        const children = [...(parent.children_ids || [])];
        let insIdx = targetIndex !== undefined
          ? Math.min(targetIndex, children.length)
          : children.length;

        if (!isExplicitPlacement && state.insertionTarget?.parentId === effectiveParentId && state.insertionTarget.index >= 0) {
          insIdx = Math.min(state.insertionTarget.index, children.length);
        }

        children.splice(insIdx, 0, ...nodeIds);
        newNodes[effectiveParentId] = {
          ...parent,
          children_ids: children,
        };

        if (!isExplicitPlacement && state.insertionTarget?.parentId === effectiveParentId && state.insertionTarget.index >= 0) {
          nextInsertionTarget = { parentId: effectiveParentId, index: insIdx + nodeIds.length };
        }
      } else {
        let insIdx = targetIndex !== undefined
          ? Math.min(targetIndex, newRootIds.length)
          : newRootIds.length;

        if (!isExplicitPlacement && state.insertionTarget?.parentId === null && state.insertionTarget !== null && state.insertionTarget.index >= 0) {
          insIdx = Math.min(state.insertionTarget.index, newRootIds.length);
        }

        newRootIds.splice(insIdx, 0, ...nodeIds);

        if (!isExplicitPlacement && state.insertionTarget?.parentId === null && state.insertionTarget.index >= 0) {
          nextInsertionTarget = { parentId: null, index: insIdx + nodeIds.length };
        }
      }

      return {
        nodes: newNodes,
        rootNodeIds: newRootIds,
        insertionTarget: validateAndCorrectInsertionTarget(nextInsertionTarget, newRootIds, newNodes),
        isDirty: true,
      };
    });
    if (!options?.skipRecalculate && get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(150);
    }
  },

  addNode: (node: WaypointNode, parentId?: string | null, options?: { skipRecalculate?: boolean }) => {
    get().addNodes([node], parentId, undefined, options);
  },

  updateNode: (id: string, updates: Partial<WaypointNode>, options?: { skipRecalculate?: boolean }) => {
    if (!options?.skipRecalculate) {
      get().pushHistorySnapshot();
    }
    set((state) => {
      const existing = state.nodes[id];
      if (!existing) return state;
      return {
        nodes: {
          ...state.nodes,
          [id]: { ...existing, ...updates }
        },
        isDirty: true
      };
    });
    if (!options?.skipRecalculate && get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(200);
    }
  },

  renameNode: (id: string, name: string) => {
    get().updateNode(id, { name });
  },

  updateNodes: (updates: Record<string, Partial<WaypointNode>>, options?: { skipRecalculate?: boolean }) => {
    if (!options?.skipRecalculate) {
      get().pushHistorySnapshot();
    }
    set((state) => {
      const nextNodes = { ...state.nodes };
      Object.entries(updates).forEach(([id, upd]) => {
        if (nextNodes[id]) {
          nextNodes[id] = { ...nextNodes[id], ...upd };
        }
      });
      return {
        nodes: nextNodes,
        isDirty: true
      };
    });
    if (!options?.skipRecalculate && get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(200);
    }
  },

  groupNodes: (selectedIds: string[]): string | null => {
    if (!selectedIds || selectedIds.length === 0) return null;
    get().pushHistorySnapshot();

    const newGroupId = uuidv4();

    set((state) => {
      // 1. 最上位階層の親IDと挿入インデックスを特定
      const { parentId: targetParentId, insertIndex } = findHighestLevelParent(
        selectedIds,
        state.rootNodeIds,
        state.nodes
      );

      // 2. 連番でグループ名を生成 ("Group 1", "Group 2", ...)
      const existingNames = Object.values(state.nodes)
        .filter((n) => n.type === 'manual_group' || n.type === 'group' || n.type === 'generator')
        .map((n) => n.name);
      const groupName = getNextSequentialName('Group', existingNames);

      // 3. 選択されたアイテム群の順序をツリー全体の走査順でソート
      const flatNodeIds = getFlattenedNodeIds(state.rootNodeIds, state.nodes);
      const selectedSet = new Set(selectedIds);

      // 親が選択されている場合、その子孫は children_ids 内に既に含まれているため、トップレベル選択ノードのみをグループ直下に入れる
      const directMovingIds: string[] = [];
      flatNodeIds.forEach((id) => {
        if (selectedSet.has(id)) {
          // すでに movingIds のいずれかの子孫であれば除外
          const isDescendantOfSelected = directMovingIds.some((parentId) => {
            const descendants = collectDescendantIds(parentId, state.nodes);
            return descendants.includes(id);
          });
          if (!isDescendantOfSelected) {
            directMovingIds.push(id);
          }
        }
      });

      if (directMovingIds.length === 0) return state;

      const newNodes = { ...state.nodes };
      let newRootIds = [...state.rootNodeIds];
      const movingSet = new Set(directMovingIds);

      // 4. 移動するノードを元の親 / Root から削除
      newRootIds = newRootIds.filter((id) => !movingSet.has(id));
      Object.keys(newNodes).forEach((nid) => {
        const node = newNodes[nid];
        if (node.children_ids) {
          newNodes[nid] = {
            ...node,
            children_ids: node.children_ids.filter((cid) => !movingSet.has(cid)),
          };
        }
      });

      // 5. 新規グループノードを作成
      const newGroupNode: WaypointNode = {
        id: newGroupId,
        type: 'manual_group',
        name: groupName,
        children_ids: directMovingIds,
      };
      newNodes[newGroupId] = newGroupNode;

      // 6. 新規グループを配置
      if (targetParentId && newNodes[targetParentId]) {
        const parentNode = newNodes[targetParentId];
        const currentChildren = [...(parentNode.children_ids || [])];
        const safeIdx = Math.min(insertIndex, currentChildren.length);
        currentChildren.splice(safeIdx, 0, newGroupId);
        newNodes[targetParentId] = {
          ...parentNode,
          children_ids: currentChildren,
        };
      } else {
        const safeIdx = Math.min(insertIndex, newRootIds.length);
        newRootIds.splice(safeIdx, 0, newGroupId);
      }

      const nextTarget = mapInsertionTarget(
        state.insertionTarget,
        state.rootNodeIds,
        state.nodes,
        newRootIds,
        newNodes
      );

      const nextSelected = expandSelectionWithDescendants([newGroupId], newNodes);
      return {
        nodes: newNodes,
        rootNodeIds: newRootIds,
        insertionTarget: nextTarget,
        selectedNodeIds: nextSelected,
        selection: { type: 'nodes', ids: nextSelected },
        selectedAnnotationIds: [],
        activeCustomLayerId: null,
        selectedEditObjectId: null,
        isDirty: true,
      };
    });

    if (get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(100);
    }

    return newGroupId;
  },

  ungroupNode: (groupId: string) => {
    get().pushHistorySnapshot();
    set((state) => {
      const groupNode = state.nodes[groupId];
      if (!groupNode || (groupNode.type !== 'manual_group' && groupNode.type !== 'group' && groupNode.type !== 'generator')) {
        return state;
      }

      const childIds = groupNode.children_ids || [];
      const newNodes = { ...state.nodes };
      delete newNodes[groupId];

      let newRootIds = [...state.rootNodeIds];
      const rootIdx = newRootIds.indexOf(groupId);

      if (rootIdx !== -1) {
        newRootIds.splice(rootIdx, 1, ...childIds);
      } else {
        Object.keys(newNodes).forEach((nid) => {
          const parent = newNodes[nid];
          if (parent.children_ids && parent.children_ids.includes(groupId)) {
            const idx = parent.children_ids.indexOf(groupId);
            const nextChildren = [...parent.children_ids];
            nextChildren.splice(idx, 1, ...childIds);
            newNodes[nid] = {
              ...parent,
              children_ids: nextChildren,
            };
          }
        });
      }

      const nextTarget = mapInsertionTarget(
        state.insertionTarget,
        state.rootNodeIds,
        state.nodes,
        newRootIds,
        newNodes
      );

      const nextSelected = expandSelectionWithDescendants(childIds, newNodes);
      return {
        nodes: newNodes,
        rootNodeIds: newRootIds,
        insertionTarget: nextTarget,
        selectedNodeIds: nextSelected,
        selection: nextSelected.length > 0 ? { type: 'nodes', ids: nextSelected } : { type: 'none' },
        selectedAnnotationIds: [],
        activeCustomLayerId: null,
        selectedEditObjectId: null,
        isDirty: true,
      };
    });

    if (get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(100);
    }
  },

  explodeGenerator: (id: string) => {
    get().ungroupNode(id);
  },

  moveNodesInTree: (movingIds: string[], targetId: string, position: 'before' | 'after' | 'inside') => {
    if (!movingIds || movingIds.length === 0 || !targetId) return;
    if (movingIds.includes(targetId) && position !== 'inside') return;

    if (position === 'inside') {
      const targetNode = get().nodes[targetId];
      if (!targetNode || !isInsertableContainer(targetNode)) {
        return; // generator や manual へのドロップ投入拒絶
      }
    }

    get().pushHistorySnapshot();

    set((state) => {
      // 1. 循環参照防止: targetId が movingIds のいずれかの子孫であれば操作を拒否
      for (const movingId of movingIds) {
        const descendants = collectDescendantIds(movingId, state.nodes);
        if (descendants.includes(targetId) || movingId === targetId) {
          return state; // 循環参照を防止
        }
      }

      // 2. 移動対象のトップレベルノードのみを順序を維持して抽出
      const flatNodeIds = getFlattenedNodeIds(state.rootNodeIds, state.nodes);
      const movingSet = new Set(movingIds);
      const directMovingIds: string[] = [];

      flatNodeIds.forEach((id) => {
        if (movingSet.has(id)) {
          const isDescendant = directMovingIds.some((pId) => {
            const desc = collectDescendantIds(pId, state.nodes);
            return desc.includes(id);
          });
          if (!isDescendant) {
            directMovingIds.push(id);
          }
        }
      });

      if (directMovingIds.length === 0) return state;

      const directMovingSet = new Set(directMovingIds);
      const newNodes = { ...state.nodes };
      let newRootIds = [...state.rootNodeIds];

      // 3. 元の親 / Root から削除
      newRootIds = newRootIds.filter((id) => !directMovingSet.has(id));
      Object.keys(newNodes).forEach((nid) => {
        const node = newNodes[nid];
        if (node.children_ids) {
          newNodes[nid] = {
            ...node,
            children_ids: node.children_ids.filter((cid) => !directMovingSet.has(cid)),
          };
        }
      });

      // 4. ドロップ位置に挿入
      if (position === 'inside') {
        const targetNode = newNodes[targetId];
        if (targetNode) {
          newNodes[targetId] = {
            ...targetNode,
            children_ids: [...(targetNode.children_ids || []), ...directMovingIds],
          };
        }
      } else {
        // targetId の親を特定
        const targetParentId = findNodeParentId(targetId, newRootIds, newNodes);

        if (targetParentId && newNodes[targetParentId]) {
          const parent = newNodes[targetParentId];
          const siblings = [...(parent.children_ids || [])];
          let targetIndex = siblings.indexOf(targetId);
          if (targetIndex === -1) {
            targetIndex = siblings.length;
          } else if (position === 'after') {
            targetIndex += 1;
          }
          siblings.splice(targetIndex, 0, ...directMovingIds);
          newNodes[targetParentId] = {
            ...parent,
            children_ids: siblings,
          };
        } else {
          // Root 階層に挿入
          let targetIndex = newRootIds.indexOf(targetId);
          if (targetIndex === -1) {
            targetIndex = newRootIds.length;
          } else if (position === 'after') {
            targetIndex += 1;
          }
          newRootIds.splice(targetIndex, 0, ...directMovingIds);
        }
      }

      const nextTarget = mapInsertionTarget(
        state.insertionTarget,
        state.rootNodeIds,
        state.nodes,
        newRootIds,
        newNodes
      );

      return {
        nodes: newNodes,
        rootNodeIds: newRootIds,
        insertionTarget: nextTarget,
        isDirty: true,
      };
    });

    if (get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(100);
    }
  },

  reorderNodes: (fromIndex: number, toIndex: number) => {
    get().pushHistorySnapshot();
    set((state) => {
      const newRootIds = [...state.rootNodeIds];
      const [moved] = newRootIds.splice(fromIndex, 1);
      newRootIds.splice(toIndex, 0, moved);
      return { rootNodeIds: newRootIds, isDirty: true };
    });
    if (get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(100);
    }
  },

  reorderMultipleNodes: (movingIds: string[], targetId: string, position: 'before' | 'after') => {
    get().moveNodesInTree(movingIds, targetId, position);
  },

  removeNodes: (ids: string[]) => {
    get().pushHistorySnapshot();
    set((state) => {
      const newNodes = { ...state.nodes };
      let newRootIds = [...state.rootNodeIds];

      const idsToRemove = new Set<string>();
      ids.forEach((id) => {
        idsToRemove.add(id);
        const descendants = collectDescendantIds(id, newNodes);
        descendants.forEach((dId) => idsToRemove.add(dId));
      });

      idsToRemove.forEach((id) => {
        delete newNodes[id];
        newRootIds = newRootIds.filter((rid) => rid !== id);
      });

      Object.keys(newNodes).forEach((nid) => {
        const node = newNodes[nid];
        if (node.children_ids && node.children_ids.some((cid) => idsToRemove.has(cid))) {
          newNodes[nid] = {
            ...node,
            children_ids: node.children_ids.filter((cid) => !idsToRemove.has(cid)),
          };
        }
      });

      const nextTarget = mapInsertionTarget(
        state.insertionTarget,
        state.rootNodeIds,
        state.nodes,
        newRootIds,
        newNodes
      );

      const nextSelected = state.selectedNodeIds.filter((id) => !idsToRemove.has(id));
      return {
        nodes: newNodes,
        rootNodeIds: newRootIds,
        insertionTarget: nextTarget,
        selectedNodeIds: nextSelected,
        selection: nextSelected.length > 0 ? { type: 'nodes', ids: nextSelected } : { type: 'none' },
        anchorNodeId: state.anchorNodeId && idsToRemove.has(state.anchorNodeId) ? null : state.anchorNodeId,
        isDirty: true,
      };
    });
    if (get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().recalculatePath({ immediate: true });
    }
  },

  selectNodes: (ids: string[], multi = false) => {
    const state = get();
    // グループが含まれる場合、その全子孫ノードIDを自動収集して展開（generatorは除外）
    const targetIds = expandSelectionWithDescendants(ids, state.nodes);

    const nextIds = multi ? (() => {
      const current = new Set(state.selectedNodeIds);
      const allSelected = targetIds.every((id) => current.has(id));
      if (allSelected) {
        targetIds.forEach((id) => current.delete(id));
      } else {
        targetIds.forEach((id) => current.add(id));
      }
      return Array.from(current);
    })() : targetIds;

    state.setSelection(nextIds.length > 0 ? { type: 'nodes', ids: nextIds } : { type: 'none' });
    if (nextIds.length > 0 && state.isAnnotationEditMode) {
      set({ isAnnotationEditMode: false });
    }
  },

  selectAllNodes: () => {
    get().setSelection({ type: 'nodes', ids: Object.keys(get().nodes) });
  },
  
  deselectAllNodes: () => {
    get().setSelection({ type: 'none' });
  },

  duplicateNodes: (ids: string[]) => {
    if (!ids || ids.length === 0) return [];
    get().pushHistorySnapshot();

    const createdTopLevelIds: string[] = [];

    set((state) => {
      const newNodes = { ...state.nodes };
      let newRootIds = [...state.rootNodeIds];
      const idsSet = new Set(ids);

      // 選択ノード群から子孫ノードを除外したトップレベルID群を特定（ツリー順序を維持）
      const flatNodeIds = getFlattenedNodeIds(state.rootNodeIds, state.nodes);
      const topLevelIds: string[] = [];

      flatNodeIds.forEach((id) => {
        if (idsSet.has(id)) {
          const isDescendant = topLevelIds.some((pId) => {
            const desc = collectDescendantIds(pId, state.nodes);
            return desc.includes(id);
          });
          if (!isDescendant) {
            topLevelIds.push(id);
          }
        }
      });

      ids.forEach((id) => {
        if (!topLevelIds.includes(id)) {
          const isDescendant = topLevelIds.some((pId) => {
            const desc = collectDescendantIds(pId, state.nodes);
            return desc.includes(id);
          });
          if (!isDescendant) {
            topLevelIds.push(id);
          }
        }
      });

      if (topLevelIds.length === 0) return state;

      // 再帰的にノードとその子孫をクローンするヘルパー
      const cloneNodeRecursive = (origId: string): WaypointNode | null => {
        const original = state.nodes[origId];
        if (!original) return null;

        const newId = uuidv4();
        const duplicated: WaypointNode = {
          ...structuredClone(original),
          id: newId,
          name: original.name ? `${original.name} (Copy)` : undefined,
        };

        if (duplicated.transform) {
          duplicated.transform = {
            ...duplicated.transform,
            x: duplicated.transform.x + 0.5,
            y: duplicated.transform.y + 0.5,
          };
        }

        if (original.children_ids && original.children_ids.length > 0) {
          const newChildIds: string[] = [];
          original.children_ids.forEach((cid) => {
            const childClone = cloneNodeRecursive(cid);
            if (childClone) {
              newChildIds.push(childClone.id);
            }
          });
          duplicated.children_ids = newChildIds;
        }

        newNodes[newId] = duplicated;
        return duplicated;
      };

      topLevelIds.forEach((id) => {
        const cloned = cloneNodeRecursive(id);
        if (cloned) {
          createdTopLevelIds.push(cloned.id);
        }
      });

      let nextInsertionTarget = state.insertionTarget;
      const validTarget = validateAndCorrectInsertionTarget(state.insertionTarget, newRootIds, newNodes);

      if (validTarget) {
        if (validTarget.parentId !== null && newNodes[validTarget.parentId]) {
          const parent = newNodes[validTarget.parentId];
          const siblings = [...(parent.children_ids || [])];
          siblings.splice(validTarget.index, 0, ...createdTopLevelIds);
          newNodes[validTarget.parentId] = {
            ...parent,
            children_ids: siblings,
          };
          nextInsertionTarget = {
            parentId: validTarget.parentId,
            index: validTarget.index + createdTopLevelIds.length,
          };
        } else {
          newRootIds.splice(validTarget.index, 0, ...createdTopLevelIds);
          nextInsertionTarget = {
            parentId: null,
            index: validTarget.index + createdTopLevelIds.length,
          };
        }
      } else {
        newRootIds.push(...createdTopLevelIds);
        nextInsertionTarget = null;
      }

      const nextSelected = expandSelectionWithDescendants(createdTopLevelIds, newNodes);
      return {
        nodes: newNodes,
        rootNodeIds: newRootIds,
        insertionTarget: validateAndCorrectInsertionTarget(nextInsertionTarget, newRootIds, newNodes),
        selectedNodeIds: nextSelected,
        selection: nextSelected.length > 0 ? { type: 'nodes', ids: nextSelected } : { type: 'none' },
        selectedAnnotationIds: [],
        activeCustomLayerId: null,
        selectedEditObjectId: null,
        isDirty: true,
      };
    });

    if (get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(150);
    }

    return createdTopLevelIds;
  },
});
