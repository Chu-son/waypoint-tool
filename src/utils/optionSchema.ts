import type {
  DefinitionDef,
  FieldDef,
  OptionDef,
  GlobalFieldDef,
  OptionsSchema,
  ScalarType,
  TypeSpec,
  ValueType,
} from '../types/options';
import { coerceValue, validateValue } from './optionValues';

const SCALAR_TYPES: ReadonlySet<ScalarType> = new Set(['string', 'float', 'integer', 'boolean']);
const VALUE_TYPES: ReadonlySet<ValueType> = new Set([...SCALAR_TYPES, 'list', 'object', 'map', 'union', 'any', 'ref']);

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

  if (type === 'ref') {
    spec.ref = typeof raw?.ref === 'string' ? raw.ref : '';
  }

  return spec;
}

/** 名前付きフィールド定義を正規化する（`normalizeTypeSpec` に name/label/description/default/required を加える）。 */
export function normalizeFieldDef(raw: any): FieldDef {
  const spec = normalizeTypeSpec(raw);
  const field: FieldDef = {
    ...spec,
    name: typeof raw?.name === 'string' ? raw.name : '',
    label: typeof raw?.label === 'string' ? raw.label : '',
  };
  if (typeof raw?.description === 'string' && raw.description) field.description = raw.description;
  if (raw?.default !== undefined) field.default = raw.default;
  if (raw?.required === true) field.required = true;
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

/** 名前付き型定義（`definitions` の1件）を正規化する。 */
export function normalizeDefinitionDef(raw: any): DefinitionDef {
  const spec = normalizeTypeSpec(raw);
  const def: DefinitionDef = { ...spec, name: typeof raw?.name === 'string' ? raw.name : '' };
  if (typeof raw?.label === 'string' && raw.label) def.label = raw.label;
  if (typeof raw?.description === 'string' && raw.description) def.description = raw.description;
  return def;
}

/**
 * Option Schema 全体を正規化する。プロジェクト読み込み・スキーマインポートの入口で必ず通す。
 * 既定値・global の値も、可能な限り型に合わせて変換する（例: 旧データの文字列 `"1.5"` を数値へ）。
 * ここでの変換は `ref` を解決した実効型に基づくため、`definitions` を含めた冪等な変換になる。
 */
export function normalizeOptionsSchema(raw: any): OptionsSchema {
  if (!raw || typeof raw !== 'object') return { options: [], globals: [], definitions: [] };
  const structural: OptionsSchema = {
    options: Array.isArray(raw.options) ? raw.options.map(normalizeOptionDef) : [],
    globals: Array.isArray(raw.globals) ? raw.globals.map(normalizeGlobalFieldDef) : [],
    definitions: Array.isArray(raw.definitions) ? raw.definitions.map(normalizeDefinitionDef) : [],
  };
  return coerceSchemaDefaultsAndValues(structural);
}

// ============================================================================
// ref 解決（definitions の展開）
// ============================================================================

/**
 * `type: 'ref'` を、対応する `definitions` の中身で再帰的に置き換えた型仕様を返す。
 * 未定義の参照・循環参照は（`validateSchema` が別途エラーとして報告する前提で）`{ type: 'any' }` にフォールバックする。
 */
export function resolveTypeSpec(
  spec: TypeSpec,
  definitionsByName: Map<string, DefinitionDef>,
  seen: ReadonlySet<string> = new Set(),
): TypeSpec {
  if (spec.type === 'ref') {
    const name = spec.ref;
    if (!name || !definitionsByName.has(name) || seen.has(name)) return { type: 'any' };
    const nextSeen = new Set(seen);
    nextSeen.add(name);
    return resolveTypeSpec(definitionsByName.get(name)!, definitionsByName, nextSeen);
  }
  switch (spec.type) {
    case 'list':
      return {
        type: 'list',
        item: spec.item ? resolveTypeSpec(spec.item, definitionsByName, seen) : { type: 'string' },
      };
    case 'object':
      return { type: 'object', fields: (spec.fields ?? []).map((f) => resolveFieldDef(f, definitionsByName, seen)) };
    case 'map':
      return {
        type: 'map',
        value_type: spec.value_type ? resolveTypeSpec(spec.value_type, definitionsByName, seen) : { type: 'any' },
      };
    case 'union':
      return {
        type: 'union',
        discriminator: spec.discriminator || 'type',
        variants: (spec.variants ?? []).map((v) => ({
          value: v.value,
          ...(v.label ? { label: v.label } : {}),
          fields: v.fields.map((f) => resolveFieldDef(f, definitionsByName, seen)),
        })),
      };
    case 'string':
      return spec.enum_values ? { type: 'string', enum_values: spec.enum_values } : { type: 'string' };
    default:
      return { type: spec.type };
  }
}

function resolveFieldDef(
  field: FieldDef,
  definitionsByName: Map<string, DefinitionDef>,
  seen: ReadonlySet<string>,
): FieldDef {
  const resolvedSpec = resolveTypeSpec(field, definitionsByName, seen);
  const resolved: FieldDef = { ...resolvedSpec, name: field.name, label: field.label };
  if (field.description !== undefined) resolved.description = field.description;
  if (field.default !== undefined) resolved.default = field.default;
  if (field.required) resolved.required = true;
  return resolved;
}

/**
 * スキーマ全体の `ref` を再帰的に展開する。出力には `type: 'ref'` が残らない
 * （未定義参照・循環参照は `{ type: 'any' }` にフォールバックする）ため、
 * 表示・値編集・条件付き書式・エクスポートなど、型を読むだけの箇所はこの展開後スキーマを使う。
 * 保存・スキーマ編集（`definitions` の追加/編集）は、`ref` を保ったままの生スキーマを使う。
 */
export function expandSchemaRefs(schema: OptionsSchema): OptionsSchema {
  const definitionsByName = new Map((schema.definitions ?? []).map((d) => [d.name, d]));
  return {
    options: schema.options.map((o) => resolveFieldDef(o, definitionsByName, new Set()) as OptionDef),
    globals: schema.globals.map((g) => {
      const resolved = resolveFieldDef(g, definitionsByName, new Set()) as GlobalFieldDef;
      return g.value !== undefined ? { ...resolved, value: g.value } : resolved;
    }),
    definitions: [],
  };
}

const resolvedSchemaCache = new WeakMap<OptionsSchema, OptionsSchema>();

/**
 * `expandSchemaRefs` の結果を、入力スキーマのオブジェクト同一性でメモ化して返す。
 * `definitions` が無ければ展開の必要が無いため、入力をそのまま返す（参照の安定性も保てる）。
 * 値の表示・編集・評価だけを行うコンポーネントは、`optionsSchema` を直接使わずこれを経由する。
 */
export function resolveOptionsSchema(schema: OptionsSchema | null): OptionsSchema | null {
  if (!schema) return null;
  if (!schema.definitions || schema.definitions.length === 0) return schema;
  let resolved = resolvedSchemaCache.get(schema);
  if (!resolved) {
    resolved = expandSchemaRefs(schema);
    resolvedSchemaCache.set(schema, resolved);
  }
  return resolved;
}

/**
 * `raw`（生の型仕様。`ref` を含みうる）の入れ子にある、各フィールドの `default` を
 * `resolved`（`raw` を ref 展開した実効型仕様。構造は `raw` と対応している）に基づいて型変換する。
 * `list.item` 自体には default が無いが、その先が `object`/`union` ならフィールドの default を持つため、
 * 型仕様のツリーとフィールドのツリーの両方を再帰的に辿る。
 */
function coerceSpecDefaultsDeep(raw: TypeSpec, resolved: TypeSpec): TypeSpec {
  switch (raw.type) {
    case 'list':
      return raw.item ? { ...raw, item: coerceSpecDefaultsDeep(raw.item, resolved.item ?? { type: 'string' }) } : raw;
    case 'object':
      return {
        ...raw,
        fields: (raw.fields ?? []).map((f, i) => coerceFieldDefaultsDeep(f, (resolved.fields ?? [])[i] ?? f)),
      };
    case 'map':
      return raw.value_type
        ? { ...raw, value_type: coerceSpecDefaultsDeep(raw.value_type, resolved.value_type ?? { type: 'any' }) }
        : raw;
    case 'union':
      return {
        ...raw,
        variants: (raw.variants ?? []).map((v, vi) => ({
          ...v,
          fields: v.fields.map((f, fi) => coerceFieldDefaultsDeep(f, (resolved.variants ?? [])[vi]?.fields[fi] ?? f)),
        })),
      };
    default:
      return raw;
  }
}

/** `coerceSpecDefaultsDeep` に加えて、フィールド自身の `default` も型変換する。 */
function coerceFieldDefaultsDeep(raw: FieldDef, resolved: FieldDef): FieldDef {
  const specFixed = coerceSpecDefaultsDeep(raw, resolved) as FieldDef;
  if (raw.default === undefined) return specFixed;
  return { ...specFixed, default: coerceValue(resolved, raw.default, undefined) };
}

/**
 * ref を解決した実効型に基づいて、`default`（options/globals/definitions 配下すべて）と
 * `value`（globals）を型へ変換する。旧データ（文字列のまま保存された既定値等）の修復を兼ねる。
 */
function coerceSchemaDefaultsAndValues(schema: OptionsSchema): OptionsSchema {
  const expanded = expandSchemaRefs(schema);
  const definitions = schema.definitions ?? [];
  const definitionsByName = new Map(definitions.map((d) => [d.name, d]));

  return {
    options: schema.options.map((o, i) => coerceFieldDefaultsDeep(o, expanded.options[i])) as OptionDef[],
    globals: schema.globals.map((g, i) => {
      const resolved = expanded.globals[i];
      const withDefault = coerceFieldDefaultsDeep(g, resolved);
      if (g.value === undefined) return withDefault;
      return { ...withDefault, value: coerceValue(resolved, g.value, undefined) };
    }) as GlobalFieldDef[],
    // definitions 自身は default を持たないが、object/union として入れ子に持つフィールドの
    // default は修復する（自己参照を含む循環は resolveTypeSpec 側で any にフォールバックする）。
    definitions: definitions.map((d) => {
      const resolved = resolveTypeSpec(d, definitionsByName);
      return { ...coerceSpecDefaultsDeep(d, resolved), name: d.name } as DefinitionDef;
    }),
  };
}

// ============================================================================
// 検証
// ============================================================================

export interface SchemaValidationError {
  /** エラー箇所を表すパス（例: `options[2].variants[0].fields`）。 */
  path: string;
  message: string;
}

function validateFieldList(
  fields: FieldDef[],
  path: string,
  definitionsByName: Map<string, DefinitionDef>,
  errors: SchemaValidationError[],
): void {
  const seen = new Map<string, number>();
  fields.forEach((f, i) => {
    const fieldPath = `${path}[${i}]`;
    if (!f.name || f.name.trim() === '') {
      errors.push({ path: fieldPath, message: 'キー名を空にすることはできません。' });
    } else {
      seen.set(f.name, (seen.get(f.name) ?? 0) + 1);
    }
    validateNestedShape(f, fieldPath, definitionsByName, errors);
    if (f.default !== undefined) {
      const resolved = resolveTypeSpec(f, definitionsByName);
      errors.push(...validateValue(resolved, f.default, `${fieldPath}.default`));
    }
  });
  seen.forEach((count, name) => {
    if (count > 1) errors.push({ path, message: `キー名が重複しています: ${name}` });
  });
}

function validateNestedShape(
  spec: TypeSpec,
  path: string,
  definitionsByName: Map<string, DefinitionDef>,
  errors: SchemaValidationError[],
  refChain: ReadonlySet<string> = new Set(),
): void {
  if (spec.type === 'ref') {
    if (!spec.ref || spec.ref.trim() === '') {
      errors.push({ path, message: '参照先の型名を指定してください。' });
    } else if (!definitionsByName.has(spec.ref)) {
      errors.push({ path, message: `未定義の型を参照しています: ${spec.ref}` });
    } else if (refChain.has(spec.ref)) {
      errors.push({ path, message: `循環参照しています: ${[...refChain, spec.ref].join(' → ')}` });
    } else {
      const nextChain = new Set(refChain);
      nextChain.add(spec.ref);
      validateNestedShape(
        definitionsByName.get(spec.ref)!,
        `${path}(ref:${spec.ref})`,
        definitionsByName,
        errors,
        nextChain,
      );
    }
  }
  if (spec.type === 'list' && spec.item) {
    validateNestedShape(spec.item, `${path}.item`, definitionsByName, errors, refChain);
  }
  if (spec.type === 'object') {
    validateFieldList(spec.fields ?? [], `${path}.fields`, definitionsByName, errors);
  }
  if (spec.type === 'map' && spec.value_type) {
    validateNestedShape(spec.value_type, `${path}.value_type`, definitionsByName, errors, refChain);
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
      validateFieldList(v.fields, `${variantPath}.fields`, definitionsByName, errors);
    });
    seenVariants.forEach((count, value) => {
      if (count > 1) errors.push({ path, message: `バリアントの値が重複しています: ${value}` });
    });
  }
}

