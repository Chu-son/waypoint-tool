import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import type { BasemapId, BasemapSource, GeoAlignment, GeoMapSettings, GeoOrigin } from '../../types/geo';
import { convertOrigin } from '../../utils/geo/geoTransform';
import { DEFAULT_GEO_MAP } from '../migrations/geoMapNormalization';

export type GeoMapSlice = {
  geoMap: GeoMapSettings;
  /** キャンバス上のドラッグ調整中の状態（開始時の位置合わせ）。ドラッグ中でなければ null。 */
  geoAlignDrag: { initial: GeoAlignment; snapshotPushed: boolean } | null;

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
  const patchGeoMap = (patch: Partial<GeoMapSettings>) =>
    set((state) => ({ geoMap: { ...state.geoMap, ...patch }, isDirty: true }));

  return {
    geoMap: DEFAULT_GEO_MAP,
    geoAlignDrag: null,

    setGeoMapEnabled: (enabled) => patchGeoMap({ enabled }),
    setGeoMapOpacity: (opacity) => patchGeoMap({ opacity: Math.max(0, Math.min(1, opacity)) }),
    setBasemap: (basemapId) => patchGeoMap({ basemapId }),
    updateCustomBasemap: (updates) =>
      set((state) => ({
        geoMap: { ...state.geoMap, customBasemap: { ...state.geoMap.customBasemap, ...updates } },
        isDirty: true,
      })),
    setGeoOrigin: (origin) => patchGeoMap({ origin }),
    setGeoOriginKind: (kind) => patchGeoMap({ origin: convertOrigin(get().geoMap.origin, kind) }),

    setGeoAlignment: (alignment) => {
      if (!isFiniteAlignment(alignment) || sameAlignment(alignment, get().geoMap.alignment)) return;
      get().pushHistorySnapshot();
      patchGeoMap({ alignment });
    },

    resetGeoAlignment: () => get().setGeoAlignment({ dx: 0, dy: 0, yawDeg: 0 }),

    beginGeoAlignDrag: () => {
      if (get().geoAlignDrag) return;
      const before = get().historyPast.length;
      get().pushHistorySnapshot();
      set((state) => ({
        geoAlignDrag: {
          initial: state.geoMap.alignment,
          snapshotPushed: state.historyPast.length > before,
        },
      }));
    },

    updateGeoAlignDrag: (alignment) => {
      if (!get().geoAlignDrag || !isFiniteAlignment(alignment)) return;
      patchGeoMap({ alignment });
    },

    endGeoAlignDrag: () => {
      const drag = get().geoAlignDrag;
      if (!drag) return;
      // 動いていなければ、開始時に積んだ履歴を取り除く
      const unchanged = sameAlignment(drag.initial, get().geoMap.alignment);
      set((state) => ({
        geoAlignDrag: null,
        historyPast: unchanged && drag.snapshotPushed ? state.historyPast.slice(0, -1) : state.historyPast,
      }));
    },

    cancelGeoAlignDrag: () => {
      const drag = get().geoAlignDrag;
      if (!drag) return;
      set((state) => ({
        geoAlignDrag: null,
        geoMap: { ...state.geoMap, alignment: drag.initial },
        historyPast: drag.snapshotPushed ? state.historyPast.slice(0, -1) : state.historyPast,
      }));
    },
  };
};
