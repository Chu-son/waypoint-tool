import { describe, it, expect } from 'vitest';
import { idsHiddenByAnnotationGroups, isAnnotationShown } from './annotationVisibility';
import { makeAnnotationGroup, makePointAnnotation } from '../test/fixtures';

describe('annotation visibility with groups', () => {
  const groups = {
    outer: makeAnnotationGroup('outer', ['inner', 'a'], { visible: false }),
    inner: makeAnnotationGroup('inner', ['b'], { parent_id: 'outer' }),
    open: makeAnnotationGroup('open', ['c']),
  };

  it('shows an annotation only when it and every group above it are visible', () => {
    expect(isAnnotationShown(makePointAnnotation('a', { group_id: 'outer' }), groups)).toBe(false);
    expect(isAnnotationShown(makePointAnnotation('b', { group_id: 'inner' }), groups)).toBe(false);
    expect(isAnnotationShown(makePointAnnotation('c', { group_id: 'open' }), groups)).toBe(true);
    expect(isAnnotationShown(makePointAnnotation('d'), groups)).toBe(true);
    expect(isAnnotationShown(makePointAnnotation('c', { group_id: 'open', visible: false }), groups)).toBe(false);
  });

  it('lists what a hidden group hides at any depth, leaving the group itself out', () => {
    expect([...idsHiddenByAnnotationGroups(groups)].sort()).toEqual(['a', 'b', 'inner']);
  });

  it('survives a malformed cycle', () => {
    const cyclic = {
      x: makeAnnotationGroup('x', ['y'], { parent_id: 'y' }),
      y: makeAnnotationGroup('y', ['x'], { parent_id: 'x' }),
    };
    expect(isAnnotationShown(makePointAnnotation('p', { group_id: 'x' }), cyclic)).toBe(true);
    expect(idsHiddenByAnnotationGroups({ ...cyclic, x: { ...cyclic.x, visible: false } }).size).toBeGreaterThan(0);
  });
});
