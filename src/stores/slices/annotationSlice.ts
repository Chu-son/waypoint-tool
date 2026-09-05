import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { AnnotationObject, AnnotationGroup } from '../../types/store';
import { v4 as uuidv4 } from 'uuid';
import {
  findHighestLevelParent,
  collectDescendantIds,
  getNextSequentialName,
} from '../../utils/treeUtils';
import { DEFAULT_ANNOTATION_COLOR } from '../../utils/colorPresets';

export type AnnotationToolType = 'select' | 'point' | 'oriented_point' | 'line' | 'rect' | 'circle';

export interface AnnotationSlice {
  annotationObjects: Record<string, AnnotationObject>;
  annotationGroups: Record<string, AnnotationGroup>;
  rootAnnotationIds: string[];
  annotationOrder: string[]; // For backward compatibility & flat ordering
  selectedAnnotationIds: string[];
  isAnnotationEditMode: boolean;
  activeAnnotationSubTool: AnnotationToolType;
  allowedAnnotationSubTools: AnnotationToolType[] | null;
  activeAnnotationGroupId: string | null;
  defaultAnnotationColor: string;
  showAnnotations: boolean;
  showAnnotationLabels: boolean;

  setAnnotationEditMode: (enabled: boolean) => void;
  setActiveAnnotationSubTool: (tool: AnnotationToolType) => void;
  setAllowedAnnotationSubTools: (tools: AnnotationToolType[] | null) => void;
  setActiveAnnotationGroupId: (groupId: string | null) => void;
  setDefaultAnnotationColor: (color: string) => void;
  setShowAnnotations: (show: boolean) => void;
  setShowAnnotationLabels: (show: boolean) => void;

  addAnnotationObject: (obj: AnnotationObject, groupId?: string) => void;
  updateAnnotationObject: (id: string, updates: Partial<AnnotationObject>) => void;
  addAnnotationGroup: (group: AnnotationGroup) => void;
  updateAnnotationGroup: (id: string, updates: Partial<AnnotationGroup>) => void;
  renameAnnotation: (id: string, name: string) => void;
  groupAnnotations: (selectedIds: string[]) => string | null;
  ungroupAnnotation: (groupId: string) => void;
  moveAnnotationsInTree: (movingIds: string[], targetId: string, position: 'before' | 'after' | 'inside') => void;
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
  duplicateAnnotations: (ids: string[]) => string[];
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
  allowedAnnotationSubTools: null,
  activeAnnotationGroupId: null,
  defaultAnnotationColor: DEFAULT_ANNOTATION_COLOR,
  showAnnotations: true,
  showAnnotationLabels: true,

  setAnnotationEditMode: (enabled: boolean) => {
    const state = get();
    const subTool = enabled ? (state.activeAnnotationSubTool === 'select' ? 'point' : state.activeAnnotationSubTool) : 'select';
    set({
      isAnnotationEditMode: enabled,
      activeAnnotationSubTool: subTool,
    });
    if (enabled) {
      state.transitionToMode?.({
        mode: 'annotation_edit',
        subTool,
        targetGroupId: state.activeAnnotationGroupId,
      });
    } else {
      if (state.appMode?.mode === 'annotation_edit') {
        state.transitionToMode?.({ mode: 'select' });
      }
    }
  },

  setActiveAnnotationSubTool: (tool: AnnotationToolType) => {
    set({ activeAnnotationSubTool: tool });
    const state = get();
    if (state.appMode?.mode === 'annotation_edit') {
      state.updateAppMode?.({ subTool: tool });
    }
  },

  setAllowedAnnotationSubTools: (tools: AnnotationToolType[] | null) => {
    set({ allowedAnnotationSubTools: tools });
  },

