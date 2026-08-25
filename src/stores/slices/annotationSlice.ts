import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { AnnotationObject, AnnotationGroup } from '../../types/store';

export type AnnotationToolType = 'select' | 'point' | 'oriented_point' | 'line' | 'rect' | 'circle';

export interface AnnotationSlice {
  annotationObjects: Record<string, AnnotationObject>;
  annotationGroups: Record<string, AnnotationGroup>;
  rootAnnotationIds: string[];
  annotationOrder: string[]; // For backward compatibility & flat ordering
  selectedAnnotationIds: string[];
  isAnnotationEditMode: boolean;
  activeAnnotationSubTool: AnnotationToolType;
  defaultAnnotationColor: string;
  showAnnotations: boolean;
  showAnnotationLabels: boolean;

  setAnnotationEditMode: (enabled: boolean) => void;
  setActiveAnnotationSubTool: (tool: AnnotationToolType) => void;
  setDefaultAnnotationColor: (color: string) => void;
  setShowAnnotations: (show: boolean) => void;
  setShowAnnotationLabels: (show: boolean) => void;

  addAnnotationObject: (obj: AnnotationObject, groupId?: string) => void;
  updateAnnotationObject: (id: string, updates: Partial<AnnotationObject>) => void;
  addAnnotationGroup: (group: AnnotationGroup) => void;
  updateAnnotationGroup: (id: string, updates: Partial<AnnotationGroup>) => void;
  removeAnnotationGroup: (id: string) => void;
  explodeAnnotationGroup: (groupId: string) => void;
  removeAnnotationObjects: (ids: string[]) => void;
  reorderAnnotationObjects: (fromIndex: number, toIndex: number) => void;
  reorderRootAnnotations: (fromIndex: number, toIndex: number) => void;
  reorderGroupChildren: (groupId: string, fromIndex: number, toIndex: number) => void;
  selectAnnotationObjects: (ids: string[], multi?: boolean) => void;
  clearAnnotationSelection: () => void;
  toggleAnnotationVisibility: (id: string) => void;
  toggleAnnotationGroupVisibility: (groupId: string) => void;
  toggleAnnotationLabelVisibility: (id: string) => void;
  setAnnotationObjects: (objects: AnnotationObject[], groups?: AnnotationGroup[], rootIds?: string[]) => void;
}

