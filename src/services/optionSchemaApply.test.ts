import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogAPI } from '../api';
import type { OptionsSchema } from '../types/options';
import { makeWaypoint, waypointTree } from '../test/fixtures';
import { getAppState, resetAppStore } from '../test/store';
import { applyOptionsSchema } from './optionSchemaApply';

const withPreset: OptionsSchema = {
  options: [{ name: 'mode', label: 'Mode', type: 'string', presets: [{ name: 'fast', value: 'F' }] }],
  globals: [],
  definitions: [],
};
const withoutPreset: OptionsSchema = {
  options: [{ name: 'mode', label: 'Mode', type: 'string' }],
  globals: [],
  definitions: [],
};

describe('applyOptionsSchema', () => {
  beforeEach(() => {
    vi.spyOn(DialogAPI, 'message').mockResolvedValue(undefined);
    resetAppStore({
      ...waypointTree([makeWaypoint('w', { options: { mode: { $preset: 'fast' } } })]),
      optionsSchema: withPreset,
      isDirty: false,
    });
  });

  it('stores a valid schema and marks the project as modified', async () => {
    const applied = await applyOptionsSchema({
      options: [...withPreset.options, { name: 'speed', label: 'Speed', type: 'float' }],
      globals: [],
      definitions: [],
    });

    expect(applied).toBe(true);
    expect(getAppState().optionsSchema?.options.map((o) => o.name)).toEqual(['mode', 'speed']);
    expect(getAppState().isDirty).toBe(true);
  });

  it('refuses an invalid schema, tells the user and keeps the current one', async () => {
    const applied = await applyOptionsSchema({
      options: [{ name: 'p', label: 'P', type: 'ref', ref: 'Missing' }],
      globals: [],
      definitions: [],
    });

    expect(applied).toBe(false);
    expect(DialogAPI.message).toHaveBeenCalled();
    expect(getAppState().optionsSchema).toEqual(withPreset);
  });

  it('expands values that used a removed preset once the user agrees', async () => {
    vi.spyOn(DialogAPI, 'ask').mockResolvedValue(true);

    const applied = await applyOptionsSchema(withoutPreset);

    expect(applied).toBe(true);
    expect(getAppState().nodes.w.options).toEqual({ mode: 'F' });
  });

  it('changes nothing when the user declines the expansion', async () => {
    vi.spyOn(DialogAPI, 'ask').mockResolvedValue(false);

    const applied = await applyOptionsSchema(withoutPreset);

    expect(applied).toBe(false);
    expect(getAppState().nodes.w.options).toEqual({ mode: { $preset: 'fast' } });
    expect(getAppState().optionsSchema).toEqual(withPreset);
  });
});
