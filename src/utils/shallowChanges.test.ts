import { describe, expect, it } from 'vitest';
import { changesAny, shallowEqual, updateById } from './shallowChanges';

const inner = { x: 1 };

describe('shallowEqual', () => {
  it.each([
    ['the same value', 1, 1, true],
    ['NaN and NaN', NaN, NaN, true],
    ['different values', 1, 2, false],
    ['arrays with the same entries', [1, inner], [1, inner], true],
    ['arrays of different lengths', [1, 2], [1], false],
    ['arrays whose entries are equal only deeper down', [{ x: 1 }], [{ x: 1 }], false],
    ['objects with the same entries', { a: 1, b: inner }, { b: inner, a: 1 }, true],
    ['objects with a different entry', { a: 1 }, { a: 2 }, false],
    ['objects where one has an extra key', { a: 1 }, { a: 1, b: 2 }, false],
    ['objects with different keys of the same count', { a: 1 }, { b: 1 }, false],
    ['an object and an array', {}, [], false],
    ['null and an empty object', null, {}, false],
  ])('%s → %s', (_name, a, b, expected) => {
    expect(shallowEqual(a, b)).toBe(expected);
    expect(shallowEqual(b, a)).toBe(expected);
  });
});

describe('changesAny', () => {
  const target = { name: 'a', rect: { x: 0, y: 0 }, origin: [1, 2, 0] };

  it.each([
    ['no updates', {}, false],
    ['the values it has', { name: 'a' }, false],
    ['a rebuilt object with the same entries', { rect: { x: 0, y: 0 } }, false],
    ['a rebuilt array with the same entries', { origin: [1, 2, 0] }, false],
    ['a new value', { name: 'b' }, true],
    ['a rebuilt object with a new entry', { rect: { x: 1, y: 0 } }, true],
    ['a rebuilt object that drops a key', { rect: { x: 0 } as never }, true],
  ])('%s → %s', (_name, updates, expected) => {
    expect(changesAny(target, updates)).toBe(expected);
  });
});

describe('updateById', () => {
  const items = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
  ];

  it('returns a new list with only that item replaced', () => {
    const next = updateById(items, 'b', { name: 'renamed' });

    expect(next).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'renamed' },
    ]);
    expect(next![0]).toBe(items[0]);
    expect(items[1].name).toBe('B');
  });

  it('returns nothing when the item is missing or nothing would change', () => {
    expect(updateById(items, 'gone', { name: 'x' })).toBeUndefined();
    expect(updateById(items, 'a', { name: 'A' })).toBeUndefined();
  });
});
