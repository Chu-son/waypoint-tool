import { describe, it, expect } from 'vitest';
import type { OptionDef, OptionsSchema } from '../../types/options';
import { validateSchema } from '../optionSchema';
import { defaultAcceptedIds, diffOptionsSchema, mergeOptionsSchema, schemaItemId } from './optionSchemaMerge';

const str = (name: string, label = name): OptionDef => ({ name, label, type: 'string' });
const schema = (options: OptionDef[], extra: Partial<OptionsSchema> = {}): OptionsSchema => ({
  options,
  globals: [],
  definitions: [],
  ...extra,
});
const names = (s: OptionsSchema) => s.options.map((o) => o.name);

describe('diffOptionsSchema', () => {
  it('reports added, changed and removed options by name', () => {
    const current = schema([str('keep'), str('edit', 'Old'), str('gone')]);
    const incoming = schema([str('keep'), str('edit', 'New'), str('fresh')]);

    const diffs = diffOptionsSchema(current, incoming);

    expect(diffs.map((d) => [d.id, d.status])).toEqual([
      ['options:keep', 'unchanged'],
      ['options:edit', 'changed'],
      ['options:gone', 'removed'],
      ['options:fresh', 'added'],
    ]);
  });

  it('treats every incoming item as added when no schema is defined yet', () => {
    const diffs = diffOptionsSchema(null, schema([str('a')], { globals: [{ name: 'g', label: 'G', type: 'string' }] }));
    expect(diffs.map((d) => [d.id, d.status])).toEqual([
      ['options:a', 'added'],
      ['globals:g', 'added'],
    ]);
  });

  it('keeps the same name in different sections apart', () => {
    const current = schema([str('x')]);
    const incoming = schema([str('x')], { globals: [{ name: 'x', label: 'X', type: 'string' }] });
    expect(diffOptionsSchema(current, incoming).map((d) => [d.id, d.status])).toEqual([
      ['options:x', 'unchanged'],
      ['globals:x', 'added'],
    ]);
  });
});

describe('mergeOptionsSchema', () => {
  const current = schema([str('keep'), str('edit', 'Old'), str('gone')]);
  const incoming = schema([str('keep'), str('edit', 'New'), str('fresh')]);
  const diffs = diffOptionsSchema(current, incoming);

  it('by default adds and updates incoming items and keeps current-only items', () => {
    const merged = mergeOptionsSchema(diffs, defaultAcceptedIds(diffs));

    expect(names(merged)).toEqual(['keep', 'edit', 'gone', 'fresh']);
    expect(merged.options.find((o) => o.name === 'edit')?.label).toBe('New');
  });

  it('leaves out what is not accepted', () => {
    const merged = mergeOptionsSchema(diffs, new Set([schemaItemId('options', 'fresh')]));

    expect(names(merged)).toEqual(['keep', 'edit', 'gone', 'fresh']);
    expect(merged.options.find((o) => o.name === 'edit')?.label).toBe('Old');
    expect(mergeOptionsSchema(diffs, new Set()).options.map((o) => o.name)).toEqual(['keep', 'edit', 'gone']);
  });

  it('deletes a current-only item when the removal is accepted', () => {
    const merged = mergeOptionsSchema(diffs, new Set([schemaItemId('options', 'gone')]));
    expect(names(merged)).toEqual(['keep', 'edit']);
  });

  it('produces a schema that validates when every dependency is taken along', () => {
    const withRef = schema([{ name: 'p', label: 'P', type: 'ref', ref: 'Pt' }], {
      definitions: [{ name: 'Pt', type: 'object', fields: [str('x')] }],
    });
    const d = diffOptionsSchema(null, withRef);

    expect(validateSchema(mergeOptionsSchema(d, defaultAcceptedIds(d)))).toEqual([]);
  });

  it('exposes a dangling ref when the definition it needs is not accepted', () => {
    const withRef = schema([{ name: 'p', label: 'P', type: 'ref', ref: 'Pt' }], {
      definitions: [{ name: 'Pt', type: 'object', fields: [str('x')] }],
    });
    const d = diffOptionsSchema(null, withRef);
    const withoutDefinition = new Set([schemaItemId('options', 'p')]);

    expect(validateSchema(mergeOptionsSchema(d, withoutDefinition)).length).toBeGreaterThan(0);
  });
});
