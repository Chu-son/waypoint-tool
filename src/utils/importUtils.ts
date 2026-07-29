import { v4 as uuidv4 } from 'uuid';
import { ImportFieldMapping, OptionDef, OptionsSchema, WaypointNode, WaypointOptions } from '../types/store';

// デフォルトYAML/JSON形式（export_waypointsがラップなしのルート配列として出力する形式）に対応する既定マッピング。
// カスタムテンプレート選択時、template.importMapping が未設定ならこれを初期値として使う。
export const DEFAULT_IMPORT_MAPPING: ImportFieldMapping = {
  itemsPath: '',
  id: 'id',
  x: 'x',
  y: 'y',
  z: 'z',
  yaw: 'yaw',
  optionsPath: 'options',
};

// ドット区切りパスでネストしたオブジェクト/配列の値を取得する。
// path が空/undefined なら obj をそのまま返す（ルート自体が対象の場合）。
export function resolvePath(obj: any, path?: string): any {
  if (!path) return obj;
  return path.split('.').reduce((cur: any, seg: string) => {
    if (cur === undefined || cur === null) return undefined;
    return cur[seg];
  }, obj);
}

function toNumber(v: any): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isNaN(n) ? undefined : n;
}

// OptionDef.type に応じた型変換（ExportModalのfullOptions構築ロジックの逆変換）。
function coerceValue(v: any, opt: OptionDef): any {
  switch (opt.type) {
    case 'integer': {
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? opt.default : n;
    }
    case 'float': {
      const n = parseFloat(v);
      return Number.isNaN(n) ? opt.default : n;
    }
    case 'boolean':
      return typeof v === 'boolean' ? v : String(v).toLowerCase() === 'true';
    case 'list':
      return Array.isArray(v) ? v : [v];
    default:
      return v; // string / enum
  }
}

function coerceOptions(raw: Record<string, any>, schema: OptionsSchema | null): WaypointOptions {
  if (!schema) return { ...raw };

  const result: WaypointOptions = {};
  schema.options.forEach((opt) => {
    const v = raw[opt.name];
    result[opt.name] = v !== undefined ? coerceValue(v, opt) : opt.default;
  });
  // スキーマに無い未知キーはそのまま引き継ぐ
  Object.keys(raw).forEach((k) => {
    if (result[k] === undefined) result[k] = raw[k];
  });
  return result;
}

export type ImportResult = {
  nodes: WaypointNode[];
  errors: string[];
};

// マッピングルールに従い、汎用JSON値からWaypointNode配列を構築する。
// 個々の要素のパースに失敗した場合はスキップしてエラーに記録し、処理全体は継続する。
export function buildWaypointsFromImport(
  raw: any,
  mapping: ImportFieldMapping,
  optionsSchema: OptionsSchema | null,
): ImportResult {
  const errors: string[] = [];
  const items = resolvePath(raw, mapping.itemsPath);

  if (!Array.isArray(items)) {
    errors.push(`itemsPath "${mapping.itemsPath || '(root)'}" が配列ではありません`);
    return { nodes: [], errors };
  }

  const nodes: WaypointNode[] = [];
  items.forEach((item, idx) => {
    try {
      const x = toNumber(resolvePath(item, mapping.x));
      const y = toNumber(resolvePath(item, mapping.y));
      if (x === undefined || y === undefined) {
        throw new Error('x/y を取得できません');
      }
      const z = mapping.z ? (toNumber(resolvePath(item, mapping.z)) ?? 0) : 0;

      let qx = 0;
      let qy = 0;
      let qz = 0;
      let qw = 1;
      if (mapping.yaw) {
        const yaw = toNumber(resolvePath(item, mapping.yaw));
        if (yaw !== undefined) {
          qz = Math.sin(yaw / 2);
          qw = Math.cos(yaw / 2);
        }
      } else {
        qx = toNumber(resolvePath(item, mapping.qx)) ?? 0;
        qy = toNumber(resolvePath(item, mapping.qy)) ?? 0;
        qz = toNumber(resolvePath(item, mapping.qz)) ?? 0;
        qw = toNumber(resolvePath(item, mapping.qw)) ?? 1;
      }

      const rawOptions = resolvePath(item, mapping.optionsPath) ?? {};
      const options = coerceOptions(rawOptions, optionsSchema);

      nodes.push({
        id: uuidv4(),
        type: 'manual',
        transform: { x, y, z, qx, qy, qz, qw },
        options,
      });
    } catch (e) {
      errors.push(`要素 #${idx}: ${(e as Error).message}`);
    }
  });

  return { nodes, errors };
}
