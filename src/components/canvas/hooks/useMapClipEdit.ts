import { useCallback, useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';
import type { ClipRect } from '../../../types/layer';
import { rectFromCorners, resizeRect, type ClipHandle } from '../../../utils/mapClip';
import { useHistoryGesture } from './useHistoryGesture';

type Point = { x: number; y: number };

type Drag =
  | { kind: 'draw'; layerId: string; origin: Point; kept: ClipRect[] }
  | { kind: 'resize'; layerId: string; index: number; handle: ClipHandle; rects: ClipRect[] };

/**
 * キャンバス上のドラッグでマップレイヤーの使用領域（矩形の和集合）を編集する。
 * ドラッグ全体が 1 回の Undo になり、中断（Esc・Undo・アンマウント）すると開始前の領域へ戻る。
 */
export function useMapClipEdit() {
  const gesture = useHistoryGesture();
  const drag = useRef<Drag | null>(null);

  const begin = useCallback(
    (next: Drag) => {
      gesture.begin({ onAbort: () => (drag.current = null) });
      drag.current = next;
    },
    [gesture],
  );

  /** 空いた所からのドラッグで新しい領域を描く。`additive` なら既存の領域を残して追加する。 */
  const startDraw = useCallback(
    (layerId: string, world: Point, additive: boolean) => {
      const layer = useAppStore.getState().mapLayers.find((l) => l.id === layerId);
      if (!layer) return;
      begin({ kind: 'draw', layerId, origin: world, kept: additive ? (layer.clip?.rects ?? []) : [] });
    },
    [begin],
  );

  /** 既存の領域のハンドルをつかんで大きさを変える。 */
  const startResize = useCallback(
    (layerId: string, index: number, handle: ClipHandle) => {
      const rects = useAppStore.getState().mapLayers.find((l) => l.id === layerId)?.clip?.rects;
      if (rects?.[index]) begin({ kind: 'resize', layerId, index, handle, rects });
    },
    [begin],
  );

  const update = useCallback((world: Point) => {
    const current = drag.current;
    if (!current) return;
    const rects =
      current.kind === 'draw'
        ? [...current.kept, rectFromCorners(current.origin, world)]
        : current.rects.map((r, i) => (i === current.index ? resizeRect(r, current.handle, world) : r));
    useAppStore.getState().updateMapLayer(current.layerId, { clip: { rects } });
  }, []);

  const end = useCallback(() => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    // 大きさのない領域（クリックしただけ）は何も使わない領域になるので、ドラッグごと取り消す
    const clip = useAppStore.getState().mapLayers.find((l) => l.id === current.layerId)?.clip;
    if (clip?.rects.some((r) => r.width <= 0 || r.height <= 0)) gesture.cancel();
    else gesture.end();
  }, [gesture]);

  /** 進行中のドラッグを中断して開始前に戻す。中断したものがあれば true。 */
  const abort = useCallback(() => gesture.cancel(), [gesture]);

  return { startDraw, startResize, update, end, abort };
}
