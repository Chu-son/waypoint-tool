import type { BasemapId, BasemapSource, TileCoord } from '../../types/geo';

export interface BasemapPreset extends BasemapSource {
  id: BasemapId;
  label: string;
}

export const BASEMAP_PRESETS: Record<Exclude<BasemapId, 'custom'>, BasemapPreset> = {
  osm: {
    id: 'osm',
    label: '地図 (OpenStreetMap)',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  },
  esri_imagery: {
    id: 'esri_imagery',
    label: '衛星画像 (Esri)',
    urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
  gsi_photo: {
    id: 'gsi_photo',
    label: '空中写真 (地理院)',
    urlTemplate: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
    maxZoom: 18,
    attribution: '出典: 国土地理院',
  },
  gsi_std: {
    id: 'gsi_std',
    label: '標準地図 (地理院)',
    urlTemplate: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    maxZoom: 18,
    attribution: '出典: 国土地理院',
  },
};

export const DEFAULT_CUSTOM_BASEMAP: BasemapSource = {
  urlTemplate: 'https://example.com/tiles/{z}/{x}/{y}.png',
  maxZoom: 18,
  attribution: '',
};

export const BASEMAP_CHOICES: { id: BasemapId; label: string }[] = [
  ...Object.values(BASEMAP_PRESETS).map(({ id, label }) => ({ id, label })),
  { id: 'custom', label: 'カスタム' },
];

export function resolveBasemap(id: BasemapId, custom: BasemapSource): BasemapSource {
  return id === 'custom' ? custom : BASEMAP_PRESETS[id];
}

/** `{z}` `{x}` `{y}` を名前で置換する（`{y}/{x}` の順で並ぶテンプレートも扱える）。 */
export function buildTileUrl(template: string, { z, x, y }: TileCoord): string {
  return template.replace(/\{z\}/g, String(z)).replace(/\{x\}/g, String(x)).replace(/\{y\}/g, String(y));
}

/** http/https でタイル座標のプレースホルダをすべて含むテンプレートだけを有効とする。 */
export function isValidTileTemplate(template: string): boolean {
  if (!/^https?:\/\//i.test(template)) return false;
  return ['{z}', '{x}', '{y}'].every((p) => template.includes(p));
}
