import { describe, it, expect } from 'vitest';
import {
  coerceValue,
  toStoredValue,
  isValueValid,
  validateValue,
  resolveWithDefaults,
  createValue,
  createUnionVariantValue,
  switchUnionVariant,
  summarizeValue,
  deepEqual,
} from './optionValues';
import type { FieldDef, TypeSpec } from '../types/options';

describe('coerceValue', () => {
  it.each([
    [{ type: 'float' } as TypeSpec, '0.5', 0.5],
    [{ type: 'integer' } as TypeSpec, '7', 7],
    [{ type: 'boolean' } as TypeSpec, 'true', true],
    [{ type: 'boolean' } as TypeSpec, 'false', false],
    [{ type: 'string' } as TypeSpec, 'map', 'map'],
  ])('coerces a scalar %o input %j to %j', (spec, raw, expected) => {
    expect(coerceValue(spec, raw)).toEqual(expected);
  });

  it('falls back when a number cannot be parsed', () => {
    expect(coerceValue({ type: 'float' }, 'abc', 1.5)).toBe(1.5);
    expect(coerceValue({ type: 'integer' }, 'abc', 2)).toBe(2);
  });

  it('wraps a scalar into a list and coerces each element by the item spec', () => {
    expect(coerceValue({ type: 'list', item: { type: 'string' } }, 'a')).toEqual(['a']);
    expect(coerceValue({ type: 'list', item: { type: 'integer' } }, ['1', '2'])).toEqual([1, 2]);
  });

  it('recursively coerces object fields, dropping keys the object does not declare', () => {
    const spec: TypeSpec = {
      type: 'object',
      fields: [
        { name: 'is_through_point', label: 'Through', type: 'boolean' },
        { name: 'through_tolerance', label: 'Tolerance', type: 'float' },
      ],
    };
    expect(coerceValue(spec, { is_through_point: 'false', through_tolerance: '3.0', unknown_key: 'x' })).toEqual({
      is_through_point: false,
      through_tolerance: 3.0,
    });
  });

  it('coerces map values by the declared value_type, keeping arbitrary keys', () => {
    const spec: TypeSpec = { type: 'map', value_type: { type: 'boolean' } };
    expect(coerceValue(spec, { data: 'true' })).toEqual({ data: true });
  });

  it('coerces a union by discriminator, keeping only the matched variant fields', () => {
    const spec: TypeSpec = {
      type: 'union',
      discriminator: 'type',
      variants: [
        {
          value: 'wait',
          fields: [{ name: 'countdown_ms', label: 'Countdown', type: 'integer' }],
        },
        { value: 'amcl_reset', fields: [] },
      ],
    };
    expect(coerceValue(spec, { type: 'wait', countdown_ms: '3000', stray: 'x' })).toEqual({
      type: 'wait',
      countdown_ms: 3000,
    });
  });

  it('passes an unknown union variant through unchanged', () => {
    const spec: TypeSpec = { type: 'union', variants: [{ value: 'known', fields: [] }] };
    expect(coerceValue(spec, { type: 'unknown', foo: 'bar' })).toEqual({ type: 'unknown', foo: 'bar' });
  });
});

