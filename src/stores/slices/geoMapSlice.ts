import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import type { BasemapId, BasemapSource, GeoAlignment, GeoMapSettings, GeoOrigin } from '../../types/geo';
import { convertOrigin } from '../../utils/geo/geoTransform';
import { changesAny } from '../../utils/shallowChanges';
import { DEFAULT_GEO_MAP } from '../migrations/geoMapNormalization';

export type GeoMapSlice = {
  geoMap: GeoMapSettings;
  /** キャンバス上のドラッグ調整中の状態（開始時の位置合わせ）。ドラッグ中でなければ null。 */
  geoAlignDrag: { initial: GeoAlignment } | null;

  setGeoMapEnabled: (enabled: boolean) => void;
  setGeoMapOpacity: (opacity: number) => void;
  setBasemap: (id: BasemapId) => void;
  updateCustomBasemap: (updates: Partial<BasemapSource>) => void;
  setGeoOrigin: (origin: GeoOrigin) => void;
  /** 原点の指定方式（緯度経度 / UTM）を、指す地点を変えずに切り替える。 */
  setGeoOriginKind: (kind: GeoOrigin['kind']) => void;

  /** 数値入力などによる位置合わせの確定。1 回の Undo で元に戻せる。 */
  setGeoAlignment: (alignment: GeoAlignment) => void;
  resetGeoAlignment: () => void;

  beginGeoAlignDrag: () => void;
  updateGeoAlignDrag: (alignment: GeoAlignment) => void;
  endGeoAlignDrag: () => void;
  cancelGeoAlignDrag: () => void;
};

const isFiniteAlignment = (a: GeoAlignment) =>
  Number.isFinite(a.dx) && Number.isFinite(a.dy) && Number.isFinite(a.yawDeg);

const sameAlignment = (a: GeoAlignment, b: GeoAlignment) => a.dx === b.dx && a.dy === b.dy && a.yawDeg === b.yawDeg;

export const createGeoMapSlice: StateCreator<AppState, [], [], GeoMapSlice> = (set, get) => {
  // 変更はすべてここを通る。変化がなければ何もせず、あれば変更前を記録する（トランザクション内では 1 件にまとまる）。
  const patchGeoMap = (patch: Partial<GeoMapSettings>) => {
    if (!changesAny(get().geoMap, patch)) return;
    get().pushHistorySnapshot();
    set((state) => ({ geoMap: { ...state.geoMap, ...patch }, isDirty: true }));
  };

  return {
    geoMap: DEFAULT_GEO_MAP,
    geoAlignDrag: null,

    setGeoMapEnabled: (enabled) => patchGeoMap({ enabled }),
    setGeoMapOpacity: (opacity) => patchGeoMap({ opacity: Math.max(0, Math.min(1, opacity)) }),
    setBasemap: (basemapId) => patchGeoMap({ basemapId }),
    updateCustomBasemap: (updates) => {
      const { customBasemap } = get().geoMap;
      if (changesAny(customBasemap, updates)) patchGeoMap({ customBasemap: { ...customBasemap, ...updates } });
    },
    setGeoOrigin: (origin) => {
      if (changesAny(get().geoMap.origin, origin)) patchGeoMap({ origin });
    },
    setGeoOriginKind: (kind) => patchGeoMap({ origin: convertOrigin(get().geoMap.origin, kind) }),

    setGeoAlignment: (alignment) => {
      if (!isFiniteAlignment(alignment) || sameAlignment(alignment, get().geoMap.alignment)) return;
      patchGeoMap({ alignment });
    },

    resetGeoAlignment: () => get().setGeoAlignment({ dx: 0, dy: 0, yawDeg: 0 }),

    // ドラッグ全体を 1 つの履歴トランザクションにする。動かなければ履歴は残らず、中断すれば開始前に戻る。
    beginGeoAlignDrag: () => {
      if (get().geoAlignDrag) return;
      get().beginHistoryTransaction();
      set({ geoAlignDrag: { initial: get().geoMap.alignment } });
    },

    updateGeoAlignDrag: (alignment) => {
      if (!get().geoAlignDrag || !isFiniteAlignment(alignment)) return;
      if (sameAlignment(alignment, get().geoMap.alignment)) return;
      patchGeoMap({ alignment });
    },

    endGeoAlignDrag: () => {
      if (!get().geoAlignDrag) return;
      set({ geoAlignDrag: null });
      get().endHistoryTransaction();
    },

    cancelGeoAlignDrag: () => {
      if (!get().geoAlignDrag) return;
      set({ geoAlignDrag: null });
      get().cancelHistoryTransaction();
    },
  };
};
