import { describe, it, expect } from 'vitest';
import { collapseContext, countChanges, diffLines } from './lineDiff';

describe('diffLines', () => {
  it.each([
    [
      'identical text',
      'a\nb',
      'a\nb',
      [
        ['same', 'a'],
        ['same', 'b'],
      ],
    ],
    [
      'an appended line',
      'a',
      'a\nb',
      [
        ['same', 'a'],
        ['add', 'b'],
      ],
    ],
    [
      'a removed line',
      'a\nb\nc',
      'a\nc',
      [
        ['same', 'a'],
        ['del', 'b'],
        ['same', 'c'],
      ],
    ],
    [
      'a replaced line',
      'a\nb\nc',
      'a\nX\nc',
      [
        ['same', 'a'],
        ['del', 'b'],
        ['add', 'X'],
        ['same', 'c'],
      ],
    ],
    ['an empty before', '', 'a', [['add', 'a']]],
    ['an empty after', 'a', '', [['del', 'a']]],
    ['a trailing newline only', 'a\n', 'a', [['same', 'a']]],
  ])('reports %s', (_name, before, after, expected) => {
    expect(diffLines(before, after).map((l) => [l.type, l.text])).toEqual(expected);
  });

  it('keeps the unchanged lines between two edits', () => {
    const lines = diffLines('1\n2\n3\n4\n5', '1\nX\n3\n4\nY');
    expect(countChanges(lines)).toEqual({ added: 2, removed: 2 });
    expect(lines.filter((l) => l.type === 'same').map((l) => l.text)).toEqual(['1', '3', '4']);
  });
});

describe('collapseContext', () => {
  const numbered = (n: number) => Array.from({ length: n }, (_, i) => ({ type: 'same' as const, text: String(i) }));

  it('folds long unchanged stretches around a change', () => {
    const lines = [...numbered(10), { type: 'add' as const, text: 'new' }, ...numbered(10)];

    const rows = collapseContext(lines, 2);

    expect(rows[0]).toEqual({ type: 'collapsed', count: 8 });
    expect(rows[rows.length - 1]).toEqual({ type: 'collapsed', count: 8 });
    expect(rows.filter((r) => r.type !== 'collapsed')).toHaveLength(5);
  });

  it('folds everything when nothing changed', () => {
    expect(collapseContext(numbered(4), 1)).toEqual([{ type: 'collapsed', count: 4 }]);
  });
});
