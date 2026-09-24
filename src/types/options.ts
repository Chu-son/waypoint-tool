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

export type OptionsSchema = {
  options: OptionDef[];
};

export type WaypointOptions = Record<string, string | number | boolean | Array<string | number | boolean>>;
