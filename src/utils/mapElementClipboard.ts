import { WaypointNode, AnnotationObject, AnnotationGroup } from '../types/store';

export type MapElementType = 'waypoint' | 'annotation';

export interface WaypointClipboardPayload {
  elementType: 'waypoint';
  topLevelIds: string[];
  nodes: Record<string, WaypointNode>;
}

export interface AnnotationClipboardPayload {
  elementType: 'annotation';
  topLevelIds: string[];
  annotationObjects: Record<string, AnnotationObject>;
  annotationGroups: Record<string, AnnotationGroup>;
}

export type MapElementClipboardPayload =
  | WaypointClipboardPayload
  | AnnotationClipboardPayload;

export interface MapElementClipboardEnvelope {
  schema: 'waypoint-tool/map-element-clipboard';
  version: 1;
  timestamp: number;
  payload: MapElementClipboardPayload;
}

export const MAP_ELEMENT_CLIPBOARD_SCHEMA = 'waypoint-tool/map-element-clipboard';
export const MAP_ELEMENT_CLIPBOARD_VERSION = 1;

/**
 * 同一ウィンドウ内やクリップボードAPI権限エラー時のフォールバック用インメモリキャッシュ
 */
let inMemoryClipboardPayload: MapElementClipboardPayload | null = null;

export function setMemoryClipboardCache(payload: MapElementClipboardPayload | null): void {
  inMemoryClipboardPayload = payload ? structuredClone(payload) : null;
}

export function getMemoryClipboardCache(): MapElementClipboardPayload | null {
  return inMemoryClipboardPayload ? structuredClone(inMemoryClipboardPayload) : null;
}

/**
 * 外部入力文字列を検証し、正規の MapElementClipboardEnvelope かどうかを判定する (ACL)
 */
export function validateAndParseClipboardEnvelope(
  rawText: string
): MapElementClipboardPayload | null {
  if (!rawText || typeof rawText !== 'string') return null;

  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') return null;

    if (
      parsed.schema !== MAP_ELEMENT_CLIPBOARD_SCHEMA ||
      parsed.version !== MAP_ELEMENT_CLIPBOARD_VERSION ||
      !parsed.payload ||
      typeof parsed.payload !== 'object'
    ) {
      return null;
    }

    const payload = parsed.payload as MapElementClipboardPayload;

    if (payload.elementType === 'waypoint') {
      if (
        Array.isArray(payload.topLevelIds) &&
        payload.nodes &&
        typeof payload.nodes === 'object'
      ) {
        return payload;
      }
    } else if (payload.elementType === 'annotation') {
      if (
        Array.isArray(payload.topLevelIds) &&
        payload.annotationObjects &&
        typeof payload.annotationObjects === 'object' &&
        payload.annotationGroups &&
        typeof payload.annotationGroups === 'object'
      ) {
        return payload;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * マップ要素ペイロードをシステムクリップボードおよびメモリキャッシュに書き込む
 */
export async function writeMapElementsToClipboard(
  payload: MapElementClipboardPayload
): Promise<boolean> {
  const envelope: MapElementClipboardEnvelope = {
    schema: MAP_ELEMENT_CLIPBOARD_SCHEMA,
    version: MAP_ELEMENT_CLIPBOARD_VERSION,
    timestamp: Date.now(),
    payload,
  };

  setMemoryClipboardCache(payload);

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(JSON.stringify(envelope, null, 2));
      return true;
    }
  } catch (err) {
    console.warn('[MapElementClipboard] Failed to write to system clipboard, falling back to memory cache:', err);
  }

  // クリップボードAPIが失敗してもメモリキャッシュがあれば true
  return inMemoryClipboardPayload !== null;
}

/**
 * システムクリップボードまたはメモリキャッシュからマップ要素ペイロードを読み出す
 */
export async function readMapElementsFromClipboard(): Promise<MapElementClipboardPayload | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      const parsed = validateAndParseClipboardEnvelope(text);
      if (parsed) {
        setMemoryClipboardCache(parsed);
        return parsed;
      }
      // クリップボードが正常に読み出せたがマップ要素形式でない場合は、
      // 外部で別テキストがコピーされたとみなし、メモリキャッシュも無効化して null を返す
      setMemoryClipboardCache(null);
      return null;
    }
  } catch (err) {
    console.warn('[MapElementClipboard] Failed to read from system clipboard, checking memory cache:', err);
    return getMemoryClipboardCache();
  }

  return getMemoryClipboardCache();
}