  setActiveAnnotationGroupId: (groupId: string | null) => {
    set({ activeAnnotationGroupId: groupId });
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
      const targetGroupId = groupId !== undefined ? groupId : (state.activeAnnotationGroupId || undefined);
      const newObjects = { ...state.annotationObjects, [obj.id]: { ...obj, group_id: targetGroupId } };
      let newGroups = { ...state.annotationGroups };
      let newRootIds = [...state.rootAnnotationIds];

      if (targetGroupId && newGroups[targetGroupId]) {
        const group = newGroups[targetGroupId];
        newGroups[targetGroupId] = {
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
        selection: { type: 'annotations', ids: [obj.id] },
        selectedNodeIds: [],
        activeCustomLayerId: null,
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
      selection: { type: 'annotations', ids: [group.id] },
      selectedNodeIds: [],
      activeCustomLayerId: null,
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

  renameAnnotation: (id: string, name: string) => {
    const state = get();
    if (state.annotationGroups[id]) {
      get().updateAnnotationGroup(id, { name });
    } else if (state.annotationObjects[id]) {
      get().updateAnnotationObject(id, { name });
    }
  },

  groupAnnotations: (selectedIds: string[]): string | null => {
    if (!selectedIds || selectedIds.length === 0) return null;
    get().pushHistorySnapshot();

    const newGroupId = uuidv4();

    set((state) => {
      // 1. 親探索用の辞書を構築
      const groupMap = state.annotationGroups;
      const { parentId: targetParentId, insertIndex } = findHighestLevelParent(
        selectedIds,
        state.rootAnnotationIds,
        groupMap
      );

      // 2. 連番でグループ名を生成 ("Group 1", "Group 2", ...)
      const existingNames = Object.values(state.annotationGroups).map((g) => g.name);
      const groupName = getNextSequentialName('Group', existingNames);

      // 3. 親が選択されている場合の子孫重複排除
      const directMovingIds: string[] = [];

      selectedIds.forEach((id) => {
        const isDescendantOfSelected = selectedIds.some((pId) => {
          if (pId === id) return false;
          const descendants = collectDescendantIds(pId, groupMap);
          return descendants.includes(id);
        });
        if (!isDescendantOfSelected && !directMovingIds.includes(id)) {
          directMovingIds.push(id);
        }
      });

      if (directMovingIds.length === 0) return state;

      const newObjects = { ...state.annotationObjects };
      const newGroups = { ...state.annotationGroups };
      let newRootIds = [...state.rootAnnotationIds];
      const movingSet = new Set(directMovingIds);

      // 4. 移動ノードを元の親 / Root から削除し、親参照を更新
      newRootIds = newRootIds.filter((id) => !movingSet.has(id));
      Object.keys(newGroups).forEach((gid) => {
        const grp = newGroups[gid];
        if (grp.children_ids) {
          newGroups[gid] = {
            ...grp,
            children_ids: grp.children_ids.filter((cid) => !movingSet.has(cid)),
          };
        }
      });

      directMovingIds.forEach((id) => {
        if (newObjects[id]) {
          newObjects[id] = { ...newObjects[id], group_id: newGroupId };
        }
        if (newGroups[id]) {
          newGroups[id] = { ...newGroups[id], parent_id: newGroupId };
        }
      });

      // 5. 新規グループを作成
      const newGroup: AnnotationGroup = {
        id: newGroupId,
        name: groupName,
        type: 'manual_group',
        visible: true,
        children_ids: directMovingIds,
        parent_id: targetParentId || undefined,
      };
      newGroups[newGroupId] = newGroup;

      // 6. 新規グループを親階層に配置
      if (targetParentId && newGroups[targetParentId]) {
        const parentGrp = newGroups[targetParentId];
        const currentChildren = [...(parentGrp.children_ids || [])];
        const safeIdx = Math.min(insertIndex, currentChildren.length);
        currentChildren.splice(safeIdx, 0, newGroupId);
        newGroups[targetParentId] = {
          ...parentGrp,
          children_ids: currentChildren,
        };
      } else {
        const safeIdx = Math.min(insertIndex, newRootIds.length);
        newRootIds.splice(safeIdx, 0, newGroupId);
      }

      return {
        annotationObjects: newObjects,
        annotationGroups: newGroups,
        rootAnnotationIds: newRootIds,
        selectedAnnotationIds: [newGroupId],
        selection: { type: 'annotations', ids: [newGroupId] },
        selectedNodeIds: [],
        activeCustomLayerId: null,
        isDirty: true,
      };
    });

    return newGroupId;
  },

  ungroupAnnotation: (groupId: string) => {
    get().pushHistorySnapshot();
    set((state) => {
      const group = state.annotationGroups[groupId];
      if (!group) return state;

      const childrenIds = group.children_ids || [];
      const newObjects = { ...state.annotationObjects };
      const newGroups = { ...state.annotationGroups };
      delete newGroups[groupId];

      const parentId = group.parent_id;

      // 子要素の親参照を解除または更新
      childrenIds.forEach((childId) => {
        if (newObjects[childId]) {
          newObjects[childId] = {
            ...newObjects[childId],
            group_id: parentId,
            source_execution_id: undefined,
          };
        }
        if (newGroups[childId]) {
          newGroups[childId] = {
            ...newGroups[childId],
            parent_id: parentId,
            source_execution_id: undefined,
          };
        }
      });

      let newRootIds = [...state.rootAnnotationIds];
      const groupRootIdx = newRootIds.indexOf(groupId);

      if (groupRootIdx !== -1) {
        newRootIds.splice(groupRootIdx, 1, ...childrenIds);
      } else if (parentId && newGroups[parentId]) {
        const parent = newGroups[parentId];
        const idx = (parent.children_ids || []).indexOf(groupId);
        const nextChildren = [...(parent.children_ids || [])];
        if (idx !== -1) {
          nextChildren.splice(idx, 1, ...childrenIds);
        } else {
          nextChildren.push(...childrenIds);
        }
        newGroups[parentId] = {
          ...parent,
          children_ids: nextChildren,
        };
      } else {
        // フォールバック: 親グループを探索
        Object.keys(newGroups).forEach((gid) => {
          const parent = newGroups[gid];
          if (parent.children_ids && parent.children_ids.includes(groupId)) {
            const idx = parent.children_ids.indexOf(groupId);
            const nextChildren = [...parent.children_ids];
            nextChildren.splice(idx, 1, ...childrenIds);
            newGroups[gid] = {
              ...parent,
              children_ids: nextChildren,
            };
          }
        });
      }

      return {
        annotationObjects: newObjects,
        annotationGroups: newGroups,
        rootAnnotationIds: newRootIds,
        selectedAnnotationIds: childrenIds.length > 0 ? childrenIds : [],
        selection: childrenIds.length > 0 ? { type: 'annotations', ids: childrenIds } : { type: 'none' },
        selectedNodeIds: [],
        activeCustomLayerId: null,
        isDirty: true,
      };
    });
  },

  moveAnnotationsInTree: (movingIds: string[], targetId: string, position: 'before' | 'after' | 'inside') => {
    if (!movingIds || movingIds.length === 0 || !targetId) return;
    if (movingIds.includes(targetId) && position !== 'inside') return;

    get().pushHistorySnapshot();

    set((state) => {
      // 1. 循環参照チェック
      for (const movingId of movingIds) {
        if (state.annotationGroups[movingId]) {
          const descendants = collectDescendantIds(movingId, state.annotationGroups);
          if (descendants.includes(targetId) || movingId === targetId) {
            return state;
          }
        }
      }

      const directMovingIds: string[] = [];

      // 親が選択されている場合の子孫重複排除
      movingIds.forEach((id) => {
        const isDescendant = movingIds.some((pId) => {
          if (pId === id || !state.annotationGroups[pId]) return false;
          const desc = collectDescendantIds(pId, state.annotationGroups);
          return desc.includes(id);
        });
        if (!isDescendant && !directMovingIds.includes(id)) {
          directMovingIds.push(id);
        }
      });

      if (directMovingIds.length === 0) return state;

      const directMovingSet = new Set(directMovingIds);
      const newObjects = { ...state.annotationObjects };
      const newGroups = { ...state.annotationGroups };
      let newRootIds = [...state.rootAnnotationIds];

      // 2. 元の親から削除
      newRootIds = newRootIds.filter((id) => !directMovingSet.has(id));
      Object.keys(newGroups).forEach((gid) => {
        const grp = newGroups[gid];
        if (grp.children_ids) {
          newGroups[gid] = {
            ...grp,
            children_ids: grp.children_ids.filter((cid) => !directMovingSet.has(cid)),
          };
        }
      });

      // 3. ドロップ位置に挿入＆親参照を更新
      if (position === 'inside') {
        const targetGroup = newGroups[targetId];
        if (targetGroup) {
          newGroups[targetId] = {
            ...targetGroup,
            children_ids: [...(targetGroup.children_ids || []), ...directMovingIds],
          };
          directMovingIds.forEach((id) => {
            if (newObjects[id]) newObjects[id] = { ...newObjects[id], group_id: targetId };
            if (newGroups[id]) newGroups[id] = { ...newGroups[id], parent_id: targetId };
          });
        }
      } else {
        // targetId の親グループを特定
        let targetParentId: string | undefined = undefined;
        if (newObjects[targetId]?.group_id) {
          targetParentId = newObjects[targetId].group_id;
        } else if (newGroups[targetId]?.parent_id) {
          targetParentId = newGroups[targetId].parent_id;
        } else {
          // children_ids から逆引き
          Object.keys(newGroups).forEach((gid) => {
            if (newGroups[gid].children_ids?.includes(targetId)) {
              targetParentId = gid;
            }
          });
        }

        if (targetParentId && newGroups[targetParentId]) {
          const parent = newGroups[targetParentId];
          const siblings = [...(parent.children_ids || [])];
          let targetIndex = siblings.indexOf(targetId);
          if (targetIndex === -1) {
            targetIndex = siblings.length;
          } else if (position === 'after') {
            targetIndex += 1;
          }
          siblings.splice(targetIndex, 0, ...directMovingIds);
          newGroups[targetParentId] = {
            ...parent,
            children_ids: siblings,
          };
          directMovingIds.forEach((id) => {
            if (newObjects[id]) newObjects[id] = { ...newObjects[id], group_id: targetParentId };
            if (newGroups[id]) newGroups[id] = { ...newGroups[id], parent_id: targetParentId };
          });
        } else {
          // Root 階層に挿入
          let targetIndex = newRootIds.indexOf(targetId);
          if (targetIndex === -1) {
            targetIndex = newRootIds.length;
          } else if (position === 'after') {
            targetIndex += 1;
          }
          newRootIds.splice(targetIndex, 0, ...directMovingIds);
          directMovingIds.forEach((id) => {
            if (newObjects[id]) newObjects[id] = { ...newObjects[id], group_id: undefined };
            if (newGroups[id]) newGroups[id] = { ...newGroups[id], parent_id: undefined };
          });
        }
      }

      return {
        annotationObjects: newObjects,
        annotationGroups: newGroups,
        rootAnnotationIds: newRootIds,
        isDirty: true,
      };
    });
  },

  explodeAnnotationGroup: (groupId: string) => {
    get().ungroupAnnotation(groupId);
  },

  removeAnnotationGroup: (id: string) => {
    get().removeAnnotationObjects([id]);
  },

  removeAnnotationObjects: (ids: string[]) => {
    if (ids.length === 0) return;
    get().pushHistorySnapshot();
    set((state) => {
      const groupsToRemove = new Set<string>();
      const objectsToRemove = new Set<string>();

      const collectRecursively = (id: string) => {
        if (state.annotationGroups[id]) {
          groupsToRemove.add(id);
          const descendants = collectDescendantIds(id, state.annotationGroups);
          descendants.forEach((dId) => {
            if (state.annotationGroups[dId]) groupsToRemove.add(dId);
            if (state.annotationObjects[dId]) objectsToRemove.add(dId);
          });
          (state.annotationGroups[id].children_ids || []).forEach((cid) => {
            if (state.annotationObjects[cid]) objectsToRemove.add(cid);
            if (state.annotationGroups[cid]) collectRecursively(cid);
          });
        } else if (state.annotationObjects[id]) {
          objectsToRemove.add(id);
        }
      };

      ids.forEach(collectRecursively);

      const newObjects = { ...state.annotationObjects };
      objectsToRemove.forEach((id) => delete newObjects[id]);

      const newGroups = { ...state.annotationGroups };
      groupsToRemove.forEach((gid) => delete newGroups[gid]);

      // 残ったグループの children_ids から削除要素を除去
      Object.keys(newGroups).forEach((gid) => {
        const grp = newGroups[gid];
        if (grp.children_ids) {
          newGroups[gid] = {
            ...grp,
            children_ids: grp.children_ids.filter(
              (cid) => !objectsToRemove.has(cid) && !groupsToRemove.has(cid)
            ),
          };
        }
      });

      const newRootIds = state.rootAnnotationIds.filter(
        (id) => !groupsToRemove.has(id) && !objectsToRemove.has(id)
      );
      const newOrder = state.annotationOrder.filter((id) => !objectsToRemove.has(id));
      const newSelected = state.selectedAnnotationIds.filter(
        (id) => !objectsToRemove.has(id) && !groupsToRemove.has(id)
      );

      return {
        annotationObjects: newObjects,
        annotationGroups: newGroups,
        rootAnnotationIds: newRootIds,
        annotationOrder: newOrder,
        selectedAnnotationIds: newSelected,
        selection: newSelected.length > 0 ? { type: 'annotations', ids: newSelected } : { type: 'none' },
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
    const state = get();
    const nextIds = multi ? (() => {
      const setIds = new Set(state.selectedAnnotationIds);
      ids.forEach((id) => {
        if (setIds.has(id)) {
          setIds.delete(id);
        } else {
          setIds.add(id);
        }
      });
      return Array.from(setIds);
    })() : ids;

    state.setSelection(nextIds.length > 0 ? { type: 'annotations', ids: nextIds } : { type: 'none' });
  },

  clearAnnotationSelection: () => {
    get().setSelection({ type: 'none' });
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
      const newGroups = { ...state.annotationGroups };

      const setVisibilityRecursive = (gid: string, vis: boolean) => {
        if (newGroups[gid]) {
          newGroups[gid] = { ...newGroups[gid], visible: vis };
          (newGroups[gid].children_ids || []).forEach((cid) => {
            if (newObjects[cid]) {
              newObjects[cid] = { ...newObjects[cid], visible: vis };
            }
            if (newGroups[cid]) {
              setVisibilityRecursive(cid, vis);
            }
          });
        }
      };

      setVisibilityRecursive(groupId, nextVisible);

      return {
        annotationGroups: newGroups,
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

  duplicateAnnotations: (ids: string[]) => {
    if (!ids || ids.length === 0) return [];
    get().pushHistorySnapshot();

    const createdTopLevelIds: string[] = [];

    set((state) => {
      const nextObjects = { ...state.annotationObjects };
      const nextGroups = { ...state.annotationGroups };
      const nextRootIds = [...state.rootAnnotationIds];

      // オブジェクトのディープコピー＆オフセット
      const cloneObject = (origId: string, parentGroupId?: string): AnnotationObject | null => {
        const orig = state.annotationObjects[origId];
        if (!orig) return null;

        const newId = uuidv4();
        const dup: AnnotationObject = {
          ...structuredClone(orig),
          id: newId,
          name: `${orig.name} (Copy)`,
          group_id: parentGroupId,
        };

        if (dup.type === 'point' || dup.type === 'oriented_point') {
          dup.x += 0.5;
          dup.y += 0.5;
        } else if (dup.type === 'line') {
          dup.x1 += 0.5;
          dup.y1 += 0.5;
          dup.x2 += 0.5;
          dup.y2 += 0.5;
        } else if (dup.type === 'rect' || dup.type === 'circle') {
          dup.cx += 0.5;
          dup.cy += 0.5;
        }

        nextObjects[newId] = dup;
        return dup;
      };

      // グループの再帰的クローン
      const cloneGroupRecursive = (origId: string, parentGroupId?: string): AnnotationGroup | null => {
        const orig = state.annotationGroups[origId];
        if (!orig) return null;

        const newId = uuidv4();
        const newChildIds: string[] = [];

        if (orig.children_ids) {
          orig.children_ids.forEach((cid) => {
            if (state.annotationObjects[cid]) {
              const clonedObj = cloneObject(cid, newId);
              if (clonedObj) newChildIds.push(clonedObj.id);
            } else if (state.annotationGroups[cid]) {
              const clonedSub = cloneGroupRecursive(cid, newId);
              if (clonedSub) newChildIds.push(clonedSub.id);
            }
          });
        }

        const dupGroup: AnnotationGroup = {
          ...structuredClone(orig),
          id: newId,
          name: `${orig.name} (Copy)`,
          parent_id: parentGroupId,
          children_ids: newChildIds,
        };

        nextGroups[newId] = dupGroup;
        return dupGroup;
      };

      // 親が選択されている場合の子孫要素は直接複製しない（二重複製防止）
      const directIds: string[] = [];
      ids.forEach((id) => {
        let isChildOfSelected = false;
        let curr = id;
        while (curr) {
          const parentId = nextObjects[curr]?.group_id || nextGroups[curr]?.parent_id;
          if (parentId && ids.includes(parentId)) {
            isChildOfSelected = true;
            break;
          }
          curr = parentId || '';
        }
        if (!isChildOfSelected) {
          directIds.push(id);
        }
      });

      // 複製と適切な位置への挿入
      directIds.forEach((id) => {
        if (state.annotationObjects[id]) {
          const orig = state.annotationObjects[id];
          const cloned = cloneObject(id, orig.group_id);
          if (cloned) {
            createdTopLevelIds.push(cloned.id);
            if (orig.group_id && nextGroups[orig.group_id]) {
              const grp = nextGroups[orig.group_id];
              const children = [...(grp.children_ids || [])];
              const idx = children.indexOf(id);
              children.splice(idx !== -1 ? idx + 1 : children.length, 0, cloned.id);
              nextGroups[orig.group_id] = { ...grp, children_ids: children };
            } else {
              const idx = nextRootIds.indexOf(id);
              nextRootIds.splice(idx !== -1 ? idx + 1 : nextRootIds.length, 0, cloned.id);
            }
          }
        } else if (state.annotationGroups[id]) {
          const orig = state.annotationGroups[id];
          const cloned = cloneGroupRecursive(id, orig.parent_id);
          if (cloned) {
            createdTopLevelIds.push(cloned.id);
            if (orig.parent_id && nextGroups[orig.parent_id]) {
              const grp = nextGroups[orig.parent_id];
              const children = [...(grp.children_ids || [])];
              const idx = children.indexOf(id);
              children.splice(idx !== -1 ? idx + 1 : children.length, 0, cloned.id);
              nextGroups[orig.parent_id] = { ...grp, children_ids: children };
            } else {
              const idx = nextRootIds.indexOf(id);
              nextRootIds.splice(idx !== -1 ? idx + 1 : nextRootIds.length, 0, cloned.id);
            }
          }
        }
      });

      return {
        annotationObjects: nextObjects,
        annotationGroups: nextGroups,
        rootAnnotationIds: nextRootIds,
        selectedAnnotationIds: createdTopLevelIds,
        selection: createdTopLevelIds.length > 0 ? { type: 'annotations', ids: createdTopLevelIds } : { type: 'none' },
        selectedNodeIds: [],
        activeCustomLayerId: null,
        isDirty: true,
      };
    });

    return createdTopLevelIds;
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
      ...groups.filter(g => !g.parent_id).map(g => g.id),
      ...objects.filter(o => !o.group_id).map(o => o.id)
    ] : order);

    set({
      annotationObjects: objectMap,
      annotationGroups: groupMap,
      rootAnnotationIds: finalRootIds,
      annotationOrder: order,
      selectedAnnotationIds: [],
      selection: { type: 'none' },
    });
  },
});
