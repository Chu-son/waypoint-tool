import { describe, it, expect } from 'vitest';
import {
  countPresetUsages,
  usageCountFor,
  replaceMatchingValuesWithPreset,
  collectPresetScopes,
  inlineRemovedPresets,
} from './optionPresets';
import type { OptionsSchema } from '../types/options';

const toleranceSchema: OptionsSchema = {
  options: [
    {
      name: 'tolerance',
      label: 'Tolerance',
      type: 'float',
      presets: [
        { name: 'small', value: 0.1 },
        { name: 'large', value: 0.5 },
      ],
    },
  ],
  globals: [
    {
      name: 'default_tolerance',
      label: 'Default Tolerance',
      type: 'float',
      presets: [{ name: 'small', value: 0.1 }],
    },
  ],
};

describe('countPresetUsages', () => {
  it('counts preset references per scope, across multiple nodes', () => {
    const counts = countPresetUsages(
      toleranceSchema,
      [{ tolerance: { $preset: 'small' } }, { tolerance: { $preset: 'small' } }, { tolerance: { $preset: 'large' } }],
      {},
    );
    expect(usageCountFor(counts, 'options.tolerance', 'small')).toBe(2);
    expect(usageCountFor(counts, 'options.tolerance', 'large')).toBe(1);
    expect(usageCountFor(counts, 'options.tolerance', 'unknown')).toBe(0);
  });

  it('does not count a raw value that happens to match a preset', () => {
    const counts = countPresetUsages(toleranceSchema, [{ tolerance: 0.1 }], {});
    expect(usageCountFor(counts, 'options.tolerance', 'small')).toBe(0);
  });

  it('counts global values too', () => {
    const counts = countPresetUsages(toleranceSchema, [], { default_tolerance: { $preset: 'small' } });
    expect(usageCountFor(counts, 'globals.default_tolerance', 'small')).toBe(1);
  });

  it('collapses a ref onto its definition scope, so usage is shared across every field that refs it', () => {
    const schema: OptionsSchema = {
      options: [
        { name: 'a', label: 'A', type: 'ref', ref: 'tol' },
        { name: 'b', label: 'B', type: 'ref', ref: 'tol' },
      ],
      globals: [],
      definitions: [{ name: 'tol', type: 'float', presets: [{ name: 'small', value: 0.1 }] }],
    };
    const counts = countPresetUsages(schema, [{ a: { $preset: 'small' }, b: { $preset: 'small' } }], {});
    expect(usageCountFor(counts, 'definitions.tol', 'small')).toBe(2);
  });

  it('finds usages nested inside a list of objects', () => {
    const schema: OptionsSchema = {
      options: [
        {
          name: 'actions',
          label: 'Actions',
          type: 'list',
          item: {
            type: 'object',
            fields: [
              { name: 'tolerance', label: 'Tolerance', type: 'float', presets: [{ name: 'small', value: 0.1 }] },
            ],
          },
        },
      ],
      globals: [],
    };
    const counts = countPresetUsages(schema, [{ actions: [{ tolerance: { $preset: 'small' } }] }], {});
    expect(usageCountFor(counts, 'options.actions.item.fields.tolerance', 'small')).toBe(1);
  });
});

describe('replaceMatchingValuesWithPreset', () => {
  it('replaces a matching raw value with a preset reference, leaving other values untouched', () => {
    const result = replaceMatchingValuesWithPreset(
      toleranceSchema,
      [{ tolerance: 0.1 }, { tolerance: 0.3 }],
      {},
      'options.tolerance',
      toleranceSchema.options[0],
      'small',
    );
    expect(result.optionValuesList).toEqual([{ tolerance: { $preset: 'small' } }, { tolerance: 0.3 }]);
    expect(result.count).toBe(1);
  });

  it('does not touch a value that is already a preset reference', () => {
    const result = replaceMatchingValuesWithPreset(
      toleranceSchema,
      [{ tolerance: { $preset: 'large' } }],
      {},
      'options.tolerance',
      toleranceSchema.options[0],
      'small',
    );
    expect(result.optionValuesList).toEqual([{ tolerance: { $preset: 'large' } }]);
    expect(result.count).toBe(0);
  });

  it('replaces matching global values', () => {
    const result = replaceMatchingValuesWithPreset(
      toleranceSchema,
      [],
      { default_tolerance: 0.1 },
      'globals.default_tolerance',
      toleranceSchema.globals[0],
      'small',
    );
    expect(result.globalValues).toEqual({ default_tolerance: { $preset: 'small' } });
    expect(result.count).toBe(1);
  });

  it('replaces matching values nested inside a list of refs, honoring the definition scope', () => {
    const schema: OptionsSchema = {
      options: [{ name: 'actions', label: 'Actions', type: 'list', item: { type: 'ref', ref: 'action' } }],
      globals: [],
      definitions: [
        {
          name: 'action',
          type: 'object',
          fields: [{ name: 'countdown_ms', label: 'Countdown', type: 'integer' }],
          presets: [{ name: 'quick', value: { countdown_ms: 500 } }],
        },
      ],
    };
    const actionDef = schema.definitions![0];
    const result = replaceMatchingValuesWithPreset(
      schema,
      [{ actions: [{ countdown_ms: 500 }, { countdown_ms: 9000 }] }],
      {},
      'definitions.action',
      actionDef,
      'quick',
    );
    expect(result.optionValuesList).toEqual([{ actions: [{ $preset: 'quick' }, { countdown_ms: 9000 }] }]);
    expect(result.count).toBe(1);
  });

  it('returns count 0 when the preset name does not exist on the target spec', () => {
    const result = replaceMatchingValuesWithPreset(
      toleranceSchema,
      [{ tolerance: 0.1 }],
      {},
      'options.tolerance',
      toleranceSchema.options[0],
      'unknown',
    );
    expect(result.count).toBe(0);
    expect(result.optionValuesList).toEqual([{ tolerance: 0.1 }]);
  });
});

