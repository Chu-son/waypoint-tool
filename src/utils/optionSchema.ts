import type {
  FieldDef,
  OptionDef,
  GlobalFieldDef,
  OptionsSchema,
  ScalarType,
  TypeSpec,
  ValueType,
} from '../types/options';

const SCALAR_TYPES: ReadonlySet<ScalarType> = new Set(['string', 'float', 'integer', 'boolean']);
const VALUE_TYPES: ReadonlySet<ValueType> = new Set([...SCALAR_TYPES, 'list', 'object', 'map', 'union', 'any']);

const isScalarType = (v: unknown): v is ScalarType => typeof v === 'string' && SCALAR_TYPES.has(v as ScalarType);
const isValueType = (v: unknown): v is ValueType => typeof v === 'string' && VALUE_TYPES.has(v as ValueType);

/**
 * 型仕様を正規化する。旧形式（`type: list` に `item_type` を直接持つフラットな形）を
 * 現行の再帰形（`item: { type }`）へ変換し、未知フィールドを除去する。
 * 既に正規化済みの値を渡しても結果は変わらない（冪等）。
 */
export function normalizeTypeSpec(raw: any): TypeSpec {
  const type: ValueType = isValueType(raw?.type) ? raw.type : 'string';
  const spec: TypeSpec = { type };

  if (type === 'string' && Array.isArray(raw?.enum_values)) {
    spec.enum_values = raw.enum_values.filter((v: unknown): v is string => typeof v === 'string');
  }

  if (type === 'list') {
    if (raw?.item && typeof raw.item === 'object') {
      spec.item = normalizeTypeSpec(raw.item);
    } else {
      // 旧形式: item_type (+ その要素向けの enum_values) を item に畳み込む。
      const legacyItemType: ScalarType = isScalarType(raw?.item_type) ? raw.item_type : 'string';
      spec.item = { type: legacyItemType };
      if (legacyItemType === 'string' && Array.isArray(raw?.enum_values)) {
        spec.item.enum_values = raw.enum_values.filter((v: unknown): v is string => typeof v === 'string');
      }
    }
  }

  if (type === 'object') {
    spec.fields = Array.isArray(raw?.fields) ? raw.fields.map(normalizeFieldDef) : [];
  }

  if (type === 'map') {
    spec.value_type =
      raw?.value_type && typeof raw.value_type === 'object' ? normalizeTypeSpec(raw.value_type) : { type: 'any' };
  }

  if (type === 'union') {
    spec.discriminator = typeof raw?.discriminator === 'string' && raw.discriminator ? raw.discriminator : 'type';
    spec.variants = Array.isArray(raw?.variants)
      ? raw.variants.map((v: any) => ({
          value: typeof v?.value === 'string' ? v.value : '',
          ...(typeof v?.label === 'string' && v.label ? { label: v.label } : {}),
          fields: Array.isArray(v?.fields) ? v.fields.map(normalizeFieldDef) : [],
        }))
      : [];
  }

  return spec;
}

/** 名前付きフィールド定義を正規化する（`normalizeTypeSpec` に name/label/description/default を加える）。 */
export function normalizeFieldDef(raw: any): FieldDef {
  const spec = normalizeTypeSpec(raw);
  const field: FieldDef = {
    ...spec,
    name: typeof raw?.name === 'string' ? raw.name : '',
    label: typeof raw?.label === 'string' ? raw.label : '',
  };
  if (typeof raw?.description === 'string' && raw.description) field.description = raw.description;
  if (raw?.default !== undefined) field.default = raw.default;
  return field;
}

export function normalizeOptionDef(raw: any): OptionDef {
  const field = normalizeFieldDef(raw);
  const hint = raw?.interaction_hint;
  const interaction_hint =
    hint && typeof hint === 'object' && typeof hint.target_input === 'string'
      ? {
          type: hint.type === 'sweep_direction' ? ('sweep_direction' as const) : ('start_corner' as const),
          target_input: hint.target_input,
        }
      : undefined;
  return interaction_hint ? { ...field, interaction_hint } : field;
}

