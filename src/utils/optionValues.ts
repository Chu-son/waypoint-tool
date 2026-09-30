import type { FieldDef, OptionValue, PresetDef, PresetRef, ScalarType, TypeSpec } from '../types/options';

export const isPlainObject = (v: unknown): v is Record<string, OptionValue> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** 値がプリセット参照（`{ $preset: name }`）の形をしているかどうかを判定する（構造だけを見る）。 */
export function isPresetRef(value: unknown): value is PresetRef {
  return isPlainObject(value) && typeof value.$preset === 'string';
}

/**
 * 値をプリセット参照として実際に解決してよいかを判定する。`isPresetRef` の構造チェックに加えて、
 * その型仕様が `presets` を1件以上持っていることを要求する。
 *
 * `$preset` は予約キーだが、`any` 型やプリセットの無い `object`/`map` の値は、たまたま `$preset` という
 * キーを持つ通常のデータでありうる（例: プラグインが生成した任意の JSON）。`presets` が定義されていない型で
 * この区別を省くと、そうした値が「未定義のプリセットへの参照」として誤って扱われ、解決結果が `undefined` に
 * なって値が消えたり、Inspector が何も表示しなくなったりする。呼び出し側は必ずこちらを使うこと。
 */
export function isActivePresetRef(spec: TypeSpec, value: unknown): value is PresetRef {
  return (spec.presets?.length ?? 0) > 0 && isPresetRef(value);
}

/** 型仕様が持つプリセットの中から、名前が一致するものを探す。 */
export function findPresetByName(spec: TypeSpec, name: string): PresetDef | undefined {
  return (spec.presets ?? []).find((p) => p.name === name);
}

/** 値が、型仕様が持ついずれかのプリセットと完全に一致するかを調べる（一致すれば、そのプリセットを返す）。 */
export function findMatchingPreset(spec: TypeSpec, value: OptionValue | undefined): PresetDef | undefined {
  if (value === undefined || isPresetRef(value)) return undefined;
  return (spec.presets ?? []).find((p) => deepEqual(p.value, value));
}

/** union 値から判別キーの値を取り出す。 */
function getVariantValue(spec: TypeSpec, value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined;
  const discriminator = spec.discriminator || 'type';
  const v = value[discriminator];
  return typeof v === 'string' ? v : undefined;
}

function findVariant(spec: TypeSpec, variantValue: string | undefined) {
  return (spec.variants ?? []).find((v) => v.value === variantValue);
}

/**
 * カンマ区切りのテキストを、指定したスカラー型の配列へ変換する。空要素は無視し、
 * 数値/真偽値へ変換できない要素は除外する。list<scalar> の「カンマ区切りで貼り付け」入力で使う。
 */
export function parseCsvList(text: string, itemType: ScalarType): OptionValue[] {
  const raw = text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (itemType === 'float') return raw.map((s) => parseFloat(s)).filter((n) => !isNaN(n));
  if (itemType === 'integer') return raw.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
  if (itemType === 'boolean') return raw.map((s) => s === 'true' || s === '1');
  return raw;
}

/**
 * 入力値を型仕様に従って変換する（インポートやフォーム入力の型変換に使う）。
 * 変換できない場合は `fallback` を返す。list/object/map/union は再帰的に変換する。
 */
