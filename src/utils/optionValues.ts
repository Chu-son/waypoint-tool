import type { OptionValue } from '../types/store';

/** オプション型（string/float/integer/boolean/list）に応じて値を型変換する。変換できない数値は `fallback` を返す。 */
export function coerceOptionValue(v: any, type: string, fallback?: any): any {
  switch (type) {
    case 'integer': {
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? fallback : n;
    }
    case 'float': {
      const n = parseFloat(v);
      return Number.isNaN(n) ? fallback : n;
    }
    case 'boolean':
      return typeof v === 'boolean' ? v : String(v).toLowerCase() === 'true';
    case 'list':
      return Array.isArray(v) ? v : [v];
    default:
      return v; // string / enum
  }
}

/** 入力値が型に合っているか。未入力（undefined / 空文字）は「未設定」として有効扱い。 */
export function isOptionValueValid(type: string, value: unknown): boolean {
  if (value === undefined || value === '') return true;
  if (type === 'integer') return !isNaN(Number(value)) && Number.isInteger(Number(value));
  if (type === 'float') return !isNaN(Number(value));
  if (type === 'boolean') {
    const str = String(value).toLowerCase();
    return str === 'true' || str === 'false';
  }
  return true;
}

/** 入力欄の値を保存用の型付き値へ変換する。未入力は `undefined`（未設定）。 */
export function toStoredOptionValue(raw: unknown, type: string): OptionValue | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (Array.isArray(raw)) return raw.length > 0 ? raw : undefined;
  return coerceOptionValue(raw, type);
}
