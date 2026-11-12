import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import type { BasemapId, BasemapSource, GeoAlignment, GeoMapSettings, GeoOrigin } from '../../types/geo';
import { convertOrigin } from '../../utils/geo/geoTransform';
import { changesAny } from '../../utils/shallowChanges';
import { DEFAULT_GEO_MAP } from '../migrations/geoMapNormalization';

export type GeoMapSlice = {
  geoMap: GeoMapSettings;

  setGeoMapEnabled: (enabled: boolean) => void;
  setGeoMapOpacity: (opacity: number) => void;
  setBasemap: (id: BasemapId) => void;
  updateCustomBasemap: (updates: Partial<BasemapSource>) => void;
  setGeoOrigin: (origin: GeoOrigin) => void;
  /** 原点の指定方式（緯度経度 / UTM）を、指す地点を変えずに切り替える。 */
  setGeoOriginKind: (kind: GeoOrigin['kind']) => void;

  /**
   * 位置合わせの変更。1 回の呼び出しが Undo 1 回になる。ドラッグや入力中の連続した変更は、呼び出し側の
   * トランザクション（`useHistoryGesture`・`historyEditHandlers`）で 1 回にまとめる。
   */
  setGeoAlignment: (alignment: GeoAlignment) => void;
  resetGeoAlignment: () => void;
};

const isFiniteAlignment = (a: GeoAlignment) =>
  Number.isFinite(a.dx) && Number.isFinite(a.dy) && Number.isFinite(a.yawDeg);

export const createGeoMapSlice: StateCreator<AppState, [], [], GeoMapSlice> = (set, get) => {
  // 変更はすべてここを通る。変化がなければ何もせず、あれば変更前を記録する（トランザクション内では 1 件にまとまる）。
  const patchGeoMap = (patch: Partial<GeoMapSettings>) => {
    if (!changesAny(get().geoMap, patch)) return;
    get().pushHistorySnapshot();
    set((state) => ({ geoMap: { ...state.geoMap, ...patch }, isDirty: true }));
  };

  return {
    geoMap: DEFAULT_GEO_MAP,

    setGeoMapEnabled: (enabled) => patchGeoMap({ enabled }),
    setGeoMapOpacity: (opacity) => patchGeoMap({ opacity: Math.max(0, Math.min(1, opacity)) }),
    setBasemap: (basemapId) => patchGeoMap({ basemapId }),
    updateCustomBasemap: (updates) => patchGeoMap({ customBasemap: { ...get().geoMap.customBasemap, ...updates } }),
    setGeoOrigin: (origin) => patchGeoMap({ origin }),
    setGeoOriginKind: (kind) => patchGeoMap({ origin: convertOrigin(get().geoMap.origin, kind) }),

    setGeoAlignment: (alignment) => {
      if (isFiniteAlignment(alignment)) patchGeoMap({ alignment });
    },

    resetGeoAlignment: () => get().setGeoAlignment({ dx: 0, dy: 0, yawDeg: 0 }),
  };
};