export function coerceValue(spec: TypeSpec, raw: any, fallback?: OptionValue): OptionValue | undefined {
  // プリセット参照は、参照先の型に関わらずそのまま素通しする（実際の値への変換は表示・エクスポート時に行う）。
  // ただしこの型に `presets` が無ければ、`$preset` キーを持つだけの通常の値として扱う（isActivePresetRef 参照）。
  if (isActivePresetRef(spec, raw)) return raw;
  switch (spec.type) {
    case 'integer': {
      const n = parseInt(raw, 10);
      return Number.isNaN(n) ? fallback : n;
    }
    case 'float': {
      const n = parseFloat(raw);
      return Number.isNaN(n) ? fallback : n;
    }
    case 'boolean':
      return typeof raw === 'boolean' ? raw : String(raw).toLowerCase() === 'true';
    case 'list': {
      const arr = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
      const itemSpec: TypeSpec = spec.item ?? { type: 'string' };
      // 個々の要素の変換結果は基本的に fallback (元の値) が効くため undefined にはならない。
      return arr.map((v) => coerceValue(itemSpec, v, v)) as OptionValue[];
    }
    case 'object': {
      const obj = isPlainObject(raw) ? raw : {};
      const result: Record<string, OptionValue> = {};
      (spec.fields ?? []).forEach((f) => {
        if (obj[f.name] !== undefined) result[f.name] = coerceValue(f, obj[f.name], f.default) as OptionValue;
      });
      return result;
    }
    case 'map': {
      const obj = isPlainObject(raw) ? raw : {};
      const valueSpec: TypeSpec = spec.value_type ?? { type: 'any' };
      const result: Record<string, OptionValue> = {};
      Object.keys(obj).forEach((k) => {
        result[k] = coerceValue(valueSpec, obj[k], obj[k]) as OptionValue;
      });
      return result;
    }
    case 'union': {
      if (!isPlainObject(raw)) return fallback;
      const discriminator = spec.discriminator || 'type';
      const variantValue = getVariantValue(spec, raw);
      const variant = findVariant(spec, variantValue);
      if (!variant) return { ...raw }; // 未知のバリアントはそのまま素通しする
      const result: Record<string, OptionValue> = { [discriminator]: variantValue as string };
      variant.fields.forEach((f) => {
        if (raw[f.name] !== undefined) result[f.name] = coerceValue(f, raw[f.name], f.default) as OptionValue;
      });
      return result;
    }
    case 'any':
      return raw;
    default: // string
      return raw;
  }
}

/** 未入力（`undefined` / 空文字 / 空配列）は「未設定」として保存しない。 */
export function toStoredValue(spec: TypeSpec, raw: unknown): OptionValue | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (Array.isArray(raw) && raw.length === 0) return undefined;
  return coerceValue(spec, raw);
}

export interface ValueValidationError {
  path: string;
  message: string;
}

/** 値が型仕様に合っているかを再帰的に検証する。未入力（`undefined` / 空文字）は常に有効。 */
export function validateValue(spec: TypeSpec, value: unknown, path = ''): ValueValidationError[] {
  if (value === undefined || value === '') return [];

  if (isActivePresetRef(spec, value)) {
    return findPresetByName(spec, value.$preset) ? [] : [{ path, message: `未定義のプリセットです: ${value.$preset}` }];
  }
  if (spec.preset_only) {
    return [{ path, message: 'プリセットから選択してください。' }];
  }

  switch (spec.type) {
    case 'integer':
      return isNaN(Number(value)) || !Number.isInteger(Number(value))
        ? [{ path, message: '整数を入力してください。' }]
        : [];
    case 'float':
      return isNaN(Number(value)) ? [{ path, message: '数値を入力してください。' }] : [];
    case 'boolean': {
      const str = String(value).toLowerCase();
      return str === 'true' || str === 'false' ? [] : [{ path, message: 'true/false を入力してください。' }];
    }
    case 'string': {
      if (spec.enum_values && spec.enum_values.length > 0 && !spec.enum_values.includes(String(value))) {
        return [{ path, message: `次のいずれかを指定してください: ${spec.enum_values.join(', ')}` }];
      }
      return [];
    }
    case 'list': {
      if (!Array.isArray(value)) return [{ path, message: 'リストを入力してください。' }];
      const itemSpec: TypeSpec = spec.item ?? { type: 'string' };
      return value.flatMap((v, i) => validateValue(itemSpec, v, `${path}[${i}]`));
    }
    case 'object': {
      if (!isPlainObject(value)) return [{ path, message: 'オブジェクトを入力してください。' }];
      return (spec.fields ?? []).flatMap((f) => validateField(f, value[f.name], `${path}.${f.name}`));
    }
    case 'map': {
      if (!isPlainObject(value)) return [{ path, message: 'オブジェクトを入力してください。' }];
      const valueSpec: TypeSpec = spec.value_type ?? { type: 'any' };
      return Object.keys(value).flatMap((k) => validateValue(valueSpec, value[k], `${path}.${k}`));
    }
    case 'union': {
      if (!isPlainObject(value)) return [{ path, message: 'オブジェクトを入力してください。' }];
      const variantValue = getVariantValue(spec, value);
      const variant = findVariant(spec, variantValue);
      if (!variant) return [{ path, message: `未知のバリアントです: ${String(variantValue)}` }];
      return variant.fields.flatMap((f) => validateField(f, value[f.name], `${path}.${f.name}`));
    }
    default:
      return [];
  }
}

