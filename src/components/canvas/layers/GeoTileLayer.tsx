import { useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';
import type { GeoAlignment, GeoOrigin, TileCoord, TilePlacement } from '../../../types/geo';
import { buildTileUrl, isValidTileTemplate, resolveBasemap } from '../../../utils/geo/basemapPresets';
import { tilePlacement, visibleTiles } from '../../../utils/geo/geoTransform';
import { useTileTextures } from '../hooks/useTileTextures';
import { useWindowSize } from '../hooks/useWindowSize';
import { screenToWorld } from '../utils/viewport';

/** 1 画面で同時に扱うタイル枚数の上限。 */
const MAX_TILES = 256;

const tileKey = ({ z, x, y }: TileCoord) => `${z}/${x}/${y}`;

/** 親ズームのタイル（ズーム切替中、細かいタイルが届くまでの代用）。 */
const parentOf = ({ z, x, y }: TileCoord): TileCoord => ({ z: z - 1, x: x >> 1, y: y >> 1 });

/**
 * 背景地図（OSM / 衛星画像など）のタイル層。ワールドコンテナの一番奥に置く。
 * 原点・位置合わせ（オフセット/回転）を反映してタイルをワールド座標へ配置する。
 */
export function GeoTileLayer({ scale, position }: { scale: number; position: { x: number; y: number } }) {
  const geoMap = useAppStore((state) => state.geoMap);
  const { width, height } = useWindowSize();
  const placements = useRef({
    origin: null as GeoOrigin | null,
    alignment: null as GeoAlignment | null,
    byKey: new Map<string, TilePlacement>(),
  });

  const source = resolveBasemap(geoMap.basemapId, geoMap.customBasemap);
  const active = geoMap.enabled && isValidTileTemplate(source.urlTemplate) && scale > 0;

  let tiles: TileCoord[] = [];
  if (active) {
    const a = screenToWorld(0, 0, { scale, position });
    const b = screenToWorld(width, height, { scale, position });
    tiles = visibleTiles(
      { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) },
      scale,
      geoMap.origin,
      geoMap.alignment,
      source.maxZoom,
      MAX_TILES,
    );
  }

  const urls = tiles.map((t) => buildTileUrl(source.urlTemplate, t));
  const textures = useTileTextures(urls);

  // 未取得のタイルは、取得済みの親タイルで代用する（重複は 1 枚にまとめる）
  const parentUrls: string[] = [];
  const parents: TileCoord[] = [];
  const seen = new Set<string>();
  tiles.forEach((tile, i) => {
    if (textures[i] || tile.z === 0) return;
    const parent = parentOf(tile);
    if (seen.has(tileKey(parent))) return;
    seen.add(tileKey(parent));
    parents.push(parent);
    parentUrls.push(buildTileUrl(source.urlTemplate, parent));
  });
  const parentTextures = useTileTextures(parentUrls);

  if (!active) return null;

  const cache = placements.current;
  if (cache.origin !== geoMap.origin || cache.alignment !== geoMap.alignment) {
    cache.origin = geoMap.origin;
    cache.alignment = geoMap.alignment;
    cache.byKey.clear();
  }
  const placementOf = (tile: TileCoord) => {
    const key = tileKey(tile);
    let placement = cache.byKey.get(key);
    if (!placement) {
      placement = tilePlacement(tile, geoMap.origin, geoMap.alignment);
      cache.byKey.set(key, placement);
    }
    return placement;
  };

  const sprite = (key: string, tile: TileCoord, texture: NonNullable<(typeof textures)[number]>) => {
    const p = placementOf(tile);
    return (
      <pixiSprite
        key={key}
        texture={texture}
        x={p.x}
        y={p.y}
        rotation={p.rotation}
        scale={{ x: p.scaleX * (256 / texture.width), y: p.scaleY * (256 / texture.height) }}
      />
    );
  };

  return (
    <pixiContainer label="geo-tile-layer" alpha={geoMap.opacity}>
      {parents.map((tile, i) => {
        const texture = parentTextures[i];
        return texture && !texture.destroyed ? sprite(`p-${tileKey(tile)}`, tile, texture) : null;
      })}
      {tiles.map((tile, i) => {
        const texture = textures[i];
        return texture && !texture.destroyed ? sprite(tileKey(tile), tile, texture) : null;
      })}
    </pixiContainer>
  );
}