function validateDefinitions(definitions: DefinitionDef[], errors: SchemaValidationError[]): void {
  const seen = new Map<string, number>();
  definitions.forEach((d, i) => {
    const path = `definitions[${i}]`;
    if (!d.name || d.name.trim() === '') {
      errors.push({ path, message: '型名を空にすることはできません。' });
    } else {
      seen.set(d.name, (seen.get(d.name) ?? 0) + 1);
    }
  });
  seen.forEach((count, name) => {
    if (count > 1) errors.push({ path: 'definitions', message: `型名が重複しています: ${name}` });
  });
}

/** スキーマ全体を再帰的に検証する。設定画面の Apply 時に呼び、エラーがあれば保存を止める。 */
export function validateSchema(schema: OptionsSchema): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  const definitions = schema.definitions ?? [];
  const definitionsByName = new Map(definitions.map((d) => [d.name, d]));

  validateDefinitions(definitions, errors);
  definitions.forEach((d, i) => validateNestedShape(d, `definitions[${i}]`, definitionsByName, errors));
  validateFieldList(schema.options, 'options', definitionsByName, errors);
  validateFieldList(schema.globals, 'globals', definitionsByName, errors);
  schema.globals.forEach((g, i) => {
    if (g.value === undefined) return;
    const resolved = resolveTypeSpec(g, definitionsByName);
    errors.push(...validateValue(resolved, g.value, `globals[${i}].value`));
  });
  return errors;
}

// ============================================================================
// パス列挙（条件付き書式のプロパティ選択等）
// ============================================================================

function collectPaths(spec: TypeSpec, prefix: string, out: string[]): void {
  out.push(prefix);
  if (spec.type === 'object') {
    (spec.fields ?? []).forEach((f) => collectPaths(f, `${prefix}.${f.name}`, out));
  }
}

/**
 * 条件付き書式のプロパティ選択などで使う、スキーマ上のアドレス可能なパス一覧を返す。
 * スカラーだけでなく list/union/map/any もそれ自体が評価対象になりうるため（例: `contains`, `is_empty`）、
 * 末端としてパスに含める。`object` だけは中のフィールドへ展開する。`ref` は解決してから辿る。
 */
export function listPropertyPaths(schema: OptionsSchema): string[] {
  const resolved = resolveOptionsSchema(schema) ?? schema;
  const out: string[] = [];
  resolved.options.forEach((opt) => collectPaths(opt, `options.${opt.name}`, out));
  return out;
}
