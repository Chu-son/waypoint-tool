import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { WaypointNode } from '../../types/store';
import { v4 as uuidv4 } from 'uuid';

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
    set((state) => ({
      nodes: {
        ...state.nodes,
        [id]: { ...state.nodes[id], ...updates }
      },
      isDirty: true
    }));
    if (!options?.skipRecalculate && get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(200);
    }
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
    if (!movingIds || movingIds.length === 0) return;
    get().pushHistorySnapshot();
    set((state) => {
      const movingSet = new Set(movingIds);
      const orderedMovingIds = state.rootNodeIds.filter((id) => movingSet.has(id));
      if (orderedMovingIds.length === 0) return state;

      const remainingIds = state.rootNodeIds.filter((id) => !movingSet.has(id));

      let targetIndex = remainingIds.indexOf(targetId);
      if (targetIndex === -1) {
        targetIndex = remainingIds.length;
      } else if (position === 'after') {
        targetIndex += 1;
      }

      remainingIds.splice(targetIndex, 0, ...orderedMovingIds);
      return { rootNodeIds: remainingIds, isDirty: true };
    });
    if (get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(100);
    }
  },

  removeNodes: (ids: string[]) => {
    get().pushHistorySnapshot();
    set((state) => {
    const newNodes = { ...state.nodes };
    let newRootIds = [...state.rootNodeIds];
    
    const idsToRemove = new Set<string>();
    const traverseIds = (id: string) => {
      if (!idsToRemove.has(id)) {
        idsToRemove.add(id);
        const node = newNodes[id];
        if (node?.children_ids) {
          node.children_ids.forEach(traverseIds);
        }
      }
    };
    ids.forEach(traverseIds);
    
    idsToRemove.forEach(id => {
      delete newNodes[id];
      newRootIds = newRootIds.filter(rid => rid !== id);
      
      Object.values(newNodes).forEach(node => {
        if (node.children_ids) {
          node.children_ids = node.children_ids.filter((cid: string) => cid !== id);
        }
      });
    });
    
    return { 
      nodes: newNodes, 
      rootNodeIds: newRootIds, 
      selectedNodeIds: state.selectedNodeIds.filter(id => !idsToRemove.has(id)),
      anchorNodeId: state.anchorNodeId && idsToRemove.has(state.anchorNodeId) ? null : state.anchorNodeId,
      isDirty: true
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

  explodeGenerator: (id: string) => {
    get().pushHistorySnapshot();
    set((state) => {
    const node = state.nodes[id];
    if (!node || node.type !== 'generator') return {};

    const childIds = node.children_ids || [];
    const newNodes = { ...state.nodes };
    delete newNodes[id];

    let newRootNodeIds = [...state.rootNodeIds];
    const rootIdx = newRootNodeIds.indexOf(id);

    if (rootIdx !== -1) {
      newRootNodeIds.splice(rootIdx, 1, ...childIds);
    } else {
      Object.values(newNodes).forEach(parent => {
        if (parent.children_ids && parent.children_ids.includes(id)) {
          const idx = parent.children_ids.indexOf(id);
          parent.children_ids = [
            ...parent.children_ids.slice(0, idx),
            ...childIds,
            ...parent.children_ids.slice(idx + 1)
          ];
        }
      });
    }

    return {
      nodes: newNodes,
      rootNodeIds: newRootNodeIds,
      selectedNodeIds: state.selectedNodeIds.filter(sid => sid !== id),
      isDirty: true
    };
    });
  },

  duplicateNodes: (ids: string[]) => {
    if (!ids || ids.length === 0) return [];
    get().pushHistorySnapshot();

    const createdTopLevelIds: string[] = [];

    set((state) => {
      const newNodes = { ...state.nodes };
      const newRootIds: string[] = [];
      const idsSet = new Set(ids);

      // Walk through rootNodeIds to maintain proper insertion order
      state.rootNodeIds.forEach((rid) => {
        newRootIds.push(rid);

        if (idsSet.has(rid)) {
          const original = state.nodes[rid];
          if (original) {
            if (original.type === 'manual') {
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
              newNodes[newId] = duplicated;
              newRootIds.push(newId);
              createdTopLevelIds.push(newId);
            } else if (original.type === 'generator') {
              const newGenId = uuidv4();
              const newChildIds: string[] = [];
              (original.children_ids || []).forEach((cid) => {
                const childOrig = state.nodes[cid];
                if (childOrig) {
                  const newChildId = uuidv4();
                  const dupChild: WaypointNode = {
                    ...structuredClone(childOrig),
                    id: newChildId,
                  };
                  if (dupChild.transform) {
                    dupChild.transform = {
                      ...dupChild.transform,
                      x: dupChild.transform.x + 0.5,
                      y: dupChild.transform.y + 0.5,
                    };
                  }
                  newNodes[newChildId] = dupChild;
                  newChildIds.push(newChildId);
                }
              });

              const duplicatedGen: WaypointNode = {
                ...structuredClone(original),
                id: newGenId,
                children_ids: newChildIds,
              };
              newNodes[newGenId] = duplicatedGen;
              newRootIds.push(newGenId);
              createdTopLevelIds.push(newGenId);
            }
          }
        }
      });

      // For any selected child manual nodes whose parent generator wasn't duplicated,
      // clone them as root-level manual waypoints
      ids.forEach((id) => {
        if (!state.rootNodeIds.includes(id) && !createdTopLevelIds.includes(id)) {
          const original = state.nodes[id];
          if (original && original.type === 'manual') {
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
            newNodes[newId] = duplicated;
            newRootIds.push(newId);
            createdTopLevelIds.push(newId);
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
