import { describe, it, expect } from 'vitest';
import raw from '../../docs/sample/option_schemas/mg_robot_v2.schema.json';
import { normalizeOptionsSchema, validateSchema, resolveOptionsSchema } from './optionSchema';

/**
 * docs/sample/option_schemas/mg_robot_v2.schema.json は USER_GUIDE.md が例として示すスキーマであり、
 * ドキュメントと実装が乖離しないよう、正規化・検証・ref 解決のすべてを通ることをここで保証する。
 */
describe('docs/sample/option_schemas/mg_robot_v2.schema.json', () => {
  const schema = normalizeOptionsSchema(raw);

  it('has no validation errors', () => {
    expect(validateSchema(schema)).toEqual([]);
  });

  it('defines on_reached_actions as a list referencing the shared "action" definition via ref', () => {
    const opt = schema.options.find((o) => o.name === 'on_reached_actions');
    expect(opt?.type).toBe('list');
    expect(opt?.item).toEqual({ type: 'ref', ref: 'action' });
  });

  it('defines the "action" definition as a discriminated union with all 7 mg_robot action types', () => {
    const action = schema.definitions?.find((d) => d.name === 'action');
    expect(action?.type).toBe('union');
    expect(action?.discriminator).toBe('type');
    expect(action?.variants?.map((v) => v.value)).toEqual([
      'service',
      'publish',
      'load_map',
      'amcl_reset',
      'wait',
      'wait_trigger',
      'set_navigation_mode',
    ]);
  });

  it("marks the 'service' and 'publish' variants' essential fields as required, and gives them a map field for the free-form body", () => {
    const action = schema.definitions?.find((d) => d.name === 'action');
    const service = action?.variants?.find((v) => v.value === 'service');
    expect(service?.fields.find((f) => f.name === 'service')?.required).toBe(true);
    expect(service?.fields.find((f) => f.name === 'request')?.type).toBe('map');

    const publish = action?.variants?.find((v) => v.value === 'publish');
    expect(publish?.fields.find((f) => f.name === 'topic')?.required).toBe(true);
  });

  it('resolves the ref so on_reached_actions can be evaluated the same way as an inline union', () => {
    const resolved = resolveOptionsSchema(schema);
    const opt = resolved?.options.find((o) => o.name === 'on_reached_actions');
    expect(opt?.item?.type).toBe('union');
    expect(opt?.item?.variants?.map((v) => v.value)).toContain('wait');
  });

  it('gives through_tolerance a small/large preset choice, and the shared "action" type two full-action presets', () => {
    const throughTolerance = schema.options.find((o) => o.name === 'through_tolerance');
    expect(throughTolerance?.presets?.map((p) => p.name)).toEqual(['small', 'large']);

    const action = schema.definitions?.find((d) => d.name === 'action');
    expect(action?.presets?.map((p) => p.name)).toEqual(['front_lidar_on', 'front_lidar_off']);
    expect(action?.presets?.[0].value).toMatchObject({ type: 'service', request: { data: true } });
  });

  it('defines the three defaults-block fields as globals', () => {
    expect(schema.globals.map((g) => g.name)).toEqual([
      'default_is_through_point',
      'default_through_tolerance',
      'default_reach_tolerance',
    ]);
  });
});
