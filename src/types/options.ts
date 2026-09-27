export type OptionDef = {
  name: string;
  label: string;
  type: string;
  item_type?: string;
  default?: any;
  enum_values?: string[];
  interaction_hint?: {
    type: 'start_corner' | 'sweep_direction';
    target_input: string;
  };
};

export type OptionValue = string | number | boolean | Array<string | number | boolean>;

/** プロジェクト全体で1つの値を持つ変数。ウェイポイントには付随せず、エクスポートテンプレートから参照する。 */
export type GlobalFieldDef = {
  name: string;
  label: string;
  type: string;
  item_type?: string;
  enum_values?: string[];
  value?: OptionValue;
};

export type OptionsSchema = {
  options: OptionDef[];
  globals: GlobalFieldDef[];
};

export type WaypointOptions = Record<string, OptionValue>;
