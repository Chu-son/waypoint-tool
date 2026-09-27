import { describe, it, expect } from 'vitest';
import { normalizeOptionsSchema, normalizeTypeSpec, validateSchema, listScalarPaths } from './optionSchema';
import type { OptionsSchema } from '../types/options';

describe('normalizeTypeSpec', () => {
  it('converts the legacy flat list shape (item_type + enum_values) into the recursive item shape', () => {
    const spec = normalizeTypeSpec({ type: 'list', item_type: 'string', enum_values: ['dock', 'undock'] });
    expect(spec).toEqual({ type: 'list', item: { type: 'string', enum_values: ['dock', 'undock'] } });
  });

  it('defaults a legacy list with no item_type to a string item', () => {
    expect(normalizeTypeSpec({ type: 'list' })).toEqual({ type: 'list', item: { type: 'string' } });
  });

  it('is idempotent: normalizing an already-normalized spec yields the same result', () => {
    const once = normalizeTypeSpec({ type: 'list', item_type: 'integer' });
    const twice = normalizeTypeSpec(once);
    expect(twice).toEqual(once);
  });

  it('recursively normalizes object fields', () => {
    const spec = normalizeTypeSpec({
      type: 'object',
      fields: [{ name: 'a', label: 'A', type: 'list', item_type: 'boolean' }],
    });
    expect(spec).toEqual({
      type: 'object',
      fields: [{ name: 'a', label: 'A', type: 'list', item: { type: 'boolean' } }],
    });
  });

  it('defaults a union discriminator to "type" and normalizes each variant', () => {
    const spec = normalizeTypeSpec({
      type: 'union',
      variants: [{ value: 'wait', fields: [{ name: 'ms', label: 'ms', type: 'list', item_type: 'integer' }] }],
    });
    expect(spec.discriminator).toBe('type');
    expect(spec.variants?.[0].fields[0]).toEqual({ name: 'ms', label: 'ms', type: 'list', item: { type: 'integer' } });
  });

  it('falls back to string for an unrecognized type', () => {
    expect(normalizeTypeSpec({ type: 'nonsense' })).toEqual({ type: 'string' });
  });
});

describe('normalizeOptionsSchema', () => {
  it('returns an empty schema for null/undefined input', () => {
    expect(normalizeOptionsSchema(null)).toEqual({ options: [], globals: [] });
    expect(normalizeOptionsSchema(undefined)).toEqual({ options: [], globals: [] });
  });

  it('normalizes options and globals, and preserves interaction_hint on options', () => {
    const schema = normalizeOptionsSchema({
      options: [
        {
          name: 'actions',
          label: 'Actions',
          type: 'list',
          item_type: 'string',
          interaction_hint: { type: 'start_corner', target_input: 'seed_point' },
        },
      ],
      globals: [{ name: 'speed', label: 'Speed', type: 'float', value: 1.2 }],
    });
    expect(schema.options[0].item).toEqual({ type: 'string' });
    expect(schema.options[0].interaction_hint).toEqual({ type: 'start_corner', target_input: 'seed_point' });
    expect(schema.globals[0].value).toBe(1.2);
  });
});

describe('validateSchema', () => {
  it('reports an empty options array as valid', () => {
    expect(validateSchema({ options: [], globals: [] })).toEqual([]);
  });

  it('flags a duplicate key name at the top level', () => {
    const schema: OptionsSchema = {
      options: [
        { name: 'speed', label: 'A', type: 'float' },
        { name: 'speed', label: 'B', type: 'float' },
      ],
      globals: [],
    };
    expect(validateSchema(schema).some((e) => e.message.includes('speed'))).toBe(true);
  });

  it('flags an empty key name', () => {
    const schema: OptionsSchema = { options: [{ name: '', label: 'A', type: 'string' }], globals: [] };
    expect(validateSchema(schema)).toHaveLength(1);
  });

  it('flags a duplicate variant value inside a union', () => {
    const schema: OptionsSchema = {
      options: [
        {
          name: 'actions',
          label: 'Actions',
          type: 'list',
          item: {
            type: 'union',
            discriminator: 'type',
            variants: [
              { value: 'wait', fields: [] },
              { value: 'wait', fields: [] },
            ],
          },
        },
      ],
      globals: [],
    };
    expect(validateSchema(schema).some((e) => e.message.includes('wait'))).toBe(true);
  });

  it('flags a field name that collides with the discriminator key', () => {
    const schema: OptionsSchema = {
      options: [
        {
          name: 'actions',
          label: 'Actions',
          type: 'list',
          item: {
            type: 'union',
            discriminator: 'type',
            variants: [{ value: 'wait', fields: [{ name: 'type', label: 'Type', type: 'string' }] }],
          },
        },
      ],
      globals: [],
    };
    expect(validateSchema(schema)).toHaveLength(1);
  });

  it('flags a duplicate field name within an object', () => {
    const schema: OptionsSchema = {
      options: [
        {
          name: 'navigation',
          label: 'Navigation',
          type: 'object',
          fields: [
            { name: 'a', label: 'A', type: 'string' },
            { name: 'a', label: 'A2', type: 'string' },
          ],
        },
      ],
      globals: [],
    };
    expect(validateSchema(schema)).toHaveLength(1);
  });
});

describe('listScalarPaths', () => {
  it('lists a dot path per top-level option', () => {
    const schema: OptionsSchema = {
      options: [
        { name: 'speed', label: 'Speed', type: 'float' },
        { name: 'actions', label: 'Actions', type: 'list', item: { type: 'string' } },
      ],
      globals: [],
    };
    expect(listScalarPaths(schema)).toEqual(['options.speed', 'options.actions']);
  });

  it('expands an object field into paths for each of its sub-fields', () => {
    const schema: OptionsSchema = {
      options: [
        {
          name: 'navigation',
          label: 'Navigation',
          type: 'object',
          fields: [{ name: 'is_through_point', label: 'Through', type: 'boolean' }],
        },
      ],
      globals: [],
    };
    expect(listScalarPaths(schema)).toEqual(['options.navigation', 'options.navigation.is_through_point']);
  });
});