export function normalizeGlobalFieldDef(raw: any): GlobalFieldDef {
  const field = normalizeFieldDef(raw);
  return raw?.value !== undefined ? { ...field, value: raw.value } : field;
}

/** Option Schema 全体を正規化する。プロジェクト読み込み・スキーマインポートの入口で必ず通す。 */
export function normalizeOptionsSchema(raw: any): OptionsSchema {
  if (!raw || typeof raw !== 'object') return { options: [], globals: [] };
  return {
    options: Array.isArray(raw.options) ? raw.options.map(normalizeOptionDef) : [],
    globals: Array.isArray(raw.globals) ? raw.globals.map(normalizeGlobalFieldDef) : [],
  };
}

export interface SchemaValidationError {
  /** エラー箇所を表すパス（例: `options[2].variants[0].fields`）。 */
  path: string;
  message: string;
}

function validateFieldList(fields: FieldDef[], path: string, errors: SchemaValidationError[]): void {
  const seen = new Map<string, number>();
  fields.forEach((f, i) => {
    const fieldPath = `${path}[${i}]`;
    if (!f.name || f.name.trim() === '') {
      errors.push({ path: fieldPath, message: 'キー名を空にすることはできません。' });
    } else {
      seen.set(f.name, (seen.get(f.name) ?? 0) + 1);
    }
    validateNestedShape(f, fieldPath, errors);
  });
  seen.forEach((count, name) => {
    if (count > 1) errors.push({ path, message: `キー名が重複しています: ${name}` });
  });
}

function validateNestedShape(spec: TypeSpec, path: string, errors: SchemaValidationError[]): void {
  if (spec.type === 'list' && spec.item) {
    validateNestedShape(spec.item, `${path}.item`, errors);
  }
  if (spec.type === 'object') {
    validateFieldList(spec.fields ?? [], `${path}.fields`, errors);
  }
  if (spec.type === 'map' && spec.value_type) {
    validateNestedShape(spec.value_type, `${path}.value_type`, errors);
  }
  if (spec.type === 'union') {
    const discriminator = spec.discriminator || 'type';
    const seenVariants = new Map<string, number>();
    (spec.variants ?? []).forEach((v, i) => {
      const variantPath = `${path}.variants[${i}]`;
      if (!v.value || v.value.trim() === '') {
        errors.push({ path: variantPath, message: 'バリアントの値を空にすることはできません。' });
      } else {
        seenVariants.set(v.value, (seenVariants.get(v.value) ?? 0) + 1);
      }
      if (v.fields.some((f) => f.name === discriminator)) {
        errors.push({
          path: variantPath,
          message: `フィールド名を判別キー "${discriminator}" と同じにすることはできません。`,
        });
      }
      validateFieldList(v.fields, `${variantPath}.fields`, errors);
    });
    seenVariants.forEach((count, value) => {
      if (count > 1) errors.push({ path, message: `バリアントの値が重複しています: ${value}` });
    });
  }
}

/** スキーマ全体を再帰的に検証する。設定画面の Apply 時に呼び、エラーがあれば保存を止める。 */
export function validateSchema(schema: OptionsSchema): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  validateFieldList(schema.options, 'options', errors);
  validateFieldList(schema.globals, 'globals', errors);
  return errors;
}

function collectPaths(spec: TypeSpec, prefix: string, out: string[]): void {
  out.push(prefix);
  if (spec.type === 'object') {
    (spec.fields ?? []).forEach((f) => collectPaths(f, `${prefix}.${f.name}`, out));
  }
}

/**
 * 条件付き書式のプロパティ選択などで使う、スキーマ上のアドレス可能なパス一覧を返す。
 * スカラーだけでなく list/union/map/any もそれ自体が評価対象になりうるため（例: `contains`, `is_empty`）、
 * 末端としてパスに含める。`object` だけは中のフィールドへ展開する。
 */
export function listScalarPaths(schema: OptionsSchema): string[] {
  const out: string[] = [];
  schema.options.forEach((opt) => collectPaths(opt, `options.${opt.name}`, out));
  return out;
}
