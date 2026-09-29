/**
 * プリセット参照（`{ $preset: name }`）の使用状況を数えたり、既存の値をプリセット参照へ
 * 一括置換したりするための、スキーマと値を並行して辿るユーティリティ。
 *
 * スキーマ側の「位置」は `scope` 文字列で表す（例: `options.tolerance`, `definitions.action`）。
 * `ref` はそれ自体にプリセットを持たない設計（`TypeSpec.presets` のコメント参照）なので、
 * `ref` に行き当たったら参照先の definitions のスコープへ折りたたむ。こうすることで、
 * 同じ定義を複数箇所から `ref` している場合でも、プリセットの使用件数・置換は1つのスコープに集約される。
 */
import type { DefinitionDef, OptionsSchema, OptionValue, PresetDef, TypeSpec } from '../types/options';
import { deepEqual, findPresetByName, isActivePresetRef, isPlainObject } from './optionValues';

type OptionValues = Record<string, OptionValue | undefined>;

function definitionsMap(schema: OptionsSchema): Map<string, DefinitionDef> {
  return new Map((schema.definitions ?? []).map((d) => [d.name, d]));
}

/** `scope` ごと・プリセット名ごとの使用件数。 */
export type PresetUsageCounts = Map<string, Map<string, number>>;

function bumpUsage(counts: PresetUsageCounts, scope: string, name: string): void {
  const forScope = counts.get(scope) ?? new Map<string, number>();
  forScope.set(name, (forScope.get(name) ?? 0) + 1);
  counts.set(scope, forScope);
}

function visitForUsage(
  spec: TypeSpec,
  value: OptionValue | undefined,
  scope: string,
  definitionsByName: Map<string, DefinitionDef>,
  counts: PresetUsageCounts,
): void {
  if (value === undefined) return;
  if (spec.type === 'ref') {
    const def = spec.ref ? definitionsByName.get(spec.ref) : undefined;
    if (def) visitForUsage(def, value, `definitions.${spec.ref}`, definitionsByName, counts);
    return;
  }
  if (isActivePresetRef(spec, value)) {
    bumpUsage(counts, scope, value.$preset);
    return;
  }
  if (spec.type === 'list' && Array.isArray(value) && spec.item) {
    value.forEach((v) => visitForUsage(spec.item!, v, `${scope}.item`, definitionsByName, counts));
  } else if (spec.type === 'object' && isPlainObject(value)) {
    (spec.fields ?? []).forEach((f) =>
      visitForUsage(f, value[f.name], `${scope}.fields.${f.name}`, definitionsByName, counts),
    );
  } else if (spec.type === 'map' && isPlainObject(value)) {
    const valueSpec = spec.value_type ?? { type: 'any' };
    Object.keys(value).forEach((k) =>
      visitForUsage(valueSpec, value[k], `${scope}.value_type`, definitionsByName, counts),
    );
  } else if (spec.type === 'union' && isPlainObject(value)) {
    const discriminator = spec.discriminator || 'type';
    const variantValue = value[discriminator];
    const variant = (spec.variants ?? []).find((v) => v.value === variantValue);
    (variant?.fields ?? []).forEach((f) =>
      visitForUsage(
        f,
        value[f.name],
        `${scope}.variants.${String(variantValue)}.fields.${f.name}`,
        definitionsByName,
        counts,
      ),
    );
  }
}

/**
 * スキーマ全体（options/globals）から到達できる、すべてのウェイポイント・アノテーションの値と
 * global の値を走査し、プリセット参照の使用件数を `scope` ごとに数える。
 * `optionValuesList` にはノード・アノテーションを問わず、各要素の `options` を渡す。
 */
export function countPresetUsages(
  schema: OptionsSchema,
  optionValuesList: OptionValues[],
  globalValues: OptionValues,
): PresetUsageCounts {
  const definitionsByName = definitionsMap(schema);
  const counts: PresetUsageCounts = new Map();
  schema.options.forEach((o) => {
    optionValuesList.forEach((ov) => visitForUsage(o, ov[o.name], `options.${o.name}`, definitionsByName, counts));
  });
  schema.globals.forEach((g) => visitForUsage(g, globalValues[g.name], `globals.${g.name}`, definitionsByName, counts));
  return counts;
}

