import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  writeMapElementsToClipboard,
  readMapElementsFromClipboard,
  validateAndParseClipboardEnvelope,
  setMemoryClipboardCache,
  WaypointClipboardPayload,
  AnnotationClipboardPayload,
  MAP_ELEMENT_CLIPBOARD_SCHEMA,
  MAP_ELEMENT_CLIPBOARD_VERSION,
} from './mapElementClipboard';

describe('mapElementClipboard', () => {
  beforeEach(() => {
    setMemoryClipboardCache(null);
    vi.restoreAllMocks();
  });

  describe('validateAndParseClipboardEnvelope', () => {
    it('successfully parses valid waypoint clipboard data', () => {
      const validEnvelope = {
        schema: MAP_ELEMENT_CLIPBOARD_SCHEMA,
        version: MAP_ELEMENT_CLIPBOARD_VERSION,
        timestamp: Date.now(),
        payload: {
          elementType: 'waypoint',
          topLevelIds: ['node-1'],
          nodes: {
            'node-1': { id: 'node-1', type: 'manual', transform: { x: 1, y: 2, qx: 0, qy: 0, qz: 0, qw: 1 } },
          },
        },
      };

      const result = validateAndParseClipboardEnvelope(JSON.stringify(validEnvelope));
      expect(result).not.toBeNull();
      expect(result?.elementType).toBe('waypoint');
      expect((result as WaypointClipboardPayload).topLevelIds).toEqual(['node-1']);
    });

    it('successfully parses valid annotation clipboard data', () => {
      const validEnvelope = {
        schema: MAP_ELEMENT_CLIPBOARD_SCHEMA,
        version: MAP_ELEMENT_CLIPBOARD_VERSION,
        timestamp: Date.now(),
        payload: {
          elementType: 'annotation',
          topLevelIds: ['annot-1'],
          annotationObjects: {
            'annot-1': { id: 'annot-1', type: 'point', name: 'P1', x: 0, y: 0, visible: true, labelVisible: true },
          },
          annotationGroups: {},
        },
      };

      const result = validateAndParseClipboardEnvelope(JSON.stringify(validEnvelope));
      expect(result).not.toBeNull();
      expect(result?.elementType).toBe('annotation');
    });

    it('rejects invalid JSON, wrong schema, or corrupted structure', () => {
      expect(validateAndParseClipboardEnvelope('')).toBeNull();
      expect(validateAndParseClipboardEnvelope('not json')).toBeNull();
      expect(validateAndParseClipboardEnvelope(JSON.stringify({ schema: 'other-app' }))).toBeNull();
      expect(
        validateAndParseClipboardEnvelope(JSON.stringify({ schema: MAP_ELEMENT_CLIPBOARD_SCHEMA, version: 99 })),
      ).toBeNull();
      expect(
        validateAndParseClipboardEnvelope(
          JSON.stringify({ schema: MAP_ELEMENT_CLIPBOARD_SCHEMA, version: 1, payload: {} }),
        ),
      ).toBeNull();
    });
  });

  describe('write and read via memory fallback', () => {
    it('writes and reads payload via memory cache when clipboard API is unavailable', async () => {
      const payload: WaypointClipboardPayload = {
        elementType: 'waypoint',
        topLevelIds: ['wp-1'],
        nodes: {
          'wp-1': { id: 'wp-1', type: 'manual' },
        },
      };

      const writeOk = await writeMapElementsToClipboard(payload);
      expect(writeOk).toBe(true);

      const readResult = await readMapElementsFromClipboard();
      expect(readResult).toEqual(payload);
    });

    it('writes and reads payload via navigator.clipboard when available', async () => {
      let clipboardContent = '';
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn(async (text: string) => {
            clipboardContent = text;
          }),
          readText: vi.fn(async () => clipboardContent),
        },
      });

      const payload: AnnotationClipboardPayload = {
        elementType: 'annotation',
        topLevelIds: ['g1'],
        annotationObjects: {},
        annotationGroups: {
          g1: { id: 'g1', name: 'Group 1', type: 'manual_group', visible: true, children_ids: [] },
        },
      };

      await writeMapElementsToClipboard(payload);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();

      const result = await readMapElementsFromClipboard();
      expect(result).toEqual(payload);
    });

    it('returns null and clears cache when external non-map text is copied', async () => {
      const payload: WaypointClipboardPayload = {
        elementType: 'waypoint',
        topLevelIds: ['wp-1'],
        nodes: { 'wp-1': { id: 'wp-1', type: 'manual' } },
      };

      // 最初にマップ要素を書き込む
      let clipboardContent = '';
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn(async (text: string) => {
            clipboardContent = text;
          }),
          readText: vi.fn(async () => clipboardContent),
        },
      });

      await writeMapElementsToClipboard(payload);
      expect(await readMapElementsFromClipboard()).toEqual(payload);

      // 外部で別の文字列をコピー
      clipboardContent = 'Just some random text copied from browser';

      // 読み取ると null が返り、過去のキャッシュが返らないこと
      const result = await readMapElementsFromClipboard();
      expect(result).toBeNull();
    });

    it('falls back to memory cache when clipboard readText throws an error (e.g. permission denied)', async () => {
      const payload: WaypointClipboardPayload = {
        elementType: 'waypoint',
        topLevelIds: ['wp-1'],
        nodes: { 'wp-1': { id: 'wp-1', type: 'manual' } },
      };

      setMemoryClipboardCache(payload);

      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn(async () => {
            throw new Error('Permission denied');
          }),
        },
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await readMapElementsFromClipboard();
      expect(result).toEqual(payload);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
