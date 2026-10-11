/**
 * 開発中に、処理の各段の所要時間を測って `console.table` に出す。ビルド（本番）では何もしない。
 * 使い方: `const trace = createTrace('Blend Preview'); … trace.mark('prepare'); … trace.end()`。
 * 段の時間は、直前の `mark`（なければ `createTrace`）からの経過ミリ秒。
 */
export interface Trace {
  /** 直前の印からここまでを `stage` として記録する。`detail` は表に添える補足（サイズなど）。 */
  mark(stage: string, detail?: string): void;
  /** 次の 2 フレームが描かれるまで待ってから `mark` する（GPU へのアップロードは描画時に起きる）。 */
  markAfterPaint(stage: string, detail?: string): Promise<void>;
  /** 表を出して、記録した行を返す。 */
  end(): TraceRow[];
}

export interface TraceRow {
  stage: string;
  ms: number;
  detail: string;
}

const NOOP_TRACE: Trace = {
  mark: () => {},
  markAfterPaint: () => Promise.resolve(),
  end: () => [],
};

export function createTrace(label: string, enabled: boolean = import.meta.env.DEV): Trace {
  if (!enabled) return NOOP_TRACE;

  const rows: TraceRow[] = [];
  const startedAt = performance.now();
  let last = startedAt;

  const mark = (stage: string, detail = '') => {
    const now = performance.now();
    rows.push({ stage, ms: Math.round((now - last) * 10) / 10, detail });
    last = now;
  };

  return {
    mark,
    markAfterPaint: (stage, detail) =>
      new Promise((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            mark(stage, detail);
            resolve();
          }),
        );
      }),
    end: () => {
      const total = Math.round((performance.now() - startedAt) * 10) / 10;
      console.groupCollapsed(`[perf] ${label}: ${total} ms`);
      console.table(rows);
      console.groupEnd();
      return rows;
    },
  };
}

export function megabytes(bytes: number): string {
  return `${(bytes / 1e6).toFixed(1)} MB`;
}
