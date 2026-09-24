/** ワールド座標 (0,0) に対応する地理上の地点。緯度経度または UTM で指定する。 */
export type GeoOrigin =
  | { kind: 'latlon'; lat: number; lon: number }
  | { kind: 'utm'; zone: number; hemisphere: 'N' | 'S'; easting: number; northing: number };

/** ベースマップ全体に掛ける剛体変換（ワールド座標系での平行移動と反時計回りの回転）。 */
export interface GeoAlignment {
  dx: number;
  dy: number;
  yawDeg: number;
}

export type BasemapId = 'osm' | 'esri_imagery' | 'gsi_photo' | 'gsi_std' | 'custom';

/** `{z}` `{x}` `{y}` を含む XYZ タイルの URL テンプレートと付随情報。 */
export interface BasemapSource {
  urlTemplate: string;
  maxZoom: number;
  attribution: string;
}

export interface GeoMapSettings {
  enabled: boolean;
  basemapId: BasemapId;
  customBasemap: BasemapSource;
  opacity: number;
  origin: GeoOrigin;
  alignment: GeoAlignment;
}

/** タイルを Pixi の Sprite として置くための配置（ワールド座標）。 */
export interface TilePlacement {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}
