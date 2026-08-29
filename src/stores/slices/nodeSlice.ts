import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { WaypointNode } from '../../types/store';
import { v4 as uuidv4 } from 'uuid';
import {
  findHighestLevelParent,
  findNodeParentId,
  collectDescendantIds,
  getFlattenedNodeIds,
  getNextSequentialName,
} from '../../utils/treeUtils';

export type NodeSlice = {
  nodes: Record<string, WaypointNode>;
  rootNodeIds: string[];
  selectedNodeIds: string[];
  insertionIndex: number;
  
  anchorNodeId: string | null;
  setAnchorNode: (id: string | null) => void;
  addNode: (node: WaypointNode, parentId?: string, options?: { skipRecalculate?: boolean }) => void;
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
  setInsertionIndex: (index: number) => void;
};

export const createNodeSlice: StateCreator<AppState, [], [], NodeSlice> = (set, get) => ({
  nodes: {},
  rootNodeIds: [],
  selectedNodeIds: [],
  insertionIndex: -1,
  anchorNodeId: null,

  setAnchorNode: (id: string | null) => set({ anchorNodeId: id }),

  setInsertionIndex: (index: number) => set({ insertionIndex: index }),

  addNode: (node: WaypointNode, parentId?: string, options?: { skipRecalculate?: boolean }) => {
    get().pushHistorySnapshot();
    set((state) => {
      const newNodes = { ...state.nodes, [node.id]: node };
      let newRootIds = [...state.rootNodeIds];
      
      if (parentId && newNodes[parentId]) {
        const parent = newNodes[parentId];
        parent.children_ids = [...(parent.children_ids || []), node.id];
      } else {
        if (state.insertionIndex !== -1 && state.insertionIndex <= newRootIds.length) {
          newRootIds.splice(state.insertionIndex, 0, node.id);
        } else {
          newRootIds.push(node.id);
        }
      }
      
      return { 
        nodes: newNodes, 
        rootNodeIds: newRootIds, 
        insertionIndex: state.insertionIndex !== -1 ? state.insertionIndex + 1 : -1,
        isDirty: true 
      };
    });
    if (!options?.skipRecalculate && get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(150);
    }
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

      return {
        nodes: newNodes,
        rootNodeIds: newRootIds,
        selectedNodeIds: [newGroupId],
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

      return {
        nodes: newNodes,
        rootNodeIds: newRootIds,
        selectedNodeIds: childIds.length > 0 ? childIds : [],
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

      return {
        nodes: newNodes,
        rootNodeIds: newRootIds,
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

        Object.values(newNodes).forEach((node) => {
          if (node.children_ids) {
            node.children_ids = node.children_ids.filter((cid: string) => cid !== id);
          }
        });
      });

      return {
        nodes: newNodes,
        rootNodeIds: newRootIds,
        selectedNodeIds: state.selectedNodeIds.filter((id) => !idsToRemove.has(id)),
        anchorNodeId: state.anchorNodeId && idsToRemove.has(state.anchorNodeId) ? null : state.anchorNodeId,
        isDirty: true,
      };
    });
    if (get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().recalculatePath({ immediate: true });
    }
  },

  selectNodes: (ids: string[], multi = false) => set((state) => {
    const nextIds = multi ? (() => {
      const current = new Set(state.selectedNodeIds);
      ids.forEach(id => {
        if (current.has(id)) current.delete(id);
        else current.add(id);
      });
      return Array.from(current);
    })() : ids;

    const updates: Partial<AppState> = { selectedNodeIds: nextIds };
    if (nextIds.length > 0) {
      updates.rightPanelActiveTab = 'inspector';
      updates.activeCustomLayerId = null;
    }
    if (state.elementCopyState) {
      const targetId = nextIds.length === 1 ? nextIds[0] : null;
      updates.elementCopyState = { ...state.elementCopyState, previewNodeId: targetId };
    }
    return updates;
  }),

  selectAllNodes: () => set((state) => ({
    selectedNodeIds: Object.keys(state.nodes)
  })),
  
  deselectAllNodes: () => set({ selectedNodeIds: [] }),

  duplicateNodes: (ids: string[]) => {
    if (!ids || ids.length === 0) return [];
    get().pushHistorySnapshot();

    const createdTopLevelIds: string[] = [];

    set((state) => {
      const newNodes = { ...state.nodes };
      const newRootIds: string[] = [];
      const idsSet = new Set(ids);

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

      // Walk through rootNodeIds to maintain proper insertion order
      state.rootNodeIds.forEach((rid) => {
        newRootIds.push(rid);

        if (idsSet.has(rid)) {
          const cloned = cloneNodeRecursive(rid);
          if (cloned) {
            newRootIds.push(cloned.id);
            createdTopLevelIds.push(cloned.id);
          }
        }
      });

      // Root にない選択ノードの複製
      ids.forEach((id) => {
        if (!state.rootNodeIds.includes(id) && !createdTopLevelIds.includes(id)) {
          const cloned = cloneNodeRecursive(id);
          if (cloned) {
            newRootIds.push(cloned.id);
            createdTopLevelIds.push(cloned.id);
          }
        }
      });

      return {
        nodes: newNodes,
        rootNodeIds: newRootIds,
        selectedNodeIds: createdTopLevelIds,
        isDirty: true,
      };
    });

    if (get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(150);
    }

    return createdTopLevelIds;
  },
});
