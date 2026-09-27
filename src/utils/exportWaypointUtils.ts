import type { WaypointNode, OptionsSchema, OptionValue } from '../types/store';
import { getFlattenedWaypointIds } from './treeUtils';
import { quaternionToYaw } from './transformUtils';
import { resolveWithDefaults } from './optionValues';

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
    if (field.value !== undefined) globals[field.name] = field.value;
  });
  return globals;
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
      const rawOptions: Record<string, any> = { ...(node.options ?? {}) };
      // options: raw_options にスキーマの既定値を再帰的に補完した実効値。
      const resolvedOptions: Record<string, any> = { ...rawOptions };
      optionsSchema?.options.forEach((opt) => {
        const resolved = resolveWithDefaults(opt, rawOptions[opt.name]);
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
