import { describe, it, expect } from 'vitest';
import {
  normalizeOptionsSchema,
  normalizeTypeSpec,
  validateSchema,
  listPropertyPaths,
  resolveTypeSpec,
  expandSchemaRefs,
  resolveOptionsSchema,
} from './optionSchema';
import type { DefinitionDef, OptionsSchema } from '../types/options';

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

  it('normalizes a ref type, keeping the referenced name', () => {
    expect(normalizeTypeSpec({ type: 'ref', ref: 'action' })).toEqual({ type: 'ref', ref: 'action' });
  });
});

describe('normalizeOptionsSchema', () => {
  it('returns an empty schema (with an empty definitions array) for null/undefined input', () => {
    expect(normalizeOptionsSchema(null)).toEqual({ options: [], globals: [], definitions: [] });
    expect(normalizeOptionsSchema(undefined)).toEqual({ options: [], globals: [], definitions: [] });
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

  it('normalizes definitions, including name/label/description', () => {
    const schema = normalizeOptionsSchema({
      options: [],
      globals: [],
      definitions: [{ name: 'action', label: 'Action', description: 'A reusable action', type: 'string' }],
    });
    expect(schema.definitions).toEqual([
      { name: 'action', label: 'Action', description: 'A reusable action', type: 'string' },
    ]);
  });

  it('coerces a legacy string default to the declared scalar type', () => {
    const schema = normalizeOptionsSchema({
      options: [{ name: 'speed', label: 'Speed', type: 'float', default: '1.5' }],
      globals: [{ name: 'enabled', label: 'Enabled', type: 'boolean', value: 'true' }],
    });
    expect(schema.options[0].default).toBe(1.5);
    expect(schema.globals[0].value).toBe(true);
  });

  it('coerces a default nested inside an object field', () => {
    const schema = normalizeOptionsSchema({
      options: [
        {
          name: 'navigation',
          label: 'Navigation',
          type: 'object',
          fields: [{ name: 'through_tolerance', label: 'Tolerance', type: 'float', default: '3.0' }],
        },
      ],
      globals: [],
    });
    expect(schema.options[0].fields?.[0].default).toBe(3.0);
  });

  it('coerces a default through a ref, using the referenced definition type', () => {
    const schema = normalizeOptionsSchema({
      options: [{ name: 'countdown_ms', label: 'Countdown', type: 'ref', ref: 'ms', default: '3000' }],
      globals: [],
      definitions: [{ name: 'ms', type: 'integer' }],
    });
    expect(schema.options[0].default).toBe(3000);
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

  it('flags a default value that does not match its field type', () => {
    const schema: OptionsSchema = {
      options: [{ name: 'speed', label: 'Speed', type: 'float', default: 'not-a-number' }],
      globals: [],
    };
    expect(validateSchema(schema)).toHaveLength(1);
  });

  it('flags a default value outside the declared choices', () => {
    const schema: OptionsSchema = {
      options: [
        { name: 'mode', label: 'Mode', type: 'string', enum_values: ['normal', 'queue_wait'], default: 'bogus' },
      ],
      globals: [],
    };
    expect(validateSchema(schema)).toHaveLength(1);
  });

  it('flags a global value that does not match its field type', () => {
    const schema: OptionsSchema = {
      options: [],
      globals: [{ name: 'speed', label: 'Speed', type: 'float', value: 'nope' }],
    };
    expect(validateSchema(schema)).toHaveLength(1);
  });

  describe('definitions / ref', () => {
    it('accepts a valid ref to a defined type', () => {
      const schema: OptionsSchema = {
        options: [{ name: 'a', label: 'A', type: 'ref', ref: 'shared' }],
        globals: [],
        definitions: [{ name: 'shared', type: 'string' }],
      };
      expect(validateSchema(schema)).toEqual([]);
    });

    it('flags a ref to an undefined type', () => {
      const schema: OptionsSchema = {
        options: [{ name: 'a', label: 'A', type: 'ref', ref: 'missing' }],
        globals: [],
      };
      expect(validateSchema(schema).some((e) => e.message.includes('missing'))).toBe(true);
    });

    it('flags an empty ref name', () => {
      const schema: OptionsSchema = {
        options: [{ name: 'a', label: 'A', type: 'ref', ref: '' }],
        globals: [],
      };
      expect(validateSchema(schema)).toHaveLength(1);
    });

    it('flags a direct self-reference as a cycle', () => {
      const schema: OptionsSchema = {
        options: [],
        globals: [],
        definitions: [{ name: 'a', type: 'ref', ref: 'a' }],
      };
      expect(validateSchema(schema).some((e) => e.message.includes('循環'))).toBe(true);
    });

    it('flags an indirect cycle (a -> b -> a)', () => {
      const schema: OptionsSchema = {
        options: [],
        globals: [],
        definitions: [
          { name: 'a', type: 'ref', ref: 'b' },
          { name: 'b', type: 'ref', ref: 'a' },
        ],
      };
      expect(validateSchema(schema).some((e) => e.message.includes('循環'))).toBe(true);
    });

    it('flags a duplicate or empty definition name', () => {
      const schema: OptionsSchema = {
        options: [],
        globals: [],
        definitions: [
          { name: 'action', type: 'string' },
          { name: 'action', type: 'integer' },
          { name: '', type: 'string' },
        ],
      };
      const errors = validateSchema(schema);
      expect(errors.some((e) => e.message.includes('action'))).toBe(true);
      expect(errors.some((e) => e.path === 'definitions[2]')).toBe(true);
    });
  });
});

describe('resolveTypeSpec', () => {
  const definitions: DefinitionDef[] = [
    { name: 'ms', type: 'integer' },
    {
      name: 'action',
      type: 'union',
      discriminator: 'type',
      variants: [{ value: 'wait', fields: [{ name: 'countdown_ms', label: 'Countdown', type: 'ref', ref: 'ms' }] }],
    },
  ];
  const byName = new Map(definitions.map((d) => [d.name, d]));

  it('replaces a ref with the referenced definition', () => {
    expect(resolveTypeSpec({ type: 'ref', ref: 'ms' }, byName)).toEqual({ type: 'integer' });
  });

  it('resolves a ref nested inside a union variant field', () => {
    const resolved = resolveTypeSpec({ type: 'ref', ref: 'action' }, byName);
    expect(resolved.variants?.[0].fields[0]).toMatchObject({ name: 'countdown_ms', type: 'integer' });
  });

  it('falls back to any for an undefined ref', () => {
    expect(resolveTypeSpec({ type: 'ref', ref: 'missing' }, byName)).toEqual({ type: 'any' });
  });

  it('falls back to any for a cyclic ref instead of infinitely recursing', () => {
    const cyclic = new Map<string, DefinitionDef>([
      ['a', { name: 'a', type: 'ref', ref: 'b' }],
      ['b', { name: 'b', type: 'ref', ref: 'a' }],
    ]);
    expect(resolveTypeSpec({ type: 'ref', ref: 'a' }, cyclic)).toEqual({ type: 'any' });
  });
});

describe('expandSchemaRefs / resolveOptionsSchema', () => {
  const schema: OptionsSchema = {
    options: [
      { name: 'on_reached', label: 'On Reached', type: 'list', item: { type: 'ref', ref: 'action' } },
      { name: 'on_departure', label: 'On Departure', type: 'list', item: { type: 'ref', ref: 'action' } },
    ],
    globals: [],
    definitions: [
      {
        name: 'action',
        type: 'union',
        discriminator: 'type',
        variants: [{ value: 'wait', fields: [{ name: 'countdown_ms', label: 'Countdown', type: 'integer' }] }],
      },
    ],
  };

  it('expands the same definition wherever it is referenced', () => {
    const expanded = expandSchemaRefs(schema);
    expect(expanded.options[0].item).toEqual(expanded.options[1].item);
    expect(expanded.options[0].item?.type).toBe('union');
    expect(expanded.options[0].item?.variants?.[0].value).toBe('wait');
  });

  it('leaves no definitions or ref types in the expanded output', () => {
    const expanded = expandSchemaRefs(schema);
    expect(expanded.definitions).toEqual([]);
    expect(JSON.stringify(expanded)).not.toContain('"ref"');
  });

  it('resolveOptionsSchema memoizes by schema object identity', () => {
    const first = resolveOptionsSchema(schema);
    const second = resolveOptionsSchema(schema);
    expect(first).toBe(second);
  });

  it('resolveOptionsSchema returns the same object when there are no definitions to expand', () => {
    const noRefs: OptionsSchema = { options: [{ name: 'a', label: 'A', type: 'string' }], globals: [] };
    expect(resolveOptionsSchema(noRefs)).toBe(noRefs);
  });

  it('resolveOptionsSchema returns null for null input', () => {
    expect(resolveOptionsSchema(null)).toBeNull();
  });
});

describe('listPropertyPaths', () => {
  it('lists a dot path per top-level option', () => {
    const schema: OptionsSchema = {
      options: [
        { name: 'speed', label: 'Speed', type: 'float' },
        { name: 'actions', label: 'Actions', type: 'list', item: { type: 'string' } },
      ],
      globals: [],
    };
    expect(listPropertyPaths(schema)).toEqual(['options.speed', 'options.actions']);
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
    expect(listPropertyPaths(schema)).toEqual(['options.navigation', 'options.navigation.is_through_point']);
  });

  it('resolves a ref before walking into it', () => {
    const schema: OptionsSchema = {
      options: [{ name: 'nav', label: 'Nav', type: 'ref', ref: 'navigation' }],
      globals: [],
      definitions: [
        {
          name: 'navigation',
          type: 'object',
          fields: [{ name: 'is_through_point', label: 'Through', type: 'boolean' }],
        },
      ],
    };
    expect(listPropertyPaths(schema)).toEqual(['options.nav', 'options.nav.is_through_point']);
  });
});
