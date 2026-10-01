import type { WaypointNode, OptionsSchema, OptionValue } from '../types/store';
import type { FieldDef, TypeSpec } from '../types/options';
import { getFlattenedWaypointIds } from './treeUtils';
import { quaternionToYaw } from './transformUtils';
import { resolvePresets, resolveWithDefaults, validateField } from './optionValues';

export interface ExportedWaypointItem {
  index: number;
  id: string;
  type: WaypointNode['type'];
  x: number;
  y: number;
  z: number;
  yaw: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  /** スキーマの既定値を補完した実効値。後方互換のため、テンプレートからは従来どおり `options.*` で参照できる。 */
  options: Record<string, any>;
  /**
   * ウェイポイントに明示的に入力された値だけ（未入力のフィールドは含まない）。
   * 受け側フォーマットの defaults に処理を委ねたい場合（mg_robot の `on_reached_actions` 等）に
   * `raw_options.*` から参照する。
   */
  raw_options: Record<string, any>;
}

/** グローバルフィールドをテンプレートの `globals` 変数へ渡す形にする。値が未設定のフィールドは含めない。 */
export function extractGlobalsForExport(optionsSchema: OptionsSchema | null): Record<string, OptionValue> {
  const globals: Record<string, OptionValue> = {};
  optionsSchema?.globals.forEach((field) => {
    if (field.value === undefined) return;
    const resolved = resolvePresets(field, field.value);
    if (resolved !== undefined) globals[field.name] = resolved;
  });
  return globals;
}

/** 値が整数だけで構成される型か（integer、および integer の list / map）。 */
function isIntegerSpec(spec: TypeSpec | undefined): boolean {
  if (!spec) return false;
  if (spec.type === 'integer') return true;
  if (spec.type === 'list') return isIntegerSpec(spec.item);
  if (spec.type === 'map') return isIntegerSpec(spec.value_type);
  return false;
}

function collectFromSpec(spec: TypeSpec | undefined, keys: Set<string>): void {
  if (!spec) return;
  spec.fields?.forEach((field) => collectFromField(field, keys));
  spec.variants?.forEach((variant) => variant.fields.forEach((field) => collectFromField(field, keys)));
  collectFromSpec(spec.item, keys);
  collectFromSpec(spec.value_type, keys);
}

function collectFromField(field: FieldDef, keys: Set<string>): void {
  if (isIntegerSpec(field)) keys.add(field.name);
  collectFromSpec(field, keys);
}

/**
 * スキーマ上 integer 型（およびその list / map）のフィールド名を集める。
 * 「整数も float で出力する」設定が有効でも、これらの値は整数のまま出力するためバックエンドへ渡す。
 */
export function collectIntegerOptionKeys(optionsSchema: OptionsSchema | null): string[] {
  const keys = new Set<string>();
  optionsSchema?.options.forEach((field) => collectFromField(field, keys));
  optionsSchema?.globals.forEach((field) => collectFromField(field, keys));
  optionsSchema?.definitions?.forEach((definition) => collectFromSpec(definition, keys));
  return [...keys].sort();
}

export function extractWaypointsForExport(
  rootNodeIds: string[],
  nodes: Record<string, WaypointNode>,
  optionsSchema: OptionsSchema | null,
  indexStartIndex: number = 0,
): ExportedWaypointItem[] {
  const flatIds = getFlattenedWaypointIds(rootNodeIds, nodes);

  return flatIds
    .map((id, index) => {
      const node = nodes[id];
      if (!node) return null;

      // raw_options: 明示的に入力された値だけ（スキーマに無い未知キーも含めてそのまま引き継ぐ）。
      // プリセット参照はここで実際の値に解決する（テンプレートに `$preset` が漏れないようにするため）が、
      // 既定値は補わない（未設定のフィールドの扱いを受け側フォーマットに委ねられるようにするため）。
      const rawOptions: Record<string, any> = { ...(node.options ?? {}) };
      optionsSchema?.options.forEach((opt) => {
        if (rawOptions[opt.name] === undefined) return;
        rawOptions[opt.name] = resolvePresets(opt, rawOptions[opt.name]);
      });
      // options: raw_options にスキーマの既定値を再帰的に補完した実効値。
      const resolvedOptions: Record<string, any> = { ...rawOptions };
      optionsSchema?.options.forEach((opt) => {
        const resolved = resolveWithDefaults(opt, node.options?.[opt.name]);
        if (resolved !== undefined) resolvedOptions[opt.name] = resolved;
      });

      const qx = node.transform?.qx || 0;
      const qy = node.transform?.qy || 0;
      const qz = node.transform?.qz || 0;
      const qw = node.transform?.qw ?? 1;
      const yawVal = quaternionToYaw(node.transform);

      return {
        index: index + indexStartIndex,
        id: node.id,
        type: node.type,
        x: node.transform?.x ?? 0,
        y: node.transform?.y ?? 0,
        z: node.transform?.z ?? 0,
        yaw: yawVal,
        qx,
        qy,
        qz,
        qw,
        options: resolvedOptions,
        raw_options: rawOptions,
      };
    })
    .filter((n): n is ExportedWaypointItem => n !== null);
}

/**
 * オプションの値に問題（`required` なのに値も既定値も無い、値の型がスキーマと合わない等）を
 * 持つウェイポイントの件数を数える。エクスポート前の確認（ブロックはせず、件数を示して
 * 続行を確認する）に使う。`required`/型検証は object のフィールドや union のバリアント
 * フィールドまで再帰的に見るため、`optionsSchema` は ref を解決済みの実効スキーマを渡すこと。
 */
export function countWaypointsWithInvalidOptions(
  rootNodeIds: string[],
  nodes: Record<string, WaypointNode>,
  optionsSchema: OptionsSchema | null,
): number {
  const fields = optionsSchema?.options ?? [];
  if (fields.length === 0) return 0;

  const flatIds = getFlattenedWaypointIds(rootNodeIds, nodes);
  return flatIds.filter((id) => {
    const node = nodes[id];
    if (!node) return false;
    return fields.some((field) => validateField(field, node.options?.[field.name], field.name).length > 0);
  }).length;
}
