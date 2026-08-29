import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';
import { PointAnnotation, AnnotationGroup } from '../../types/store';

describe('AnnotationSlice - groupAnnotations, ungroupAnnotation, nesting', () => {
  beforeEach(() => {
    useAppStore.setState({
      annotationObjects: {},
      annotationGroups: {},
      rootAnnotationIds: [],
      selectedAnnotationIds: [],
      historyPast: [],
      historyFuture: [],
    });
  });

  it('groups multiple annotations into a new AnnotationGroup', () => {
    const p1: PointAnnotation = { id: 'p1', type: 'point', name: 'Point 1', x: 0, y: 0, visible: true, labelVisible: true };
    const p2: PointAnnotation = { id: 'p2', type: 'point', name: 'Point 2', x: 1, y: 1, visible: true, labelVisible: true };

    useAppStore.setState({
      annotationObjects: { p1, p2 },
      rootAnnotationIds: ['p1', 'p2'],
      selectedAnnotationIds: ['p1', 'p2'],
    });

    const newGroupId = useAppStore.getState().groupAnnotations(['p1', 'p2']);
    expect(newGroupId).toBeTruthy();

    const state = useAppStore.getState();
    expect(state.rootAnnotationIds).toEqual([newGroupId!]);
    expect(state.selectedAnnotationIds).toEqual([newGroupId!]);

    const group = state.annotationGroups[newGroupId!];
    expect(group).toBeDefined();
    expect(group.name).toBe('Group 1');
    expect(group.children_ids).toEqual(['p1', 'p2']);
    expect(state.annotationObjects['p1'].group_id).toBe(newGroupId!);
    expect(state.annotationObjects['p2'].group_id).toBe(newGroupId!);
  });

  it('supports nesting groups within groups and ungroups properly', () => {
    const p1: PointAnnotation = { id: 'p1', type: 'point', name: 'Point 1', x: 0, y: 0, visible: true, labelVisible: true };
    const p2: PointAnnotation = { id: 'p2', type: 'point', name: 'Point 2', x: 1, y: 1, visible: true, labelVisible: true };
    const p3: PointAnnotation = { id: 'p3', type: 'point', name: 'Point 3', x: 2, y: 2, visible: true, labelVisible: true };

    const subGroup: AnnotationGroup = {
      id: 'sub-g',
      name: 'SubGroup',
      type: 'manual_group',
      visible: true,
      children_ids: ['p1', 'p2'],
    };

    useAppStore.setState({
      annotationObjects: { p1, p2, p3 },
      annotationGroups: { 'sub-g': subGroup },
      rootAnnotationIds: ['sub-g', 'p3'],
    });

    // Group subGroup and p3
    const topGroupId = useAppStore.getState().groupAnnotations(['sub-g', 'p3']);
    expect(topGroupId).toBeTruthy();

    let state = useAppStore.getState();
    expect(state.rootAnnotationIds).toEqual([topGroupId!]);
    const topGroup = state.annotationGroups[topGroupId!];
    expect(topGroup.children_ids).toEqual(['sub-g', 'p3']);
    expect(state.annotationGroups['sub-g'].parent_id).toBe(topGroupId!);

    // Ungroup topGroup
    useAppStore.getState().ungroupAnnotation(topGroupId!);
    state = useAppStore.getState();
    expect(state.rootAnnotationIds).toEqual(['sub-g', 'p3']);
    expect(state.annotationGroups[topGroupId!]).toBeUndefined();
    expect(state.annotationGroups['sub-g'].parent_id).toBeUndefined();
  });

  it('toggles group visibility recursively', () => {
    const p1: PointAnnotation = { id: 'p1', type: 'point', name: 'P1', x: 0, y: 0, visible: true, labelVisible: true };
    const p2: PointAnnotation = { id: 'p2', type: 'point', name: 'P2', x: 1, y: 1, visible: true, labelVisible: true };
    const subGroup: AnnotationGroup = {
      id: 'sub-g',
      name: 'SubGroup',
      type: 'manual_group',
      visible: true,
      children_ids: ['p2'],
    };
    const topGroup: AnnotationGroup = {
      id: 'top-g',
      name: 'TopGroup',
      type: 'manual_group',
      visible: true,
      children_ids: ['p1', 'sub-g'],
    };

    useAppStore.setState({
      annotationObjects: { p1, p2 },
      annotationGroups: { 'top-g': topGroup, 'sub-g': subGroup },
      rootAnnotationIds: ['top-g'],
    });

    useAppStore.getState().toggleAnnotationGroupVisibility('top-g');

    let state = useAppStore.getState();
    expect(state.annotationGroups['top-g'].visible).toBe(false);
    expect(state.annotationGroups['sub-g'].visible).toBe(false);
    expect(state.annotationObjects['p1'].visible).toBe(false);
    expect(state.annotationObjects['p2'].visible).toBe(false);

    useAppStore.getState().toggleAnnotationGroupVisibility('top-g');
    state = useAppStore.getState();
    expect(state.annotationGroups['top-g'].visible).toBe(true);
    expect(state.annotationGroups['sub-g'].visible).toBe(true);
    expect(state.annotationObjects['p1'].visible).toBe(true);
    expect(state.annotationObjects['p2'].visible).toBe(true);
  });

  describe('moveAnnotationsInTree', () => {
    it('moves an annotation into a group', () => {
      const p1: PointAnnotation = { id: 'p1', type: 'point', name: 'P1', x: 0, y: 0, visible: true, labelVisible: true };
      const p2: PointAnnotation = { id: 'p2', type: 'point', name: 'P2', x: 1, y: 1, visible: true, labelVisible: true };
      const grp: AnnotationGroup = { id: 'g1', type: 'manual_group', name: 'Group 1', children_ids: ['p2'], visible: true };

      useAppStore.setState({
        annotationObjects: { p1, p2 },
        annotationGroups: { g1: grp },
        rootAnnotationIds: ['p1', 'g1'],
      });

      useAppStore.getState().moveAnnotationsInTree(['p1'], 'p2', 'before');

      const state = useAppStore.getState();
      expect(state.rootAnnotationIds).toEqual(['g1']);
      expect(state.annotationGroups['g1'].children_ids).toEqual(['p1', 'p2']);
      expect(state.annotationObjects['p1'].group_id).toBe('g1');
    });

    it('moves an annotation from a group to root', () => {
      const p1: PointAnnotation = { id: 'p1', type: 'point', name: 'P1', x: 0, y: 0, visible: true, labelVisible: true, group_id: 'g1' };
      const p2: PointAnnotation = { id: 'p2', type: 'point', name: 'P2', x: 1, y: 1, visible: true, labelVisible: true, group_id: 'g1' };
      const grp: AnnotationGroup = { id: 'g1', type: 'manual_group', name: 'Group 1', children_ids: ['p1', 'p2'], visible: true };

      useAppStore.setState({
        annotationObjects: { p1, p2 },
        annotationGroups: { g1: grp },
        rootAnnotationIds: ['g1'],
      });

      useAppStore.getState().moveAnnotationsInTree(['p2'], 'g1', 'after');

      const state = useAppStore.getState();
      expect(state.rootAnnotationIds).toEqual(['g1', 'p2']);
      expect(state.annotationGroups['g1'].children_ids).toEqual(['p1']);
      expect(state.annotationObjects['p2'].group_id).toBeUndefined();
    });
  });

  describe('duplicateAnnotations', () => {
    it('duplicates single and multiple annotation objects with offset and Copy suffix', () => {
      const p1: PointAnnotation = { id: 'p1', type: 'point', name: 'P1', x: 10, y: 20, visible: true, labelVisible: true };

      useAppStore.setState({
        annotationObjects: { p1 },
        rootAnnotationIds: ['p1'],
      });

      const newIds = useAppStore.getState().duplicateAnnotations(['p1']);
      expect(newIds.length).toBe(1);

      const state = useAppStore.getState();
      expect(state.rootAnnotationIds).toEqual(['p1', newIds[0]]);
      expect(state.selectedAnnotationIds).toEqual(newIds);

      const dup = state.annotationObjects[newIds[0]] as PointAnnotation;
      expect(dup.name).toBe('P1 (Copy)');
      expect(dup.x).toBe(10.5);
      expect(dup.y).toBe(20.5);
    });

    it('duplicates a group recursively along with its children', () => {
      const p1: PointAnnotation = { id: 'p1', type: 'point', name: 'P1', x: 0, y: 0, visible: true, labelVisible: true, group_id: 'g1' };
      const grp: AnnotationGroup = { id: 'g1', type: 'manual_group', name: 'Group 1', children_ids: ['p1'], visible: true };

      useAppStore.setState({
        annotationObjects: { p1 },
        annotationGroups: { g1: grp },
        rootAnnotationIds: ['g1'],
      });

      const newIds = useAppStore.getState().duplicateAnnotations(['g1']);
      expect(newIds.length).toBe(1);
      const newGroupId = newIds[0];

      const state = useAppStore.getState();
      expect(state.rootAnnotationIds).toEqual(['g1', newGroupId]);
      const dupGroup = state.annotationGroups[newGroupId];
      expect(dupGroup.name).toBe('Group 1 (Copy)');
      expect(dupGroup.children_ids?.length).toBe(1);

      const dupChildId = dupGroup.children_ids![0];
      const dupChild = state.annotationObjects[dupChildId] as PointAnnotation;
      expect(dupChild).toBeDefined();
      expect(dupChild.name).toBe('P1 (Copy)');
      expect(dupChild.group_id).toBe(newGroupId);
    });
  });
});
