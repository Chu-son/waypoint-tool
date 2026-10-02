import { act, cleanup } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendAPI } from '../../../api';
import { renderWithStore } from '../../../test/render';
import { DEFAULT_GEO_MAP } from '../../../stores/migrations/geoMapNormalization';
import type { GeoMapSettings } from '../../../types/geo';
import { latLonToTileXY } from '../../../utils/geo/webMercator';
import { createViewportStore } from '../utils/viewportStore';
import { GeoTileLayer } from './GeoTileLayer';

vi.mock('@pixi/react', () => import('../../../test/mocks/pixi').then((m) => m.pixiReactMock));
vi.mock('pixi.js', () => import('../../../test/mocks/pixi').then((m) => m.pixiJsMock));

// タイルのキャッシュはモジュール全体で共有されるため、テストごとに別の場所を原点にして URL が重ならないようにする。
const geoMap = (overrides: Partial<GeoMapSettings>): GeoMapSettings => ({ ...DEFAULT_GEO_MAP, ...overrides });

const PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** jsdom は画像をデコードしないので、`src` を代入すると読み込み完了になる画像で置き換える。 */
class InstantImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

const settle = () => new Promise((r) => setTimeout(r, 20));

/** 描画して、要求されたタイル URL が出そろうまで待つ。`requested()` はその時点までに要求された URL。 */
async function mountLayer(settings: GeoMapSettings, scale = 1) {
  const fetchTile = vi.spyOn(BackendAPI, 'fetchMapTile').mockResolvedValue(PIXEL_PNG);
  const viewport = createViewportStore({ scale, position: { x: 0, y: 0 } });
  await act(async () => {
    renderWithStore(<GeoTileLayer viewport={viewport} />, { geoMap: settings });
    await settle();
  });
  return { viewport, requested: () => fetchTile.mock.calls.map(([url]) => url) };
}

const renderLayer = async (settings: GeoMapSettings, scale = 1) => (await mountLayer(settings, scale)).requested();

const parseTile = (url: string) => {
  const [, z, x, y] = /\/(\d+)\/(\d+)\/(\d+)\.(?:png|jpg)$/.exec(url) ?? [];
  return { z: Number(z), x: Number(x), y: Number(y) };
};

describe('GeoTileLayer', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', InstantImage);
  });

  it('requests no tiles while the background map is off', async () => {
    const urls = await renderLayer(geoMap({ enabled: false, origin: { kind: 'latlon', lat: 10, lon: 10 } }));
    expect(urls).toEqual([]);
  });

  it('requests OpenStreetMap tiles covering the world origin when on', async () => {
    const urls = await renderLayer(
      geoMap({ enabled: true, origin: { kind: 'latlon', lat: 35.681236, lon: 139.767125 } }),
    );

    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.startsWith('https://tile.openstreetmap.org/'))).toBe(true);

    const tiles = urls.map(parseTile).filter((t) => t.z === parseTile(urls[0]).z);
    const origin = latLonToTileXY(35.681236, 139.767125, tiles[0].z);
    expect(tiles).toContainEqual({ z: tiles[0].z, x: Math.floor(origin.x), y: Math.floor(origin.y) });
  });

  it('requests satellite imagery tiles when the satellite base map is selected', async () => {
    const urls = await renderLayer(
      geoMap({ enabled: true, basemapId: 'esri_imagery', origin: { kind: 'latlon', lat: 34.7, lon: 135.5 } }),
    );
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.startsWith('https://server.arcgisonline.com/'))).toBe(true);
  });

  it('follows the origin when it is given in UTM', async () => {
    const urls = await renderLayer(
      geoMap({
        enabled: true,
        origin: { kind: 'utm', zone: 54, hemisphere: 'N', easting: 388000, northing: 3950000 },
      }),
    );
    expect(urls.length).toBeGreaterThan(0);
  });

  it('uses finer tiles when zoomed in', async () => {
    const origin = { kind: 'latlon' as const, lat: 43.06, lon: 141.35 };
    const far = (await renderLayer(geoMap({ enabled: true, origin }), 0.5)).map(parseTile);
    cleanup(); // 前の描画を外し、その再描画による取得が次の計測に混ざらないようにする
    vi.restoreAllMocks();
    const near = (await renderLayer(geoMap({ enabled: true, origin: { ...origin, lat: 43.07 } }), 8)).map(parseTile);
    expect(near[0].z).toBeGreaterThan(far[0].z);
  });

  it('requests the tiles of the area a pan brings into view', async () => {
    const { viewport, requested } = await mountLayer(
      geoMap({ enabled: true, origin: { kind: 'latlon', lat: 37.39, lon: 140.39 } }),
      4,
    );
    const before = requested();
    const z = parseTile(before[0]).z;
    const eastmost = (urls: string[]) =>
      Math.max(
        ...urls
          .map(parseTile)
          .filter((t) => t.z === z)
          .map((t) => t.x),
      );

    // 地図を左へ 3000px ずらすと、東側が見えてくる
    await act(async () => {
      viewport.set({ scale: 4, position: { x: -3000, y: 0 } });
      await settle();
    });

    expect(eastmost(requested())).toBeGreaterThan(eastmost(before));
  });

  it('does not request anything from an unusable custom tile URL', async () => {
    const urls = await renderLayer(
      geoMap({
        enabled: true,
        basemapId: 'custom',
        customBasemap: { urlTemplate: 'file:///tiles/{z}/{x}/{y}.png', maxZoom: 18, attribution: '' },
        origin: { kind: 'latlon', lat: 26.2, lon: 127.7 },
      }),
    );
    expect(urls).toEqual([]);
  });

  it('never asks for more tiles than the safety limit, even when zoomed far out', async () => {
    const urls = await renderLayer(geoMap({ enabled: true, origin: { kind: 'latlon', lat: 51.5, lon: -0.12 } }), 0.01);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.length).toBeLessThanOrEqual(256);
  });
});
