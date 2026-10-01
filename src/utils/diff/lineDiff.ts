export type DiffLineType = 'same' | 'add' | 'del';

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

/** 折りたたまれた（表示を省いた）連続する変更なし行。`count` は省いた行数。 */
export interface CollapsedMarker {
  type: 'collapsed';
  count: number;
}

export type DiffRow = DiffLine | CollapsedMarker;

/**
 * 行単位の差分（LCS）。`before` から `after` へ変えるのに必要な削除・追加を、元の行順で返す。
 * 入力は `\n` で分割する。末尾の改行だけの違いは差分として扱わない。
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);

  // 共通する先頭・末尾は LCS の表から外し、計算量を変更部分だけに抑える。
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const result: DiffLine[] = a.slice(0, head).map((text) => ({ type: 'same', text }));
  result.push(...diffMiddle(midA, midB));
  result.push(...a.slice(a.length - tail).map((text): DiffLine => ({ type: 'same', text })));
  return result;
}

function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function diffMiddle(a: string[], b: string[]): DiffLine[] {
  if (a.length === 0) return b.map((text) => ({ type: 'add', text }));
  if (b.length === 0) return a.map((text) => ({ type: 'del', text }));

  // lcs[i][j] = a[i..] と b[j..] の最長共通部分列の長さ
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: 'del', text: a[i++] });
    } else {
      out.push({ type: 'add', text: b[j++] });
    }
  }
  while (i < a.length) out.push({ type: 'del', text: a[i++] });
  while (j < b.length) out.push({ type: 'add', text: b[j++] });
  return out;
}

/** 変更行の前後 `context` 行だけを残し、それ以外の変更なし行を `collapsed` にまとめる。 */
export function collapseContext(lines: DiffLine[], context = 2): DiffRow[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, index) => {
    if (line.type === 'same') return;
    for (let k = Math.max(0, index - context); k <= Math.min(lines.length - 1, index + context); k++) keep[k] = true;
  });

  const rows: DiffRow[] = [];
  let skipped = 0;
  lines.forEach((line, index) => {
    if (keep[index]) {
      if (skipped > 0) rows.push({ type: 'collapsed', count: skipped });
      skipped = 0;
      rows.push(line);
    } else {
      skipped++;
    }
  });
  if (skipped > 0) rows.push({ type: 'collapsed', count: skipped });
  return rows;
}

/** 追加行と削除行の数。 */
export function countChanges(lines: DiffLine[]): { added: number; removed: number } {
  return lines.reduce(
    (acc, line) => {
      if (line.type === 'add') acc.added++;
      else if (line.type === 'del') acc.removed++;
      return acc;
    },
    { added: 0, removed: 0 },
  );
}