/** `validateValue` のエラー有無だけを見る簡易版（フォームの枠線ハイライト等に使う）。 */
export function isValueValid(spec: TypeSpec, value: unknown): boolean {
  return validateValue(spec, value).length === 0;
}

/**
 * フィールド単位の検証。型の妥当性（`validateValue`）に加えて、`required` なフィールドが
 * 値・既定値のどちらも持たない場合をエラーにする。Inspector の必須マーク表示や、
 * エクスポート前チェックで使う。
 */
export function validateField(field: FieldDef, value: OptionValue | undefined, path = ''): ValueValidationError[] {
  if (field.required && value === undefined && field.default === undefined) {
    return [{ path, message: `${field.label || field.name} は必須です。` }];
  }
  return validateValue(field, value, path);
}

/**
 * プリセット参照（`{ $preset: name }`）を、対応する `TypeSpec.presets` の値に再帰的に置き換える。
 * 参照自体だけでなく、値の中に入れ子で現れる参照（list の要素、object/union のフィールド、map の値）も解決する。
 * 未定義の参照は `undefined` にする（`validateValue` が別途エラーとして報告する前提）。
 */
export function resolvePresets(spec: TypeSpec, value: OptionValue | undefined): OptionValue | undefined {
  if (value === undefined) return undefined;
  let resolved: OptionValue | undefined = value;
  if (isActivePresetRef(spec, value)) {
    resolved = findPresetByName(spec, value.$preset)?.value;
    if (resolved === undefined) return undefined;
  }
  if (spec.type === 'list' && Array.isArray(resolved) && spec.item) {
    const itemSpec = spec.item;
    return resolved.map((v) => resolvePresets(itemSpec, v) as OptionValue);
  }
  if (spec.type === 'object' && isPlainObject(resolved)) {
    const result: Record<string, OptionValue> = { ...resolved };
    (spec.fields ?? []).forEach((f) => {
      if (result[f.name] !== undefined) result[f.name] = resolvePresets(f, result[f.name]) as OptionValue;
    });
    return result;
  }
  if (spec.type === 'map' && isPlainObject(resolved)) {
    const valueSpec = spec.value_type ?? { type: 'any' };
    const result: Record<string, OptionValue> = {};
    Object.keys(resolved).forEach((k) => {
      result[k] = resolvePresets(valueSpec, resolved[k]) as OptionValue;
    });
    return result;
  }
  if (spec.type === 'union' && isPlainObject(resolved)) {
    const variant = findVariant(spec, getVariantValue(spec, resolved));
    if (variant) {
      const result: Record<string, OptionValue> = { ...resolved };
      variant.fields.forEach((f) => {
        if (result[f.name] !== undefined) result[f.name] = resolvePresets(f, result[f.name]) as OptionValue;
      });
      return result;
    }
  }
  return resolved;
}

/**
 * 明示的に入力された値（`value`）に、プリセット参照の解決とスキーマの既定値を再帰的に適用して実効値を返す。
 * `value` が `undefined` ならフィールドの `default`（これもプリセット参照でありうる）を解決して返す。
 */
export function resolveWithDefaults(field: FieldDef, value: OptionValue | undefined): OptionValue | undefined {
  if (value === undefined) {
    return field.default === undefined ? undefined : resolvePresets(field, field.default);
  }
  const withoutPresetRefs = resolvePresets(field, value);
  return withoutPresetRefs === undefined ? undefined : resolveNestedDefaults(field, withoutPresetRefs);
}

/**
 * プリセット参照を解決済みの値に、入れ子の object/union フィールドが持つ既定値を補う。
 * list はどの深さの要素型にも、map はどんな値型にも再帰する（プリセットや既定値がどの深さにもありうるため）。
 */
