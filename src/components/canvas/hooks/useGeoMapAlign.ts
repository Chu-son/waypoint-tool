import { useCallback, useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';
import type { GeoAlignment } from '../../../types/geo';
import { rotateAlignmentAboutOrigin, translateAlignment } from '../../../utils/geo/alignDrag';

type Point = { x: number; y: number };

/**
 * キャンバス上のドラッグで背景地図の位置合わせ（平行移動 / 原点まわりの回転）を行う。
 * ドラッグ全体が 1 回の Undo になり、中断すると開始前の位置へ戻る（履歴の扱いはストアのアクションが担う）。
 */
export function useGeoMapAlign() {
  const drag = useRef<{ kind: 'translate' | 'rotate'; start: Point; initial: GeoAlignment } | null>(null);

  const start = useCallback((world: Point, rotate: boolean) => {
    const state = useAppStore.getState();
    state.beginGeoAlignDrag();
    drag.current = { kind: rotate ? 'rotate' : 'translate', start: world, initial: state.geoMap.alignment };
  }, []);

  const update = useCallback((world: Point) => {
    const current = drag.current;
    if (!current) return;
    const next =
      current.kind === 'rotate'
        ? rotateAlignmentAboutOrigin(current.initial, current.start, world)
        : translateAlignment(current.initial, current.start, world);
    useAppStore.getState().updateGeoAlignDrag(next);
  }, []);

  const end = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    useAppStore.getState().endGeoAlignDrag();
  }, []);

  /** 進行中のドラッグを中断して開始前に戻す。中断したものがあれば true。 */
  const abort = useCallback((): boolean => {
    if (!drag.current) return false;
    drag.current = null;
    useAppStore.getState().cancelGeoAlignDrag();
    return true;
  }, []);

  return { start, update, end, abort };
}
