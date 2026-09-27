import { describe, it, expect } from 'vitest';
import raw from '../../docs/sample/option_schemas/mg_robot_v2.schema.json';
import { normalizeOptionsSchema, validateSchema } from './optionSchema';

/**
 * docs/sample/option_schemas/mg_robot_v2.schema.json は USER_GUIDE.md が例として示すスキーマであり、
 * ドキュメントと実装が乖離しないよう、正規化・検証の両方を通ることをここで保証する。
 */
describe('docs/sample/option_schemas/mg_robot_v2.schema.json', () => {
  const schema = normalizeOptionsSchema(raw);

  it('has no validation errors', () => {
    expect(validateSchema(schema)).toEqual([]);
  });

  it('defines on_reached_actions as a list of a discriminated union with all 7 mg_robot action types', () => {
    const opt = schema.options.find((o) => o.name === 'on_reached_actions');
    expect(opt?.type).toBe('list');
    expect(opt?.item?.type).toBe('union');
    expect(opt?.item?.discriminator).toBe('type');
    expect(opt?.item?.variants?.map((v) => v.value)).toEqual([
      'service',
      'publish',
      'load_map',
      'amcl_reset',
      'wait',
      'wait_trigger',
      'set_navigation_mode',
    ]);
  });

  it("gives the 'service' variant a map field for the free-form request body", () => {
    const opt = schema.options.find((o) => o.name === 'on_reached_actions');
    const service = opt?.item?.variants?.find((v) => v.value === 'service');
    expect(service?.fields.find((f) => f.name === 'request')?.type).toBe('map');
  });

  it('defines the three defaults-block fields as globals', () => {
    expect(schema.globals.map((g) => g.name)).toEqual([
      'default_is_through_point',
      'default_through_tolerance',
      'default_reach_tolerance',
    ]);
  });
});
