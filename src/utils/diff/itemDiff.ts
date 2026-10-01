import { deepEqual } from '../optionValues';
import { diffLines, type DiffLine } from './lineDiff';

export type ItemDiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface ItemDiff<T> {
  key: string;
  status: ItemDiffStatus;
  /** 現在の値。`added` では undefined。 */
  current?: T;
  /** 取り込み元の値。`removed` では undefined。 */
  incoming?: T;
}

/**
 * キーで突き合わせた項目単位の差分。並びは現在の項目 → 取り込み元にだけある項目の順。
 * 同じキーが複数ある場合は先頭のものだけを突き合わせ、残りは無視する。
 */
export function diffByKey<T>(current: readonly T[], incoming: readonly T[], keyOf: (item: T) => string): ItemDiff<T>[] {
  const incomingByKey = new Map<string, T>();
  incoming.forEach((item) => {
    const key = keyOf(item);
    if (!incomingByKey.has(key)) incomingByKey.set(key, item);
  });

  const seen = new Set<string>();
  const result: ItemDiff<T>[] = [];
  current.forEach((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return;
    seen.add(key);
    const next = incomingByKey.get(key);
    if (next === undefined) result.push({ key, status: 'removed', current: item });
    else result.push({ key, status: deepEqual(item, next) ? 'unchanged' : 'changed', current: item, incoming: next });
  });
  incomingByKey.forEach((item, key) => {
    if (!seen.has(key)) result.push({ key, status: 'added', incoming: item });
  });
  return result;
}

/** 表示用に値を整形する。オブジェクトのキー順に依存しないよう、キーを昇順に並べて出力する。 */
export function toDiffText(value: unknown): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

/** 2 つの値の行単位の差分（現在 → 取り込み元）。 */
export function diffValues(current: unknown, incoming: unknown): DiffLine[] {
  return diffLines(toDiffText(current), toDiffText(incoming));
}
