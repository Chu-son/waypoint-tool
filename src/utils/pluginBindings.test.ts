import { describe, it, expect } from 'vitest';
import { getPathValue, resolveBindingExpression } from './pluginBindings';

const stepOutputs = {
  filter: {
    custom_layers: [{ id: 'layer-1' }],
    inputs: { roi: { x: 1 } },
    raw: { score: 0.9, custom_layers: [{ id: 'layer-1' }] },
  },
};
const manualInputs = { gen: { start: { x: 0, y: 0 }, speed: 2 } };

describe('getPathValue', () => {
  it('follows dotted and indexed paths', () => {
    expect(getPathValue(stepOutputs.filter, 'custom_layers[0].id')).toBe('layer-1');
  });

  it('falls back to the raw output', () => {
    expect(getPathValue(stepOutputs.filter, 'score')).toBe(0.9);
  });

  it('returns undefined for missing paths', () => {
    expect(getPathValue(stepOutputs.filter, 'missing.deep')).toBeUndefined();
  });
});

describe('resolveBindingExpression', () => {
  it('resolves a path in an earlier step output', () => {
    expect(resolveBindingExpression('$steps.filter.custom_layers[0]', stepOutputs, manualInputs)).toEqual({
      id: 'layer-1',
    });
  });

  it('returns the raw output for a bare step reference', () => {
    expect(resolveBindingExpression('$steps.filter', stepOutputs, manualInputs)).toEqual(stepOutputs.filter.raw);
  });

  it('throws when the referenced step has not run', () => {
    expect(() => resolveBindingExpression('$steps.unknown.x', stepOutputs, manualInputs)).toThrow(/not found/);
  });

  it('throws when a required output path is missing', () => {
    expect(() => resolveBindingExpression('$steps.filter.waypoints[0]', stepOutputs, manualInputs)).toThrow(
      /could not be resolved/,
    );
  });

  it('treats a missing optional input path as undefined', () => {
    expect(resolveBindingExpression('$steps.filter.inputs.other', stepOutputs, manualInputs)).toBeUndefined();
  });

  it('reads manual inputs via $inputs or a bare identifier', () => {
    expect(resolveBindingExpression('$inputs.speed', stepOutputs, manualInputs)).toBe(2);
    expect(resolveBindingExpression('start', stepOutputs, manualInputs)).toEqual({ x: 0, y: 0 });
  });

  it('returns unknown identifiers as undefined but other text as a literal', () => {
    expect(resolveBindingExpression('unknown_key', stepOutputs, manualInputs)).toBeUndefined();
    expect(resolveBindingExpression('0.5', stepOutputs, manualInputs)).toBe('0.5');
  });
});