function resolveNestedDefaults(spec: TypeSpec, value: OptionValue): OptionValue {
  if (spec.type === 'list' && Array.isArray(value) && spec.item) {
    const itemSpec = spec.item;
    return value.map((v) => resolveNestedDefaults(itemSpec, v));
  }
  if (spec.type === 'map' && isPlainObject(value)) {
    const valueSpec = spec.value_type ?? { type: 'any' };
    const result: Record<string, OptionValue> = {};
    Object.keys(value).forEach((k) => {
      result[k] = resolveNestedDefaults(valueSpec, value[k]);
    });
    return result;
  }
  if (spec.type === 'object' && isPlainObject(value)) {
    const result: Record<string, OptionValue> = { ...value };
    (spec.fields ?? []).forEach((f) => {
      const resolved = resolveWithDefaults(f, value[f.name]);
      if (resolved !== undefined) result[f.name] = resolved;
    });
    return result;
  }
  if (spec.type === 'union' && isPlainObject(value)) {
    const variant = findVariant(spec, getVariantValue(spec, value));
    if (!variant) return value;
    const result: Record<string, OptionValue> = { ...value };
    variant.fields.forEach((f) => {
      const resolved = resolveWithDefaults(f, value[f.name]);
      if (resolved !== undefined) result[f.name] = resolved;
    });
    return result;
  }
  return value;
}

/** union の判別キーだけを持つ、まっさらな値を作る（フィールドは未設定のまま）。 */
export function createUnionVariantValue(spec: TypeSpec, variantValue: string): OptionValue {
  const discriminator = spec.discriminator || 'type';
  return { [discriminator]: variantValue };
}

/**
 * 型仕様に応じた、値未設定な状態からの初期値を作る（list への新規アイテム追加等に使う）。
 * `preset_only` な型は自由な値を持てないため、先頭のプリセットへの参照を初期値にする。
 */
export function createValue(spec: TypeSpec): OptionValue {
  if (spec.preset_only && spec.presets && spec.presets.length > 0) {
    return { $preset: spec.presets[0].name };
  }
  switch (spec.type) {
    case 'string':
      return '';
    case 'float':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'list':
    case 'object':
    case 'map':
      return spec.type === 'list' ? [] : {};
    case 'union':
      return createUnionVariantValue(spec, (spec.variants ?? [])[0]?.value ?? '');
    default: // any
      return null;
  }
}

/**
 * 同名のフィールドは値を引き継ぎ、新しいバリアントに存在しないフィールドは捨てて、
 * union 値のバリアントを切り替える。
 */
export function switchUnionVariant(spec: TypeSpec, value: OptionValue, newVariantValue: string): OptionValue {
  const discriminator = spec.discriminator || 'type';
  const newVariant = findVariant(spec, newVariantValue);
  const oldObj = isPlainObject(value) ? value : {};
  const allowedNames = new Set((newVariant?.fields ?? []).map((f) => f.name));
  const result: Record<string, OptionValue> = { [discriminator]: newVariantValue };
  Object.keys(oldObj).forEach((k) => {
    if (k !== discriminator && allowedNames.has(k)) result[k] = oldObj[k];
  });
  return result;
}

/** キャンバスのラベル表示用に、値を短い文字列へ要約する。 */
export function summarizeValue(spec: TypeSpec, value: OptionValue | undefined): string {
  if (value === undefined || value === null) return '';
  if (isActivePresetRef(spec, value)) {
    const preset = findPresetByName(spec, value.$preset);
    return preset ? (preset.label ?? preset.name) : `[未定義のプリセット: ${value.$preset}]`;
  }
  switch (spec.type) {
    case 'list': {
      if (!Array.isArray(value)) return '';
      const itemSpec = spec.item;
      return `[${value.map((v) => (itemSpec ? summarizeValue(itemSpec, v) : String(v))).join(', ')}]`;
    }
    case 'union': {
      const variantValue = getVariantValue(spec, value);
      return variantValue ?? '{...}';
    }
    case 'object':
      return '{...}';
    case 'map':
      return isPlainObject(value) ? `{${Object.keys(value).length} keys}` : '{...}';
    case 'any':
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    default:
      return String(value);
  }
}

/** 配列・オブジェクトも含めた再帰的な値の等価比較。オプション値の差分検出に使う。 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}
