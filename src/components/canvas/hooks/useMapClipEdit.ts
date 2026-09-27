import { useCallback, useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';
import type { ClipRect } from '../../../types/layer';
import { rectFromCorners, resizeRect, type ClipHandle } from '../../../utils/mapClip';

type Point = { x: number; y: number };

type Drag =
  | { kind: 'draw'; layerId: string; origin: Point; kept: ClipRect[] }
  | { kind: 'resize'; layerId: string; index: number; handle: ClipHandle; rects: ClipRect[] };

/**
 * キャンバス上のドラッグでマップレイヤーの使用領域（矩形の和集合）を編集する。
 * ドラッグ全体が 1 回の Undo になり、中断すると開始前の領域へ戻る（履歴の扱いはストアのアクションが担う）。
 */
export function useMapClipEdit() {
  const drag = useRef<Drag | null>(null);

  /** 空いた所からのドラッグで新しい領域を描く。`additive` なら既存の領域を残して追加する。 */
  const startDraw = useCallback((layerId: string, world: Point, additive: boolean) => {
    const state = useAppStore.getState();
    const current = state.mapLayers.find((l) => l.id === layerId)?.clip?.rects ?? [];
    state.beginMapClipDrag(layerId);
    drag.current = { kind: 'draw', layerId, origin: world, kept: additive ? current : [] };
  }, []);

  /** 既存の領域のハンドルをつかんで大きさを変える。 */
  const startResize = useCallback((layerId: string, index: number, handle: ClipHandle) => {
    const state = useAppStore.getState();
    const rects = state.mapLayers.find((l) => l.id === layerId)?.clip?.rects;
    if (!rects?.[index]) return;
    state.beginMapClipDrag(layerId);
    drag.current = { kind: 'resize', layerId, index, handle, rects };
  }, []);

  const update = useCallback((world: Point) => {
    const current = drag.current;
    if (!current) return;
    const store = useAppStore.getState();
    if (current.kind === 'draw') {
      store.updateMapClipDrag({ rects: [...current.kept, rectFromCorners(current.origin, world)] });
    } else {
      store.updateMapClipDrag({
        rects: current.rects.map((r, i) => (i === current.index ? resizeRect(r, current.handle, world) : r)),
      });
    }
  }, []);

  const end = useCallback(() => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    const store = useAppStore.getState();
    // 大きさのない領域（クリックしただけ）は何も使わない領域になるので、ドラッグごと取り消す
    const clip = store.mapLayers.find((l) => l.id === current.layerId)?.clip;
    const degenerate = clip?.rects.some((r) => r.width <= 0 || r.height <= 0) ?? false;
    if (degenerate && store.mapClipDrag) {
      store.cancelMapClipDrag();
      return;
    }
    store.endMapClipDrag();
  }, []);

  /** 進行中のドラッグを中断して開始前に戻す。中断したものがあれば true。 */
  const abort = useCallback((): boolean => {
    if (!drag.current) return false;
    drag.current = null;
    useAppStore.getState().cancelMapClipDrag();
    return true;
  }, []);

  return { startDraw, startResize, update, end, abort };
}
