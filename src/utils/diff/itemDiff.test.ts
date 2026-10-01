import { describe, it, expect } from 'vitest';
import { diffByKey, diffValues, toDiffText } from './itemDiff';

const byName = (item: { name: string }) => item.name;

describe('diffByKey', () => {
  it('classifies added, removed, changed and unchanged items', () => {
    const current = [
      { name: 'keep', v: 1 },
      { name: 'edit', v: 1 },
      { name: 'gone', v: 1 },
    ];
    const incoming = [
      { name: 'keep', v: 1 },
      { name: 'edit', v: 2 },
      { name: 'fresh', v: 1 },
    ];

    const result = diffByKey(current, incoming, byName);

    expect(result.map((d) => [d.key, d.status])).toEqual([
      ['keep', 'unchanged'],
      ['edit', 'changed'],
      ['gone', 'removed'],
      ['fresh', 'added'],
    ]);
    expect(result[1]).toMatchObject({ current: { v: 1 }, incoming: { v: 2 } });
  });

  it('treats nested values with the same content as unchanged', () => {
    const result = diffByKey([{ name: 'a', deep: { x: [1, 2] } }], [{ name: 'a', deep: { x: [1, 2] } }], byName);
    expect(result[0].status).toBe('unchanged');
  });

  it('uses only the first of duplicate keys', () => {
    const result = diffByKey(
      [{ name: 'a', v: 1 }],
      [
        { name: 'a', v: 1 },
        { name: 'a', v: 9 },
      ],
      byName,
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('unchanged');
  });
});

describe('diff text', () => {
  it('prints objects with sorted keys so key order never shows up as a change', () => {
    expect(toDiffText({ b: 1, a: 2 })).toBe(toDiffText({ a: 2, b: 1 }));
    expect(diffValues({ b: 1, a: 2 }, { a: 2, b: 1 }).every((l) => l.type === 'same')).toBe(true);
  });

  it('reports the changed line of a value', () => {
    const lines = diffValues({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(lines.filter((l) => l.type !== 'same').map((l) => [l.type, l.text.trim()])).toEqual([
      ['del', '"b": 2'],
      ['add', '"b": 3'],
    ]);
  });

  it('passes strings through untouched', () => {
    expect(toDiffText('line1\nline2')).toBe('line1\nline2');
  });
});