/** `countPresetUsages` の結果から、特定の `scope` のプリセット名の使用件数だけを取り出す。 */
export function usageCountFor(counts: PresetUsageCounts, scope: string, presetName: string): number {
  return counts.get(scope)?.get(presetName) ?? 0;
}

interface ReplaceResult {
  value: OptionValue | undefined;
  count: number;
}

function replaceInValue(
  spec: TypeSpec,
  value: OptionValue | undefined,
  targetScope: string,
  currentScope: string,
  presetName: string,
  presetValue: OptionValue,
  definitionsByName: Map<string, DefinitionDef>,
): ReplaceResult {
  if (value === undefined) return { value, count: 0 };
  if (spec.type === 'ref') {
    const def = spec.ref ? definitionsByName.get(spec.ref) : undefined;
    if (!def) return { value, count: 0 };
    return replaceInValue(
      def,
      value,
      targetScope,
      `definitions.${spec.ref}`,
      presetName,
      presetValue,
      definitionsByName,
    );
  }
  if (isActivePresetRef(spec, value)) return { value, count: 0 }; // 既にプリセット参照になっている
  if (currentScope === targetScope && deepEqual(value, presetValue)) {
    return { value: { $preset: presetName }, count: 1 };
  }
  if (spec.type === 'list' && Array.isArray(value) && spec.item) {
    let count = 0;
    const items = value.map((v) => {
      const r = replaceInValue(
        spec.item!,
        v,
        targetScope,
        `${currentScope}.item`,
        presetName,
        presetValue,
        definitionsByName,
      );
      count += r.count;
      return r.value as OptionValue;
    });
    return { value: items, count };
  }
  if (spec.type === 'object' && isPlainObject(value)) {
    let count = 0;
    const result: Record<string, OptionValue> = { ...value };
    (spec.fields ?? []).forEach((f) => {
      if (result[f.name] === undefined) return;
      const r = replaceInValue(
        f,
        result[f.name],
        targetScope,
        `${currentScope}.fields.${f.name}`,
        presetName,
        presetValue,
        definitionsByName,
      );
      result[f.name] = r.value as OptionValue;
      count += r.count;
    });
    return { value: result, count };
  }
  if (spec.type === 'map' && isPlainObject(value)) {
    let count = 0;
    const valueSpec = spec.value_type ?? { type: 'any' };
    const result: Record<string, OptionValue> = {};
    Object.keys(value).forEach((k) => {
      const r = replaceInValue(
        valueSpec,
        value[k],
        targetScope,
        `${currentScope}.value_type`,
        presetName,
        presetValue,
        definitionsByName,
      );
      result[k] = r.value as OptionValue;
      count += r.count;
    });
    return { value: result, count };
  }
  if (spec.type === 'union' && isPlainObject(value)) {
    const discriminator = spec.discriminator || 'type';
    const variantValue = value[discriminator];
    const variant = (spec.variants ?? []).find((v) => v.value === variantValue);
    let count = 0;
    const result: Record<string, OptionValue> = { ...value };
    (variant?.fields ?? []).forEach((f) => {
      if (result[f.name] === undefined) return;
      const r = replaceInValue(
        f,
        result[f.name],
        targetScope,
        `${currentScope}.variants.${String(variantValue)}.fields.${f.name}`,
        presetName,
        presetValue,
        definitionsByName,
      );
      result[f.name] = r.value as OptionValue;
      count += r.count;
    });
    return { value: result, count };
  }
  return { value, count: 0 };
}

export interface ReplaceMatchingValuesResult {
  optionValuesList: OptionValues[];
  globalValues: OptionValues;
  count: number;
}

/**
 * `targetScope`（`targetSpec` が実際に置かれているスキーマ上の位置。`countPresetUsages` の scope と同じ形式）
 * において、`targetSpec.presets` の `presetName` の値と完全に一致する値を、そのプリセットへの参照に置き換える。
 * 一致しない値・既に参照になっている値・別スコープの値には触れない。
 */