describe('collectPresetScopes', () => {
  it('lists every type node that declares presets, keyed by its scope', () => {
    const scopes = collectPresetScopes(toleranceSchema);
    expect(scopes.get('options.tolerance')).toEqual([
      { name: 'small', value: 0.1 },
      { name: 'large', value: 0.5 },
    ]);
    expect(scopes.get('globals.default_tolerance')).toEqual([{ name: 'small', value: 0.1 }]);
  });

  it('collapses a ref onto its definition scope, and finds presets nested inside object fields', () => {
    const schema: OptionsSchema = {
      options: [{ name: 'a', label: 'A', type: 'ref', ref: 'tol' }],
      globals: [],
      definitions: [
        {
          name: 'tol',
          type: 'object',
          fields: [{ name: 'value', label: 'Value', type: 'float', presets: [{ name: 'small', value: 0.1 }] }],
        },
      ],
    };
    const scopes = collectPresetScopes(schema);
    expect(scopes.get('definitions.tol.fields.value')).toEqual([{ name: 'small', value: 0.1 }]);
    expect(scopes.has('options.a')).toBe(false);
  });

  it('returns an empty map when nothing declares presets', () => {
    const schema: OptionsSchema = { options: [{ name: 'a', label: 'A', type: 'float' }], globals: [] };
    expect(collectPresetScopes(schema).size).toBe(0);
  });
});

describe('inlineRemovedPresets', () => {
  it('replaces a reference to a removed preset with its literal value, leaving other values untouched', () => {
    const result = inlineRemovedPresets(
      toleranceSchema,
      [{ tolerance: { $preset: 'small' } }, { tolerance: { $preset: 'large' } }, { tolerance: 0.3 }],
      {},
      [{ scope: 'options.tolerance', name: 'small', value: 0.1 }],
    );
    expect(result.optionValuesList).toEqual([
      { tolerance: 0.1 },
      { tolerance: { $preset: 'large' } },
      { tolerance: 0.3 },
    ]);
    expect(result.count).toBe(1);
  });

  it('inlines a removed global value', () => {
    const result = inlineRemovedPresets(toleranceSchema, [], { default_tolerance: { $preset: 'small' } }, [
      { scope: 'globals.default_tolerance', name: 'small', value: 0.1 },
    ]);
    expect(result.globalValues).toEqual({ default_tolerance: 0.1 });
    expect(result.count).toBe(1);
  });

  it('inlines a reference nested inside a list of refs, honoring the definition scope', () => {
    const schema: OptionsSchema = {
      options: [{ name: 'actions', label: 'Actions', type: 'list', item: { type: 'ref', ref: 'action' } }],
      globals: [],
      definitions: [
        {
          name: 'action',
          type: 'object',
          fields: [{ name: 'countdown_ms', label: 'Countdown', type: 'integer' }],
        },
      ],
    };
    const result = inlineRemovedPresets(schema, [{ actions: [{ $preset: 'quick' }, { countdown_ms: 9000 }] }], {}, [
      { scope: 'definitions.action', name: 'quick', value: { countdown_ms: 500 } },
    ]);
    expect(result.optionValuesList).toEqual([{ actions: [{ countdown_ms: 500 }, { countdown_ms: 9000 }] }]);
    expect(result.count).toBe(1);
  });
});
