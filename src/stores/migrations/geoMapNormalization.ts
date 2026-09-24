import type { BasemapId, BasemapSource, GeoAlignment, GeoMapSettings, GeoOrigin } from '../../types/geo';
import { BASEMAP_CHOICES, DEFAULT_CUSTOM_BASEMAP } from '../../utils/geo/basemapPresets';
import { DEFAULT_GEO_ORIGIN, IDENTITY_ALIGNMENT } from '../../utils/geo/geoTransform';

export const DEFAULT_GEO_MAP_OPACITY = 0.6;

export const DEFAULT_GEO_MAP: GeoMapSettings = {
  enabled: false,
  basemapId: 'osm',
  customBasemap: DEFAULT_CUSTOM_BASEMAP,
  opacity: DEFAULT_GEO_MAP_OPACITY,
  origin: DEFAULT_GEO_ORIGIN,
  alignment: IDENTITY_ALIGNMENT,
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function normalizeOrigin(raw: unknown): GeoOrigin {
  if (!isRecord(raw)) return DEFAULT_GEO_ORIGIN;
  if (raw.kind === 'utm') {
    const zone = Math.round(finite(raw.zone, NaN));
    if (!(zone >= 1 && zone <= 60)) return DEFAULT_GEO_ORIGIN;
    return {
      kind: 'utm',
      zone,
      hemisphere: raw.hemisphere === 'S' ? 'S' : 'N',
      easting: finite(raw.easting, 500000),
      northing: finite(raw.northing, 0),
    };
  }
  if (raw.kind === 'latlon') {
    const lat = finite(raw.lat, NaN);
    const lon = finite(raw.lon, NaN);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || Number.isNaN(lat) || Number.isNaN(lon)) return DEFAULT_GEO_ORIGIN;
    return { kind: 'latlon', lat, lon };
  }
  return DEFAULT_GEO_ORIGIN;
}

function normalizeAlignment(raw: unknown): GeoAlignment {
  if (!isRecord(raw)) return IDENTITY_ALIGNMENT;
  return {
    dx: finite(raw.dx, 0),
    dy: finite(raw.dy, 0),
    yawDeg: finite(raw.yawDeg, 0),
  };
}

function normalizeCustomBasemap(raw: unknown): BasemapSource {
  if (!isRecord(raw)) return DEFAULT_CUSTOM_BASEMAP;
  return {
    urlTemplate: typeof raw.urlTemplate === 'string' ? raw.urlTemplate : DEFAULT_CUSTOM_BASEMAP.urlTemplate,
    maxZoom: Math.max(0, Math.min(24, Math.round(finite(raw.maxZoom, DEFAULT_CUSTOM_BASEMAP.maxZoom)))),
    attribution: typeof raw.attribution === 'string' ? raw.attribution : '',
  };
}

/** プロジェクトファイルの `geo_map` を検証し、欠けている項目をデフォルトで補う。 */
export function normalizeGeoMap(raw: unknown): GeoMapSettings {
  if (!isRecord(raw)) return DEFAULT_GEO_MAP;
  const basemapId = BASEMAP_CHOICES.some((c) => c.id === raw.basemapId)
    ? (raw.basemapId as BasemapId)
    : DEFAULT_GEO_MAP.basemapId;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_GEO_MAP.enabled,
    basemapId,
    customBasemap: normalizeCustomBasemap(raw.customBasemap),
    opacity: Math.max(0, Math.min(1, finite(raw.opacity, DEFAULT_GEO_MAP_OPACITY))),
    origin: normalizeOrigin(raw.origin),
    alignment: normalizeAlignment(raw.alignment),
  };
}
