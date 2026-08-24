import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';
import { LineAnnotation, PointAnnotation, RectAnnotation } from '../../types/store';

describe('AnnotationSlice', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.annotationObjects = {};
    store.annotationOrder = [];
    store.selectedAnnotationIds = [];
    store.historyPast = [];
    store.historyFuture = [];
    store.isAnnotationEditMode = false;
    store.activeAnnotationSubTool = 'select';
  });

  it('adds and selects an annotation object', () => {
    const { addAnnotationObject } = useAppStore.getState();
    const point: PointAnnotation = {
      id: 'point-1',
      name: 'Start Point',
      type: 'point',
      x: 1.5,
      y: 2.5,
      visible: true,
      labelVisible: true,
      color: '#ff0000',
    };

    addAnnotationObject(point);

    const state = useAppStore.getState();
    expect(state.annotationObjects['point-1']).toEqual(point);
    expect(state.annotationOrder).toEqual(['point-1']);
    expect(state.selectedAnnotationIds).toEqual(['point-1']);
    expect(state.historyPast.length).toBe(1);
  });

  it('updates an annotation object and tracks undo/redo', () => {
    const { addAnnotationObject, updateAnnotationObject, undo, redo } = useAppStore.getState();
    const line: LineAnnotation = {
      id: 'line-1',
      name: 'Start Line',
      type: 'line',
      x1: 0,
      y1: 0,
      x2: 5,
      y2: 5,
      visible: true,
      labelVisible: true,
    };

    addAnnotationObject(line);
    updateAnnotationObject('line-1', { name: 'Finish Line', x2: 10 });

    let state = useAppStore.getState();
    expect((state.annotationObjects['line-1'] as LineAnnotation).name).toBe('Finish Line');
    expect((state.annotationObjects['line-1'] as LineAnnotation).x2).toBe(10);

    undo();
    state = useAppStore.getState();
    expect((state.annotationObjects['line-1'] as LineAnnotation).name).toBe('Start Line');
    expect((state.annotationObjects['line-1'] as LineAnnotation).x2).toBe(5);

    redo();
    state = useAppStore.getState();
    expect((state.annotationObjects['line-1'] as LineAnnotation).name).toBe('Finish Line');
    expect((state.annotationObjects['line-1'] as LineAnnotation).x2).toBe(10);
  });

  it('removes annotation objects and supports undo', () => {
    const { addAnnotationObject, removeAnnotationObjects, undo } = useAppStore.getState();
    const rect: RectAnnotation = {
      id: 'rect-1',
      name: 'No Go Zone',
      type: 'rect',
      cx: 2,
      cy: 2,
      width: 4,
      height: 4,
      angle: 0,
      visible: true,
      labelVisible: true,
    };

    addAnnotationObject(rect);
    expect(useAppStore.getState().annotationOrder).toEqual(['rect-1']);

    removeAnnotationObjects(['rect-1']);
    expect(useAppStore.getState().annotationObjects['rect-1']).toBeUndefined();
    expect(useAppStore.getState().annotationOrder).toEqual([]);

    undo();
    expect(useAppStore.getState().annotationObjects['rect-1']).toBeDefined();
    expect(useAppStore.getState().annotationOrder).toEqual(['rect-1']);
  });

  it('toggles visibility and label visibility', () => {
    const { addAnnotationObject, toggleAnnotationVisibility, toggleAnnotationLabelVisibility } = useAppStore.getState();
    const point: PointAnnotation = {
      id: 'point-1',
      name: 'Point 1',
      type: 'point',
      x: 0,
      y: 0,
      visible: true,
      labelVisible: true,
    };

    addAnnotationObject(point);
    toggleAnnotationVisibility('point-1');
    expect(useAppStore.getState().annotationObjects['point-1'].visible).toBe(false);

    toggleAnnotationLabelVisibility('point-1');
    expect(useAppStore.getState().annotationObjects['point-1'].labelVisible).toBe(false);
  });

  it('reorders annotation objects', () => {
    const { addAnnotationObject, reorderAnnotationObjects } = useAppStore.getState();
    addAnnotationObject({ id: 'p1', name: 'P1', type: 'point', x: 0, y: 0, visible: true, labelVisible: true });
    addAnnotationObject({ id: 'p2', name: 'P2', type: 'point', x: 1, y: 1, visible: true, labelVisible: true });
    addAnnotationObject({ id: 'p3', name: 'P3', type: 'point', x: 2, y: 2, visible: true, labelVisible: true });

    expect(useAppStore.getState().annotationOrder).toEqual(['p1', 'p2', 'p3']);

    reorderAnnotationObjects(0, 2);
    expect(useAppStore.getState().annotationOrder).toEqual(['p2', 'p3', 'p1']);
  });
});
