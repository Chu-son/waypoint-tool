/** JSON として直接扱えるスカラー型。 */
export type ScalarType = 'string' | 'float' | 'integer' | 'boolean';

/**
 * フィールドが取りうる値の種別。
 * `list` / `object` / `map` / `union` は、それぞれの中に任意の型を再帰的に入れ子にできる。
 * `ref` は `OptionsSchema.definitions` で定義した名前付きの型を参照する（JSON Schema の `$ref` 相当）。
 */
export type ValueType = ScalarType | 'list' | 'object' | 'map' | 'union' | 'any' | 'ref';

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
  /** `ref`: 参照先の `OptionsSchema.definitions[].name`。 */
  ref?: string;
  /**
   * 名前付きの値の候補（プリセット）。`ref` 自身には持たせず、参照先の `definitions` 側に集約する
   * （同じ型を使う全箇所で共有するため）。値には `PresetRef`（`{ $preset: name }`）で参照する。
   */
  presets?: PresetDef[];
  /** true の場合、この型の値は `presets` から選ぶことしかできず、自由な値の入力を許さない。 */
  preset_only?: boolean;
}

/**
 * `TypeSpec.presets` の1件。名前で参照される、名前付きの値。
 * 値を変更すると、その名前を参照している全箇所に反映される（サービス呼び出しの定型パターンや、
 * tolerance の「小/大」のような、運用上の選択肢を表現する）。
 */
export interface PresetDef {
  name: string;
  label?: string;
  description?: string;
  value: OptionValue;
}

/**
 * プリセットへの参照値。`$preset` は予約キーであり、`presets` を持つ型の値としてのみ解釈される。
 * それ以外の型（`any` や、プリセットの無い `map` の値など）では通常のオブジェクトとして扱われる。
 */
export interface PresetRef {
  [key: string]: OptionValue;
  $preset: string;
}

/** 名前とラベルを持つ、名前付きフィールド定義。 */
export interface FieldDef extends TypeSpec {
  name: string;
  label: string;
  description?: string;
  default?: OptionValue;
  /**
   * 既定値をグローバル変数（`OptionsSchema.globals[].name`）に連動させる。指定した場合、`default` は
   * そのグローバルの現在値から導出される（`applyGlobalDefaultLinks`）ため、手入力の既定値とは併用しない。
   * グローバル自身には指定できない。
   */
  default_global?: string;
  /** true の場合、値も既定値も未設定だと Inspector とエクスポート前チェックで警告する。 */
  required?: boolean;
}

/**
 * `OptionsSchema.definitions` の1件。複数のフィールドから `{ type: 'ref', ref: name }` で
 * 参照でき、同じ構造（例: mg_robot の「到達時アクション」union）を複数箇所で使い回せる。
 */
export interface DefinitionDef extends TypeSpec {
  name: string;
  label?: string;
  description?: string;
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
  /**
   * 名前付き型定義（`ref` から参照される）。省略可能（正規化後は常に配列で埋まる）にして、
   * 既存のテスト・フィクスチャで `{ options, globals }` だけを書けるようにしている。
   */
  definitions?: DefinitionDef[];
};

/**
 * `undefined` を許すのは、値変換に失敗した場合などに「キーは存在するが値を決定できない」状態を
 * 型上表現するため。実際に保存されるプロジェクトデータでは、そのようなキーは省略されるのが基本。
 */
export type WaypointOptions = Record<string, OptionValue | undefined>;
