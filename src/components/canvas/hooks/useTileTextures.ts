import { useEffect, useReducer } from 'react';
import { Texture } from 'pixi.js';
import { BackendAPI } from '../../../api';
import { TileCache } from '../utils/tileCache';

function decodeTexture(dataUrl: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(Texture.from(img));
    img.onerror = () => reject(new Error('Failed to decode map tile'));
    img.src = dataUrl;
  });
}

/** アプリ全体で共有するタイルテクスチャのキャッシュ（バックエンドがディスクキャッシュを持つ）。 */
const tileTextures = new TileCache<Texture>({
  load: async (url) => decodeTexture(await BackendAPI.fetchMapTile(url)),
  dispose: (texture) => {
    if (!texture.destroyed) texture.destroy(true);
  },
});

/**
 * `urls` のタイルの取得を要求し、読み込み済みのテクスチャを同じ並びで返す（未取得は undefined）。
 * 読み込みが進むたびに再レンダリングされる。
 */
export function useTileTextures(urls: string[]): (Texture | undefined)[] {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => tileTextures.subscribe(rerender), []);

  const key = urls.join('\n');
  useEffect(() => {
    key.split('\n').forEach((url) => url && tileTextures.request(url));
  }, [key]);

  return urls.map((url) => tileTextures.peek(url));
}
