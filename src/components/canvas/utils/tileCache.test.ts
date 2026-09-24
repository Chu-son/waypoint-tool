import { describe, expect, it, vi } from 'vitest';
import { TileCache } from './tileCache';

/** 呼び出しごとに手動で完了させられる非同期ローダー。 */
function controlledLoader() {
  const pending: { url: string; resolve: (v: string) => void; reject: (e: Error) => void }[] = [];
  const load = vi.fn(
    (url: string) =>
      new Promise<string>((resolve, reject) => {
        pending.push({ url, resolve, reject });
      }),
  );
  return { load, pending };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('TileCache', () => {
  it('makes a requested tile available once loading completes and notifies subscribers', async () => {
    const { load, pending } = controlledLoader();
    const cache = new TileCache<string>({ load });
    const onChange = vi.fn();
    cache.subscribe(onChange);

    cache.request('a');
    expect(cache.peek('a')).toBeUndefined();

    pending[0].resolve('tile-a');
    await flush();

    expect(cache.peek('a')).toBe('tile-a');
    expect(onChange).toHaveBeenCalled();
  });

  it('fetches a URL only once however often it is requested', async () => {
    const { load, pending } = controlledLoader();
    const cache = new TileCache<string>({ load });

    cache.request('a');
    cache.request('a');
    pending[0].resolve('x');
    await flush();
    cache.request('a');

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('never runs more downloads at once than the concurrency limit', async () => {
    const { load, pending } = controlledLoader();
    const cache = new TileCache<string>({ load, concurrency: 2 });

    ['a', 'b', 'c', 'd'].forEach((u) => cache.request(u));
    expect(load).toHaveBeenCalledTimes(2);

    pending[0].resolve('A');
    await flush();
    expect(load).toHaveBeenCalledTimes(3);

    pending[1].resolve('B');
    pending[2].resolve('C');
    await flush();
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('drops the least recently used tile when over capacity and disposes it', async () => {
    const dispose = vi.fn();
    const cache = new TileCache<string>({ load: async (u) => `tile-${u}`, capacity: 2, dispose });

    cache.request('a');
    await flush();
    cache.request('b');
    await flush();
    cache.peek('a'); // a is now more recent than b
    cache.request('c');
    await flush();

    expect(cache.peek('b')).toBeUndefined();
    expect(cache.peek('a')).toBe('tile-a');
    expect(cache.peek('c')).toBe('tile-c');
    expect(dispose).toHaveBeenCalledWith('tile-b');
  });

  it('does not retry a failed tile immediately, but does after the retry delay', async () => {
    let time = 0;
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('ok');
    const cache = new TileCache<string>({ load, retryAfterMs: 1000, now: () => time });

    cache.request('a');
    await flush();
    expect(cache.peek('a')).toBeUndefined();

    cache.request('a');
    await flush();
    expect(load).toHaveBeenCalledTimes(1);

    time = 1500;
    cache.request('a');
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.peek('a')).toBe('ok');
  });

  it('a failure does not block the other tiles in the queue', async () => {
    const load = vi.fn((url: string) => (url === 'bad' ? Promise.reject(new Error('x')) : Promise.resolve(url)));
    const cache = new TileCache<string>({ load, concurrency: 1 });

    cache.request('bad');
    cache.request('good');
    await flush();

    expect(cache.peek('good')).toBe('good');
  });

  it('clear disposes everything that was loaded', async () => {
    const dispose = vi.fn();
    const cache = new TileCache<string>({ load: async (u) => u, dispose });
    cache.request('a');
    cache.request('b');
    await flush();

    cache.clear();

    expect(dispose).toHaveBeenCalledTimes(2);
    expect(cache.peek('a')).toBeUndefined();
  });
});
