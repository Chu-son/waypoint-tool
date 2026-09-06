import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { v4 as uuidv4 } from 'uuid';
import { LineAnnotation, AnnotationObject } from '../../types/store';

export interface MeasurePoint {
  x: number;
  y: number;
  objectId?: string;
  objectName?: string;
  objectType?: 'node' | 'annotation' | 'point';
}

export interface MeasureSlice {
  measureStartPoint: MeasurePoint | null;
  measureEndPoint: MeasurePoint | null;
  measureHoverPoint: { x: number; y: number } | null;
  autoSaveMeasureAnnotation: boolean;

  // Actions
  setMeasureStartPoint: (point: MeasurePoint | null) => void;
  setMeasureEndPoint: (point: MeasurePoint | null) => void;
  setMeasureHoverPoint: (point: { x: number; y: number } | null) => void;
  setAutoSaveMeasureAnnotation: (enabled: boolean) => void;
  resetMeasure: () => void;
  commitMeasurePoint: (point: MeasurePoint) => void;
  saveCurrentMeasureAsAnnotation: () => string | null;
  syncMeasureFromSelection: () => boolean;
}

export function computeDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.hypot(dx, dy);
}

export function getAnnotationCenter(annot: AnnotationObject): { x: number; y: number } {
  switch (annot.type) {
    case 'point':
    case 'oriented_point':
      return { x: annot.x, y: annot.y };
    case 'line':
      return { x: (annot.x1 + annot.x2) / 2, y: (annot.y1 + annot.y2) / 2 };
    case 'rect':
    case 'circle':
      return { x: annot.cx, y: annot.cy };
  }
}

export const createMeasureSlice: StateCreator<AppState, [], [], MeasureSlice> = (set, get) => ({
  measureStartPoint: null,
  measureEndPoint: null,
  measureHoverPoint: null,
  autoSaveMeasureAnnotation: false,

  setMeasureStartPoint: (point) => set({ measureStartPoint: point }),
  setMeasureEndPoint: (point) => set({ measureEndPoint: point }),
  setMeasureHoverPoint: (point) => set({ measureHoverPoint: point }),
  setAutoSaveMeasureAnnotation: (enabled) => set({ autoSaveMeasureAnnotation: enabled }),

  resetMeasure: () =>
    set({
      measureStartPoint: null,
      measureEndPoint: null,
      measureHoverPoint: null,
    }),

  commitMeasurePoint: (point: MeasurePoint) => {
    const { measureStartPoint, measureEndPoint, autoSaveMeasureAnnotation, saveCurrentMeasureAsAnnotation } = get();

    // 1点目がまだない、あるいは既に2点が決まっている場合は新規計測開始
    if (!measureStartPoint || measureEndPoint !== null) {
      set({
        measureStartPoint: point,
        measureEndPoint: null,
        measureHoverPoint: null,
      });
    } else {
      // 1点目とほぼ同一座標（二重発火等の極小距離）の場合は誤確定をガード
      const dist = computeDistance(measureStartPoint, point);
      if (dist < 0.02 && (!point.objectId || point.objectId === measureStartPoint.objectId)) {
        return;
      }

      // 2点目を確定
      set({
        measureEndPoint: point,
        measureHoverPoint: null,
      });

      if (autoSaveMeasureAnnotation) {
        saveCurrentMeasureAsAnnotation();
      }
    }
  },

  saveCurrentMeasureAsAnnotation: (): string | null => {
    const { measureStartPoint, measureEndPoint, annotationObjects, addAnnotationObject } = get();
    if (!measureStartPoint || !measureEndPoint) return null;

    // 連番形式で名前を生成（固定の距離文字列は含めず、動的バッジに任せる）
    const existingCount = Object.values(annotationObjects).filter(
      (a) => a.name && a.name.startsWith('計測')
    ).length;
    const name = `計測 ${existingCount + 1}`;

    const lineId = uuidv4();
    const lineAnnotation: LineAnnotation = {
      id: lineId,
      name,
      type: 'line',
      x1: measureStartPoint.x,
      y1: measureStartPoint.y,
      x2: measureEndPoint.x,
      y2: measureEndPoint.y,
      visible: true,
      labelVisible: true,
      showLength: true,
      color: '#10B981', // 識別しやすいエメラルドグリーン
    };

    addAnnotationObject(lineAnnotation);
    return lineId;
  },

  syncMeasureFromSelection: (): boolean => {
    const state = get();
    const selection = state.selection;

    // 1. ノードが2つ選択されている場合
    if (selection?.type === 'nodes' && selection.ids.length === 2) {
      const id1 = selection.ids[0];
      const id2 = selection.ids[1];
      const node1 = state.nodes[id1];
      const node2 = state.nodes[id2];

      if (node1?.transform && node2?.transform) {
        set({
          measureStartPoint: {
            x: node1.transform.x,
            y: node1.transform.y,
            objectId: id1,
            objectName: node1.name || id1,
            objectType: 'node',
          },
          measureEndPoint: {
            x: node2.transform.x,
            y: node2.transform.y,
            objectId: id2,
            objectName: node2.name || id2,
            objectType: 'node',
          },
          measureHoverPoint: null,
        });

        if (state.autoSaveMeasureAnnotation) {
          get().saveCurrentMeasureAsAnnotation();
        }
        return true;
      }
    }

    // 2. アノテーションが2つ選択されている場合
    if (selection?.type === 'annotations' && selection.ids.length === 2) {
      const id1 = selection.ids[0];
      const id2 = selection.ids[1];
      const annot1 = state.annotationObjects[id1];
      const annot2 = state.annotationObjects[id2];

      if (annot1 && annot2) {
        const c1 = getAnnotationCenter(annot1);
        const c2 = getAnnotationCenter(annot2);

        set({
          measureStartPoint: {
            x: c1.x,
            y: c1.y,
            objectId: id1,
            objectName: annot1.name || id1,
            objectType: 'annotation',
          },
          measureEndPoint: {
            x: c2.x,
            y: c2.y,
            objectId: id2,
            objectName: annot2.name || id2,
            objectType: 'annotation',
          },
          measureHoverPoint: null,
        });

        if (state.autoSaveMeasureAnnotation) {
          get().saveCurrentMeasureAsAnnotation();
        }
        return true;
      }
    }

    return false;
  },
});