export function replaceMatchingValuesWithPreset(
  schema: OptionsSchema,
  optionValuesList: OptionValues[],
  globalValues: OptionValues,
  targetScope: string,
  targetSpec: TypeSpec,
  presetName: string,
): ReplaceMatchingValuesResult {
  const preset = findPresetByName(targetSpec, presetName);
  if (!preset) return { optionValuesList, globalValues, count: 0 };
  const definitionsByName = definitionsMap(schema);
  let total = 0;

  const newList = optionValuesList.map((ov) => {
    const next: OptionValues = { ...ov };
    schema.options.forEach((o) => {
      if (next[o.name] === undefined) return;
      const r = replaceInValue(
        o,
        next[o.name],
        targetScope,
        `options.${o.name}`,
        presetName,
        preset.value,
        definitionsByName,
      );
      next[o.name] = r.value;
      total += r.count;
    });
    return next;
  });

  const newGlobals: OptionValues = { ...globalValues };
  schema.globals.forEach((g) => {
    if (newGlobals[g.name] === undefined) return;
    const r = replaceInValue(
      g,
      newGlobals[g.name],
      targetScope,
      `globals.${g.name}`,
      presetName,
      preset.value,
      definitionsByName,
    );
    newGlobals[g.name] = r.value;
    total += r.count;
  });

  return { optionValuesList: newList, globalValues: newGlobals, count: total };
}

/**
 * スキーマ内の、`presets` を1件以上持つすべての型ノードを、その `scope` 文字列をキーとして列挙する
 * （`ref` は参照先の definitions のスコープへ折りたたむ）。`OptionSchemaTab` の Apply 時に、
 * 適用前後のスキーマで同じ scope を比べ、消えたプリセットを検出するために使う。
 */
export function collectPresetScopes(schema: OptionsSchema): Map<string, PresetDef[]> {
  const definitionsByName = definitionsMap(schema);
  const out = new Map<string, PresetDef[]>();

  const visit = (spec: TypeSpec, scope: string, refChain: ReadonlySet<string>): void => {
    if (spec.type === 'ref') {
      const def = spec.ref ? definitionsByName.get(spec.ref) : undefined;
      if (!def || refChain.has(spec.ref!)) return;
      visit(def, `definitions.${spec.ref}`, new Set([...refChain, spec.ref!]));
      return;
    }
    if (spec.presets && spec.presets.length > 0) out.set(scope, spec.presets);
    if (spec.type === 'list' && spec.item) visit(spec.item, `${scope}.item`, refChain);
    if (spec.type === 'object') {
      (spec.fields ?? []).forEach((f) => visit(f, `${scope}.fields.${f.name}`, refChain));
    }
    if (spec.type === 'map' && spec.value_type) visit(spec.value_type, `${scope}.value_type`, refChain);
    if (spec.type === 'union') {
      (spec.variants ?? []).forEach((v) =>
        v.fields.forEach((f) => visit(f, `${scope}.variants.${v.value}.fields.${f.name}`, refChain)),
      );
    }
  };

  schema.options.forEach((o) => visit(o, `options.${o.name}`, new Set()));
  schema.globals.forEach((g) => visit(g, `globals.${g.name}`, new Set()));
  (schema.definitions ?? []).forEach((d) => visit(d, `definitions.${d.name}`, new Set()));
  return out;
}