describe('toStoredValue', () => {
  it.each([
    [{ type: 'string' } as TypeSpec, ''],
    [{ type: 'float' } as TypeSpec, ''],
    [{ type: 'list', item: { type: 'string' } } as TypeSpec, []],
    [{ type: 'string' } as TypeSpec, undefined],
  ])('treats an empty input %j for %o as unset', (spec, raw) => {
    expect(toStoredValue(spec, raw)).toBeUndefined();
  });

  it('stores a non-empty value', () => {
    expect(toStoredValue({ type: 'list', item: { type: 'string' } }, ['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('validateValue / isValueValid', () => {
  it.each([
    [{ type: 'float' } as TypeSpec, '1.5', true],
    [{ type: 'float' } as TypeSpec, 'abc', false],
    [{ type: 'integer' } as TypeSpec, '3', true],
    [{ type: 'integer' } as TypeSpec, '3.5', false],
    [{ type: 'boolean' } as TypeSpec, 'TRUE', true],
    [{ type: 'boolean' } as TypeSpec, 'yes', false],
    [{ type: 'string' } as TypeSpec, 'anything', true],
    [{ type: 'float' } as TypeSpec, '', true],
    [{ type: 'float' } as TypeSpec, undefined, true],
  ])('%o value %j is valid: %s', (spec, value, expected) => {
    expect(isValueValid(spec, value)).toBe(expected);
  });

  it('reports a path-qualified error for an invalid nested union field', () => {
    const spec: TypeSpec = {
      type: 'union',
      discriminator: 'type',
      variants: [{ value: 'wait', fields: [{ name: 'countdown_ms', label: 'Countdown', type: 'integer' }] }],
    };
    const errors = validateValue(spec, { type: 'wait', countdown_ms: 'abc' }, 'options.actions[0]');
    expect(errors).toEqual([{ path: 'options.actions[0].countdown_ms', message: expect.any(String) }]);
  });

  it('reports an error for an unknown union variant', () => {
    const spec: TypeSpec = { type: 'union', variants: [{ value: 'known', fields: [] }] };
    expect(validateValue(spec, { type: 'nope' })).toHaveLength(1);
  });
});

describe('resolveWithDefaults', () => {
  it('returns the field default when the value is unset', () => {
    const field: FieldDef = { name: 'speed', label: 'Speed', type: 'float', default: 1.5 };
    expect(resolveWithDefaults(field, undefined)).toBe(1.5);
  });

  it('returns the explicit value untouched for scalars', () => {
    const field: FieldDef = { name: 'speed', label: 'Speed', type: 'float', default: 1.5 };
    expect(resolveWithDefaults(field, 2.0)).toBe(2.0);
  });

  it('fills in missing object fields with their own defaults, keeping explicit fields', () => {
    const field: FieldDef = {
      name: 'navigation',
      label: 'Navigation',
      type: 'object',
      fields: [
        { name: 'is_through_point', label: 'Through', type: 'boolean', default: true },
        { name: 'through_tolerance', label: 'Tolerance', type: 'float', default: 3.0 },
      ],
    };
    expect(resolveWithDefaults(field, { is_through_point: false })).toEqual({
      is_through_point: false,
      through_tolerance: 3.0,
    });
  });

  it('fills in missing fields of each variant inside a list of unions', () => {
    const field: FieldDef = {
      name: 'on_reached_actions',
      label: 'Actions',
      type: 'list',
      item: {
        type: 'union',
        discriminator: 'type',
        variants: [
          { value: 'wait', fields: [{ name: 'countdown_ms', label: 'Countdown', type: 'integer', default: 3000 }] },
        ],
      },
    };
    expect(resolveWithDefaults(field, [{ type: 'wait' }])).toEqual([{ type: 'wait', countdown_ms: 3000 }]);
  });
});

describe('createValue / createUnionVariantValue', () => {
  it.each([
    [{ type: 'string' } as TypeSpec, ''],
    [{ type: 'float' } as TypeSpec, 0],
    [{ type: 'integer' } as TypeSpec, 0],
    [{ type: 'boolean' } as TypeSpec, false],
    [{ type: 'list' } as TypeSpec, []],
    [{ type: 'object' } as TypeSpec, {}],
    [{ type: 'map' } as TypeSpec, {}],
  ])('creates a bare initial value for %o', (spec, expected) => {
    expect(createValue(spec)).toEqual(expected);
  });

  it('creates a union value holding only the discriminator, leaving fields unset', () => {
    const spec: TypeSpec = {
      type: 'union',
      discriminator: 'type',
      variants: [
        { value: 'wait', fields: [{ name: 'countdown_ms', label: 'Countdown', type: 'integer', default: 3000 }] },
      ],
    };
    expect(createValue(spec)).toEqual({ type: 'wait' });
    expect(createUnionVariantValue(spec, 'wait')).toEqual({ type: 'wait' });
  });
});

describe('switchUnionVariant', () => {
  const spec: TypeSpec = {
    type: 'union',
    discriminator: 'type',
    variants: [
      {
        value: 'service',
        fields: [
          { name: 'service', label: 'Service', type: 'string' },
          { name: 'request', label: 'Request', type: 'map' },
        ],
      },
      { value: 'wait', fields: [{ name: 'countdown_ms', label: 'Countdown', type: 'integer' }] },
    ],
  };

  it('keeps fields that exist by name in the new variant', () => {
    // 'service' と 'wait' の両方に同名フィールドは無いため、ここでは discriminator の切替のみを確認する。
    const result = switchUnionVariant(spec, { type: 'service', service: '/foo', request: { data: true } }, 'wait');
    expect(result).toEqual({ type: 'wait' });
  });

  it('drops fields the new variant does not declare', () => {
    const result = switchUnionVariant(spec, { type: 'wait', countdown_ms: 3000 }, 'service');
    expect(result).toEqual({ type: 'service' });
  });
});

describe('summarizeValue', () => {
  it('returns an empty string for an unset value', () => {
    expect(summarizeValue({ type: 'string' }, undefined)).toBe('');
  });

  it('summarizes a list of unions by their discriminator values', () => {
    const spec: TypeSpec = {
      type: 'list',
      item: { type: 'union', discriminator: 'type', variants: [] },
    };
    expect(summarizeValue(spec, [{ type: 'service' }, { type: 'wait' }])).toBe('[service, wait]');
  });

  it('summarizes a plain object and a map without dumping their contents', () => {
    expect(summarizeValue({ type: 'object' }, { a: 1 })).toBe('{...}');
    expect(summarizeValue({ type: 'map' }, { a: 1, b: 2 })).toBe('{2 keys}');
  });

  it('stringifies scalars directly', () => {
    expect(summarizeValue({ type: 'float' }, 1.5)).toBe('1.5');
  });
});

describe('deepEqual', () => {
  it('treats structurally identical arrays and objects as equal', () => {
    expect(deepEqual([{ type: 'wait', countdown_ms: 3000 }], [{ type: 'wait', countdown_ms: 3000 }])).toBe(true);
  });

  it('detects a difference in a nested field', () => {
    expect(deepEqual([{ type: 'wait', countdown_ms: 3000 }], [{ type: 'wait', countdown_ms: 4000 }])).toBe(false);
  });

  it('detects a difference in array length', () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });
});
