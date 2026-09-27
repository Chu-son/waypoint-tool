/** JSON として直接扱えるスカラー型。 */
export type ScalarType = 'string' | 'float' | 'integer' | 'boolean';

/**
 * フィールドが取りうる値の種別。
 * `list` / `object` / `map` / `union` は、それぞれの中に任意の型を再帰的に入れ子にできる。
 */
export type ValueType = ScalarType | 'list' | 'object' | 'map' | 'union' | 'any';

/**
 * 値の型仕様。JSON Schema のサブセットと 1:1 対応するように設計しており、
 * 相互変換や外部ツールとの連携を将来的に見込める。
 */
export interface TypeSpec {
  type: ValueType;
  /** `string` 型の選択肢（プルダウン）。list の要素が string の場合は item 側に持たせる。 */
  enum_values?: string[];
  /** `list`: 要素の型仕様。省略時は `{ type: 'string' }` として扱う。 */
  item?: TypeSpec;
  /** `object`: 固定フィールドの一覧。 */
  fields?: FieldDef[];
  /** `map`: 値の型仕様。省略時は `{ type: 'any' }`（自由な JSON 値）として扱う。 */
  value_type?: TypeSpec;
  /** `union`: 判別キー名。省略時は `'type'`。 */
  discriminator?: string;
  /** `union`: 判別値ごとのフィールド定義。 */
  variants?: VariantDef[];
}

/** 名前とラベルを持つ、名前付きフィールド定義。 */
export interface FieldDef extends TypeSpec {
  name: string;
  label: string;
  description?: string;
  default?: OptionValue;
}

/** `union` の1バリアント（判別値ごとのフィールド集合）。 */
export interface VariantDef {
  value: string;
  label?: string;
  fields: FieldDef[];
}

/** スキーマに従って保存される値。object/map/union は JSON オブジェクト、list は配列で表現する。 */
export type OptionValue = string | number | boolean | null | OptionValue[] | { [key: string]: OptionValue };

export type OptionDef = FieldDef & {
  interaction_hint?: {
    type: 'start_corner' | 'sweep_direction';
    target_input: string;
  };
};

/** プロジェクト全体で1つの値を持つ変数。ウェイポイントには付随せず、エクスポートテンプレートから参照する。 */
export type GlobalFieldDef = FieldDef & {
  value?: OptionValue;
};

export type OptionsSchema = {
  options: OptionDef[];
  globals: GlobalFieldDef[];
};

/**
 * `undefined` を許すのは、値変換に失敗した場合などに「キーは存在するが値を決定できない」状態を
 * 型上表現するため。実際に保存されるプロジェクトデータでは、そのようなキーは省略されるのが基本。
 */
export type WaypointOptions = Record<string, OptionValue | undefined>;
