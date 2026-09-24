import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';
import { computeDistance, getAnnotationCenter } from './measureSlice';
import { WaypointNode, PointAnnotation, LineAnnotation } from '../../types/store';

describe('measureSlice', () => {
  beforeEach(() => {
    useAppStore.setState({
      measureStartPoint: null,
      measureEndPoint: null,
      measureHoverPoint: null,
      autoSaveMeasureAnnotation: false,
      nodes: {},
      selectedNodeIds: [],
      annotationObjects: {},
      selectedAnnotationIds: [],
      selection: { type: 'none' },
      decimalPrecision: 2,
    });
  });

  it('computes distance accurately', () => {
    expect(computeDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(computeDistance({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(0);
  });

  it('calculates annotation centers correctly', () => {
    const pt: PointAnnotation = {
      id: 'p1',
      name: 'pt',
      type: 'point',
      x: 10,
      y: 20,
      visible: true,
      labelVisible: true,
    };
    expect(getAnnotationCenter(pt)).toEqual({ x: 10, y: 20 });

    const line: LineAnnotation = {
      id: 'l1',
      name: 'line',
      type: 'line',
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 20,
      visible: true,
      labelVisible: true,
    };
    expect(getAnnotationCenter(line)).toEqual({ x: 5, y: 10 });
  });

  it('commits two points and resets on third point', () => {
    const store = useAppStore.getState();

    // 1st point
    store.commitMeasurePoint({ x: 1, y: 2 });
    expect(useAppStore.getState().measureStartPoint).toEqual({ x: 1, y: 2 });
    expect(useAppStore.getState().measureEndPoint).toBeNull();

    // 2nd point
    store.commitMeasurePoint({ x: 4, y: 6 });
    expect(useAppStore.getState().measureStartPoint).toEqual({ x: 1, y: 2 });
    expect(useAppStore.getState().measureEndPoint).toEqual({ x: 4, y: 6 });

    // 3rd point starts a new measurement
    store.commitMeasurePoint({ x: 10, y: 20 });
    expect(useAppStore.getState().measureStartPoint).toEqual({ x: 10, y: 20 });
    expect(useAppStore.getState().measureEndPoint).toBeNull();
  });

  it('saves current measure as line annotation with showLength=true', () => {
    const store = useAppStore.getState();
    store.commitMeasurePoint({ x: 0, y: 0 });
    store.commitMeasurePoint({ x: 3, y: 4 });

    const annotationId = store.saveCurrentMeasureAsAnnotation();
    expect(annotationId).toBeTruthy();

    const created = useAppStore.getState().annotationObjects[annotationId!];
    expect(created).toBeDefined();
    expect(created.type).toBe('line');
    const line = created as LineAnnotation;
    expect(line.x1).toBe(0);
    expect(line.y1).toBe(0);
    expect(line.x2).toBe(3);
    expect(line.y2).toBe(4);
    expect(line.showLength).toBe(true);
    expect(line.name).toBe('計測 1');
  });

  it('guards against accidental double-clicks at virtually the same coordinates', () => {
    const store = useAppStore.getState();
    store.commitMeasurePoint({ x: 5, y: 5 });
    expect(useAppStore.getState().measureStartPoint).toEqual({ x: 5, y: 5 });
    expect(useAppStore.getState().measureEndPoint).toBeNull();

    // Accidental second click at essentially the same point (< 0.02m)
    store.commitMeasurePoint({ x: 5.005, y: 5.005 });
    // Still not committed as end point
    expect(useAppStore.getState().measureEndPoint).toBeNull();

    // Valid distinct point
    store.commitMeasurePoint({ x: 6, y: 5 });
    expect(useAppStore.getState().measureEndPoint).toEqual({ x: 6, y: 5 });
  });

  it('auto-saves measure when autoSaveMeasureAnnotation is true', () => {
    useAppStore.getState().setAutoSaveMeasureAnnotation(true);

    useAppStore.getState().commitMeasurePoint({ x: 0, y: 0 });
    expect(Object.keys(useAppStore.getState().annotationObjects).length).toBe(0);

    useAppStore.getState().commitMeasurePoint({ x: 6, y: 8 });
    const annotations = Object.values(useAppStore.getState().annotationObjects);
    expect(annotations.length).toBe(1);
    expect(annotations[0].type).toBe('line');
    expect((annotations[0] as LineAnnotation).showLength).toBe(true);
  });

  it('syncs measure from two selected nodes', () => {
    const node1: WaypointNode = {
      id: 'n1',
      name: 'Node 1',
      type: 'manual',
      transform: { x: 2, y: 3, qx: 0, qy: 0, qz: 0, qw: 1 },
    };
    const node2: WaypointNode = {
      id: 'n2',
      name: 'Node 2',
      type: 'manual',
      transform: { x: 5, y: 7, qx: 0, qy: 0, qz: 0, qw: 1 },
    };

    useAppStore.setState({
      nodes: { n1: node1, n2: node2 },
      selectedNodeIds: ['n1', 'n2'],
      selection: { type: 'nodes', ids: ['n1', 'n2'] },
    });

    const synced = useAppStore.getState().syncMeasureFromSelection();
    expect(synced).toBe(true);
    expect(useAppStore.getState().measureStartPoint).toEqual({
      x: 2,
      y: 3,
      objectId: 'n1',
      objectName: 'Node 1',
      objectType: 'node',
    });
    expect(useAppStore.getState().measureEndPoint).toEqual({
      x: 5,
      y: 7,
      objectId: 'n2',
      objectName: 'Node 2',
      objectType: 'node',
    });
  });

  it('syncs measure from two selected annotations', () => {
    const pt1: PointAnnotation = {
      id: 'a1',
      name: 'Annot 1',
      type: 'point',
      x: 10,
      y: 10,
      visible: true,
      labelVisible: true,
    };
    const pt2: PointAnnotation = {
      id: 'a2',
      name: 'Annot 2',
      type: 'point',
      x: 20,
      y: 20,
      visible: true,
      labelVisible: true,
    };

    useAppStore.setState({
      annotationObjects: { a1: pt1, a2: pt2 },
      selectedAnnotationIds: ['a1', 'a2'],
      selection: { type: 'annotations', ids: ['a1', 'a2'] },
    });

    const synced = useAppStore.getState().syncMeasureFromSelection();
    expect(synced).toBe(true);
    expect(useAppStore.getState().measureStartPoint?.x).toBe(10);
    expect(useAppStore.getState().measureEndPoint?.x).toBe(20);
  });
});