export const createAnnotationSlice: StateCreator<AppState, [], [], AnnotationSlice> = (set, get) => ({
  annotationObjects: {},
  annotationGroups: {},
  rootAnnotationIds: [],
  annotationOrder: [],
  selectedAnnotationIds: [],
  isAnnotationEditMode: false,
  activeAnnotationSubTool: 'select',
  defaultAnnotationColor: '#3B82F6',
  showAnnotations: true,
  showAnnotationLabels: true,

  setAnnotationEditMode: (enabled: boolean) => {
    set({
      isAnnotationEditMode: enabled,
      activeAnnotationSubTool: enabled ? (get().activeAnnotationSubTool === 'select' ? 'point' : get().activeAnnotationSubTool) : 'select',
    });
  },

  setActiveAnnotationSubTool: (tool: AnnotationToolType) => {
    set({ activeAnnotationSubTool: tool });
  },

  setDefaultAnnotationColor: (color: string) => {
    set({ defaultAnnotationColor: color });
  },

  setShowAnnotations: (show: boolean) => {
    set({ showAnnotations: show });
  },

  setShowAnnotationLabels: (show: boolean) => {
    set({ showAnnotationLabels: show });
  },

  addAnnotationObject: (obj: AnnotationObject, groupId?: string) => {
    get().pushHistorySnapshot();
    set((state) => {
      const newObjects = { ...state.annotationObjects, [obj.id]: { ...obj, group_id: groupId } };
      let newGroups = { ...state.annotationGroups };
      let newRootIds = [...state.rootAnnotationIds];

      if (groupId && newGroups[groupId]) {
        const group = newGroups[groupId];
        newGroups[groupId] = {
          ...group,
          children_ids: [...(group.children_ids || []), obj.id],
        };
      } else {
        newRootIds.push(obj.id);
      }

      return {
        annotationObjects: newObjects,
        annotationGroups: newGroups,
        rootAnnotationIds: newRootIds,
        annotationOrder: [...state.annotationOrder, obj.id],
        selectedAnnotationIds: [obj.id],
        isDirty: true,
      };
    });
  },

  updateAnnotationObject: (id: string, updates: Partial<AnnotationObject>) => {
    get().pushHistorySnapshot();
    set((state) => {
      const existing = state.annotationObjects[id];
      if (!existing) return state;
      return {
        annotationObjects: {
          ...state.annotationObjects,
          [id]: { ...existing, ...updates } as AnnotationObject,
        },
        isDirty: true,
      };
    });
  },

  addAnnotationGroup: (group: AnnotationGroup) => {
    get().pushHistorySnapshot();
    set((state) => ({
      annotationGroups: {
        ...state.annotationGroups,
        [group.id]: group,
      },
      rootAnnotationIds: [...state.rootAnnotationIds, group.id],
      selectedAnnotationIds: [group.id],
      isDirty: true,
    }));
  },

  updateAnnotationGroup: (id: string, updates: Partial<AnnotationGroup>) => {
    get().pushHistorySnapshot();
    set((state) => {
      const existing = state.annotationGroups[id];
      if (!existing) return state;
      return {
        annotationGroups: {
          ...state.annotationGroups,
          [id]: { ...existing, ...updates },
        },
        isDirty: true,
      };
    });
  },

  removeAnnotationGroup: (id: string) => {
    get().pushHistorySnapshot();
    set((state) => {
      const group = state.annotationGroups[id];
      if (!group) return state;

      const childrenSet = new Set(group.children_ids || []);
      const newObjects = { ...state.annotationObjects };
      childrenSet.forEach((childId) => {
        delete newObjects[childId];
      });

      const newGroups = { ...state.annotationGroups };
      delete newGroups[id];

      const newRootIds = state.rootAnnotationIds.filter((rid) => rid !== id);
      const newOrder = state.annotationOrder.filter((aid) => !childrenSet.has(aid));
      const newSelected = state.selectedAnnotationIds.filter((sid) => sid !== id && !childrenSet.has(sid));

      return {
        annotationObjects: newObjects,
        annotationGroups: newGroups,
        rootAnnotationIds: newRootIds,
        annotationOrder: newOrder,
        selectedAnnotationIds: newSelected,
        isDirty: true,
      };
    });
  },

  explodeAnnotationGroup: (groupId: string) => {
    get().pushHistorySnapshot();
    set((state) => {
      const group = state.annotationGroups[groupId];
      if (!group) return state;

      const childrenIds = group.children_ids || [];
      const newObjects = { ...state.annotationObjects };
      childrenIds.forEach((childId) => {
        if (newObjects[childId]) {
          newObjects[childId] = {
            ...newObjects[childId],
            group_id: undefined,
            source_execution_id: undefined,
          };
        }
      });

      const newGroups = { ...state.annotationGroups };
      delete newGroups[groupId];

      const groupIdx = state.rootAnnotationIds.indexOf(groupId);
      const newRootIds = [...state.rootAnnotationIds];
      if (groupIdx !== -1) {
        newRootIds.splice(groupIdx, 1, ...childrenIds);
      } else {
        newRootIds.push(...childrenIds);
      }

      return {
        annotationObjects: newObjects,
        annotationGroups: newGroups,
        rootAnnotationIds: newRootIds,
        selectedAnnotationIds: childrenIds.length > 0 ? [childrenIds[0]] : [],
        isDirty: true,
      };
    });
  },

  removeAnnotationObjects: (ids: string[]) => {
    if (ids.length === 0) return;
    get().pushHistorySnapshot();
    set((state) => {
      const idSet = new Set(ids);
      const groupsToRemove = new Set<string>();
      const objectsToRemove = new Set<string>();

      ids.forEach((id) => {
        if (state.annotationGroups[id]) {
          groupsToRemove.add(id);
          (state.annotationGroups[id].children_ids || []).forEach((cid) => objectsToRemove.add(cid));
        } else if (state.annotationObjects[id]) {
          objectsToRemove.add(id);
        }
      });

      const newObjects = { ...state.annotationObjects };
      objectsToRemove.forEach((id) => delete newObjects[id]);

      const newGroups = { ...state.annotationGroups };
      groupsToRemove.forEach((gid) => delete newGroups[gid]);

      // Remove child references from remaining groups
      Object.keys(newGroups).forEach((gid) => {
        const grp = newGroups[gid];
        if (grp.children_ids) {
          newGroups[gid] = {
            ...grp,
            children_ids: grp.children_ids.filter((cid) => !objectsToRemove.has(cid)),
          };
        }
      });

      const newRootIds = state.rootAnnotationIds.filter((id) => !groupsToRemove.has(id) && !objectsToRemove.has(id));
      const newOrder = state.annotationOrder.filter((id) => !objectsToRemove.has(id));
      const newSelected = state.selectedAnnotationIds.filter((id) => !idSet.has(id) && !objectsToRemove.has(id) && !groupsToRemove.has(id));

      return {
        annotationObjects: newObjects,
        annotationGroups: newGroups,
        rootAnnotationIds: newRootIds,
        annotationOrder: newOrder,
        selectedAnnotationIds: newSelected,
        isDirty: true,
      };
    });
  },

  reorderAnnotationObjects: (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    get().pushHistorySnapshot();
    set((state) => {
      const newOrder = [...state.annotationOrder];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      return {
        annotationOrder: newOrder,
        isDirty: true,
      };
    });
  },

  reorderRootAnnotations: (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    get().pushHistorySnapshot();
    set((state) => {
      const newRootIds = [...state.rootAnnotationIds];
      const [moved] = newRootIds.splice(fromIndex, 1);
      newRootIds.splice(toIndex, 0, moved);
      return {
        rootAnnotationIds: newRootIds,
        isDirty: true,
      };
    });
  },

  reorderGroupChildren: (groupId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    get().pushHistorySnapshot();
    set((state) => {
      const group = state.annotationGroups[groupId];
      if (!group || !group.children_ids) return state;

      const newChildren = [...group.children_ids];
      const [moved] = newChildren.splice(fromIndex, 1);
      newChildren.splice(toIndex, 0, moved);

      return {
        annotationGroups: {
          ...state.annotationGroups,
          [groupId]: {
            ...group,
            children_ids: newChildren,
          },
        },
        isDirty: true,
      };
    });
  },

  selectAnnotationObjects: (ids: string[], multi = false) => {
    set((state) => {
      if (multi) {
        const setIds = new Set(state.selectedAnnotationIds);
        ids.forEach((id) => {
          if (setIds.has(id)) {
            setIds.delete(id);
          } else {
            setIds.add(id);
          }
        });
        return {
          selectedAnnotationIds: Array.from(setIds),
          selectedNodeIds: [],
          activeCustomLayerId: null,
        };
      }
      return {
        selectedAnnotationIds: ids,
        selectedNodeIds: [],
        activeCustomLayerId: null,
      };
    });
  },

  clearAnnotationSelection: () => {
    set({ selectedAnnotationIds: [] });
  },

  toggleAnnotationVisibility: (id: string) => {
    get().pushHistorySnapshot();
    set((state) => {
      const existing = state.annotationObjects[id];
      if (!existing) return state;
      return {
        annotationObjects: {
          ...state.annotationObjects,
          [id]: { ...existing, visible: !existing.visible },
        },
        isDirty: true,
      };
    });
  },

  toggleAnnotationGroupVisibility: (groupId: string) => {
    get().pushHistorySnapshot();
    set((state) => {
      const group = state.annotationGroups[groupId];
      if (!group) return state;
      const nextVisible = !group.visible;
      const newObjects = { ...state.annotationObjects };
      (group.children_ids || []).forEach((cid) => {
        if (newObjects[cid]) {
          newObjects[cid] = { ...newObjects[cid], visible: nextVisible };
        }
      });
      return {
        annotationGroups: {
          ...state.annotationGroups,
          [groupId]: { ...group, visible: nextVisible },
        },
        annotationObjects: newObjects,
        isDirty: true,
      };
    });
  },

  toggleAnnotationLabelVisibility: (id: string) => {
    get().pushHistorySnapshot();
    set((state) => {
      const existing = state.annotationObjects[id];
      if (!existing) return state;
      return {
        annotationObjects: {
          ...state.annotationObjects,
          [id]: { ...existing, labelVisible: !existing.labelVisible },
        },
        isDirty: true,
      };
    });
  },

  setAnnotationObjects: (objects: AnnotationObject[], groups?: AnnotationGroup[], rootIds?: string[]) => {
    const objectMap: Record<string, AnnotationObject> = {};
    const order: string[] = [];
    objects.forEach((obj) => {
      objectMap[obj.id] = obj;
      order.push(obj.id);
    });

    const groupMap: Record<string, AnnotationGroup> = {};
    if (groups) {
      groups.forEach((grp) => {
        groupMap[grp.id] = grp;
      });
    }

    const finalRootIds = rootIds || (groups && groups.length > 0 ? [
      ...groups.map(g => g.id),
      ...objects.filter(o => !o.group_id).map(o => o.id)
    ] : order);

    set({
      annotationObjects: objectMap,
      annotationGroups: groupMap,
      rootAnnotationIds: finalRootIds,
      annotationOrder: order,
      selectedAnnotationIds: [],
    });
  },
});
