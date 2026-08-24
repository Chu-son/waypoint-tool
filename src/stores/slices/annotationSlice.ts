import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { AnnotationObject } from '../../types/store';

export type AnnotationToolType = 'select' | 'point' | 'oriented_point' | 'line' | 'rect' | 'circle';

export interface AnnotationSlice {
  annotationObjects: Record<string, AnnotationObject>;
  annotationOrder: string[];
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

  addAnnotationObject: (obj: AnnotationObject) => void;
  updateAnnotationObject: (id: string, updates: Partial<AnnotationObject>) => void;
  removeAnnotationObjects: (ids: string[]) => void;
  reorderAnnotationObjects: (fromIndex: number, toIndex: number) => void;
  selectAnnotationObjects: (ids: string[], multi?: boolean) => void;
  clearAnnotationSelection: () => void;
  toggleAnnotationVisibility: (id: string) => void;
  toggleAnnotationLabelVisibility: (id: string) => void;
  setAnnotationObjects: (objects: AnnotationObject[]) => void;
}

export const createAnnotationSlice: StateCreator<AppState, [], [], AnnotationSlice> = (set, get) => ({
  annotationObjects: {},
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

  addAnnotationObject: (obj: AnnotationObject) => {
    get().pushHistorySnapshot();
    set((state) => ({
      annotationObjects: {
        ...state.annotationObjects,
        [obj.id]: obj,
      },
      annotationOrder: [...state.annotationOrder, obj.id],
      selectedAnnotationIds: [obj.id],
      isDirty: true,
    }));
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

  removeAnnotationObjects: (ids: string[]) => {
    if (ids.length === 0) return;
    get().pushHistorySnapshot();
    set((state) => {
      const idSet = new Set(ids);
      const newObjects = { ...state.annotationObjects };
      ids.forEach((id) => {
        delete newObjects[id];
      });
      const newOrder = state.annotationOrder.filter((id) => !idSet.has(id));
      const newSelected = state.selectedAnnotationIds.filter((id) => !idSet.has(id));
      return {
        annotationObjects: newObjects,
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
          selectedNodeIds: [], // Deselect waypoints when selecting annotations
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

  setAnnotationObjects: (objects: AnnotationObject[]) => {
    const objectMap: Record<string, AnnotationObject> = {};
    const order: string[] = [];
    objects.forEach((obj) => {
      objectMap[obj.id] = obj;
      order.push(obj.id);
    });
    set({
      annotationObjects: objectMap,
      annotationOrder: order,
      selectedAnnotationIds: [],
    });
  },
});
