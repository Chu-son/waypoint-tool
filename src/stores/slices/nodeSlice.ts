import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { WaypointNode } from '../../types/store';

export type NodeSlice = {
  nodes: Record<string, WaypointNode>;
  rootNodeIds: string[];
  selectedNodeIds: string[];
  insertionIndex: number;
  
  addNode: (node: WaypointNode, parentId?: string) => void;
  updateNode: (id: string, updates: Partial<WaypointNode>) => void;
  removeNodes: (ids: string[]) => void;
  reorderNodes: (fromIndex: number, toIndex: number) => void;
  selectNodes: (ids: string[], multi?: boolean) => void;
  selectAllNodes: () => void;
  deselectAllNodes: () => void;
  explodeGenerator: (id: string) => void;
  setInsertionIndex: (index: number) => void;
};

export const createNodeSlice: StateCreator<AppState, [], [], NodeSlice> = (set, get) => ({
  nodes: {},
  rootNodeIds: [],
  selectedNodeIds: [],
  insertionIndex: -1,

  setInsertionIndex: (index: number) => set({ insertionIndex: index }),

  addNode: (node: WaypointNode, parentId?: string) => set((state) => {
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
  }),

  updateNode: (id: string, updates: Partial<WaypointNode>) => set((state) => ({
    nodes: {
      ...state.nodes,
      [id]: { ...state.nodes[id], ...updates }
    },
    isDirty: true
  })),

  reorderNodes: (fromIndex: number, toIndex: number) => set((state) => {
    const newRootIds = [...state.rootNodeIds];
    const [moved] = newRootIds.splice(fromIndex, 1);
    newRootIds.splice(toIndex, 0, moved);
    return { rootNodeIds: newRootIds, isDirty: true };
  }),

  removeNodes: (ids: string[]) => set((state) => {
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
      isDirty: true
    };
  }),

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
    }
    return updates;
  }),

  selectAllNodes: () => set((state) => ({
    selectedNodeIds: Object.keys(state.nodes)
  })),
  
  deselectAllNodes: () => set({ selectedNodeIds: [] }),

  explodeGenerator: (id: string) => set((state) => {
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
  }),
});
