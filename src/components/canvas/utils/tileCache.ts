/**
 * 背景地図タイルのメモリキャッシュ。
 *
 * - 同じ URL の取得は 1 回にまとめ、同時取得数を制限する（タイルサーバーへの負荷対策）。
 * - 容量を超えたら最近使われていないものから破棄する。
 * - 取得に失敗した URL は一定時間あとに再要求されたときだけ再試行する（描画のたびに再試行しない）。
 *
 * テクスチャの型には依存しない（`load` / `dispose` を差し込む）。
 */

export interface TileCacheOptions<T> {
  load: (url: string) => Promise<T>;
  dispose?: (value: T) => void;
  capacity?: number;
  concurrency?: number;
  retryAfterMs?: number;
  now?: () => number;
}

export class TileCache<T> {
  private readonly loaded = new Map<string, T>();
  private readonly loading = new Set<string>();
  private readonly failedAt = new Map<string, number>();
  private readonly queue: string[] = [];
  private readonly listeners = new Set<() => void>();
  private active = 0;

  private readonly load: (url: string) => Promise<T>;
  private readonly dispose?: (value: T) => void;
  private readonly capacity: number;
  private readonly concurrency: number;
  private readonly retryAfterMs: number;
  private readonly now: () => number;

  constructor(options: TileCacheOptions<T>) {
    this.load = options.load;
    this.dispose = options.dispose;
    this.capacity = options.capacity ?? 400;
    this.concurrency = options.concurrency ?? 4;
    this.retryAfterMs = options.retryAfterMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  /** 読み込み済みの値を返す。最近使ったものとして扱う。 */
  peek(url: string): T | undefined {
    const value = this.loaded.get(url);
    if (value !== undefined) {
      this.loaded.delete(url);
      this.loaded.set(url, value);
    }
    return value;
  }

  /** 未取得の URL を取得キューへ積む。 */
  request(url: string): void {
    if (this.loaded.has(url) || this.loading.has(url)) return;
    const failed = this.failedAt.get(url);
    if (failed !== undefined) {
      if (this.now() - failed < this.retryAfterMs) return;
      this.failedAt.delete(url);
    }
    this.loading.add(url);
    this.queue.push(url);
    this.pump();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    for (const value of this.loaded.values()) this.dispose?.(value);
    this.loaded.clear();
    this.failedAt.clear();
  }

  private pump(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const url = this.queue.shift()!;
      this.active++;
      this.load(url)
        .then((value) => {
          this.loaded.set(url, value);
          this.evict();
        })
        .catch(() => {
          this.failedAt.set(url, this.now());
        })
        .finally(() => {
          this.loading.delete(url);
          this.active--;
          this.listeners.forEach((l) => l());
          this.pump();
        });
    }
  }

  private evict(): void {
    while (this.loaded.size > this.capacity) {
      const oldest = this.loaded.keys().next().value as string;
      const value = this.loaded.get(oldest) as T;
      this.loaded.delete(oldest);
      this.dispose?.(value);
    }
  }
}
