import { useCallback, useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';
import type { GeoAlignment } from '../../../types/geo';
import { rotateAlignmentAboutOrigin, translateAlignment } from '../../../utils/geo/alignDrag';
import { useHistoryGesture } from './useHistoryGesture';

type Point = { x: number; y: number };

/**
 * キャンバス上のドラッグで背景地図の位置合わせ（平行移動 / 原点まわりの回転）を行う。
 * ドラッグ全体が 1 回の Undo になり、中断（Esc・Undo・アンマウント）すると開始前の位置へ戻る。
 */
export function useGeoMapAlign() {
  const gesture = useHistoryGesture();
  const drag = useRef<{ kind: 'translate' | 'rotate'; start: Point; initial: GeoAlignment } | null>(null);

  const start = useCallback(
    (world: Point, rotate: boolean) => {
      gesture.begin({ onAbort: () => (drag.current = null) });
      const initial = useAppStore.getState().geoMap.alignment;
      drag.current = { kind: rotate ? 'rotate' : 'translate', start: world, initial };
    },
    [gesture],
  );

  const update = useCallback((world: Point) => {
    const current = drag.current;
    if (!current) return;
    const next =
      current.kind === 'rotate'
        ? rotateAlignmentAboutOrigin(current.initial, current.start, world)
        : translateAlignment(current.initial, current.start, world);
    useAppStore.getState().setGeoAlignment(next);
  }, []);

  const end = useCallback(() => {
    drag.current = null;
    gesture.end();
  }, [gesture]);

  /** 進行中のドラッグを中断して開始前に戻す。中断したものがあれば true。 */
  const abort = useCallback(() => gesture.cancel(), [gesture]);

  return { start, update, end, abort };
}