function inlineInValue(
  spec: TypeSpec,
  value: OptionValue | undefined,
  targetScope: string,
  currentScope: string,
  presetName: string,
  literalValue: OptionValue,
  definitionsByName: Map<string, DefinitionDef>,
): ReplaceResult {
  if (value === undefined) return { value, count: 0 };
  if (spec.type === 'ref') {
    const def = spec.ref ? definitionsByName.get(spec.ref) : undefined;
    if (!def) return { value, count: 0 };
    return inlineInValue(
      def,
      value,
      targetScope,
      `definitions.${spec.ref}`,
      presetName,
      literalValue,
      definitionsByName,
    );
  }
  if (currentScope === targetScope && isActivePresetRef(spec, value) && value.$preset === presetName) {
    return { value: literalValue, count: 1 };
  }
  if (isActivePresetRef(spec, value)) return { value, count: 0 };
  if (spec.type === 'list' && Array.isArray(value) && spec.item) {
    let count = 0;
    const items = value.map((v) => {
      const r = inlineInValue(
        spec.item!,
        v,
        targetScope,
        `${currentScope}.item`,
        presetName,
        literalValue,
        definitionsByName,
      );
      count += r.count;
      return r.value as OptionValue;
    });
    return { value: items, count };
  }
  if (spec.type === 'object' && isPlainObject(value)) {
    let count = 0;
    const result: Record<string, OptionValue> = { ...value };
    (spec.fields ?? []).forEach((f) => {
      if (result[f.name] === undefined) return;
      const r = inlineInValue(
        f,
        result[f.name],
        targetScope,
        `${currentScope}.fields.${f.name}`,
        presetName,
        literalValue,
        definitionsByName,
      );
      result[f.name] = r.value as OptionValue;
      count += r.count;
    });
    return { value: result, count };
  }
  if (spec.type === 'map' && isPlainObject(value)) {
    let count = 0;
    const valueSpec = spec.value_type ?? { type: 'any' };
    const result: Record<string, OptionValue> = {};
    Object.keys(value).forEach((k) => {
      const r = inlineInValue(
        valueSpec,
        value[k],
        targetScope,
        `${currentScope}.value_type`,
        presetName,
        literalValue,
        definitionsByName,
      );
      result[k] = r.value as OptionValue;
      count += r.count;
    });
    return { value: result, count };
  }
  if (spec.type === 'union' && isPlainObject(value)) {
    const discriminator = spec.discriminator || 'type';
    const variantValue = value[discriminator];
    const variant = (spec.variants ?? []).find((v) => v.value === variantValue);
    let count = 0;
    const result: Record<string, OptionValue> = { ...value };
    (variant?.fields ?? []).forEach((f) => {
      if (result[f.name] === undefined) return;
      const r = inlineInValue(
        f,
        result[f.name],
        targetScope,
        `${currentScope}.variants.${String(variantValue)}.fields.${f.name}`,
        presetName,
        literalValue,
        definitionsByName,
      );
      result[f.name] = r.value as OptionValue;
      count += r.count;
    });
    return { value: result, count };
  }
  return { value, count: 0 };
}

/**
 * スキーマから削除されたプリセットへの参照を、そのプリセットが持っていた実際の値へ展開する
 * （`$preset` 参照のまま残すと、削除後にエクスポート結果が壊れてしまうため）。
 * `schema` には、値がまだ従っている旧いスキーマ（削除される前の、`ref`/`definitions` を含む生のスキーマ）を渡す。
 */
export function inlineRemovedPresets(
  schema: OptionsSchema,
  optionValuesList: OptionValues[],
  globalValues: OptionValues,
  removals: { scope: string; name: string; value: OptionValue }[],
): ReplaceMatchingValuesResult {
  const definitionsByName = definitionsMap(schema);
  let total = 0;
  let list = optionValuesList;
  let globals = globalValues;

  removals.forEach(({ scope, name, value: literalValue }) => {
    list = list.map((ov) => {
      const next: OptionValues = { ...ov };
      schema.options.forEach((o) => {
        if (next[o.name] === undefined) return;
        const r = inlineInValue(o, next[o.name], scope, `options.${o.name}`, name, literalValue, definitionsByName);
        next[o.name] = r.value;
        total += r.count;
      });
      return next;
    });
    const nextGlobals: OptionValues = { ...globals };
    schema.globals.forEach((g) => {
      if (nextGlobals[g.name] === undefined) return;
      const r = inlineInValue(
        g,
        nextGlobals[g.name],
        scope,
        `globals.${g.name}`,
        name,
        literalValue,
        definitionsByName,
      );
      nextGlobals[g.name] = r.value;
      total += r.count;
    });
    globals = nextGlobals;
  });

  return { optionValuesList: list, globalValues: globals, count: total };
}
