import type { BlendPreviewResult } from '../types';

/** Rust 側の `PREVIEW_CANCELLED` と同じ文字列。より新しい要求に置き換えられたプレビューが返すエラー。 */
export const BLEND_PREVIEW_CANCELLED = 'cancelled';

/** Rust 側の `PREVIEW_HEADER_BYTES`。 */
const HEADER_BYTES = 40;

/**
 * `blend_map_preview` の応答（`BlendPreviewResult::into_bytes`）を読む。リトルエンディアンで、
 * `width: u32`, `height: u32`, `origin: f64 × 3`, `resolution: f64`、続けて 1 セル 1 バイトのセル値（Rust 側の `BlendedCells::to_codes`）。
 */
export function parseBlendPreview(buffer: ArrayBuffer): BlendPreviewResult {
  if (buffer.byteLength < HEADER_BYTES) {
    throw new Error(`Blend preview response is too short (${buffer.byteLength} bytes)`);
  }
  const view = new DataView(buffer);
  const width = view.getUint32(0, true);
  const height = view.getUint32(4, true);
  const cells = new Uint8Array(buffer, HEADER_BYTES);
  if (cells.length !== width * height) {
    throw new Error(`Blend preview has ${cells.length} cell bytes, expected ${width * height} for ${width}×${height}`);
  }
  return {
    width,
    height,
    origin: [view.getFloat64(8, true), view.getFloat64(16, true), view.getFloat64(24, true)],
    resolution: view.getFloat64(32, true),
    cells,
  };
}

/** Rust 側の `CellValue::to_rgba` と同じ色。添字はセル値（0 = Unknown, 1 = Free, 2 = Obstacle）。範囲外は Unknown 扱い。 */
const CELL_COLORS: Array<[number, number, number]> = [
  [205, 205, 205],
  [254, 254, 254],
  [0, 0, 0],
];

/** 1 画素を 32 bit の 1 語として書くための表。バイト順は実行環境のものに合わせて作るので、環境によらず R, G, B, A の順になる。 */
const CELL_PALETTE = (() => {
  const palette = new Uint32Array(256).fill(0);
  const bytes = new Uint8Array(4);
  const word = new Uint32Array(bytes.buffer);
  for (let code = 0; code < 256; code++) {
    const [r, g, b] = CELL_COLORS[code] ?? CELL_COLORS[0];
    bytes.set([r, g, b, 255]);
    palette[code] = word[0];
  }
  return palette;
})();

/** セル値を RGBA（不透明）の画素に広げる。 */
export function cellsToRgba(cells: Uint8Array): Uint8Array {
  const rgba = new Uint8Array(cells.length * 4);
  const words = new Uint32Array(rgba.buffer);
  for (let i = 0; i < cells.length; i++) words[i] = CELL_PALETTE[cells[i]];
  return rgba;
}
