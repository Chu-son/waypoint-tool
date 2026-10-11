import type { BlendPreviewResult } from '../types';

/** Rust 側の `PREVIEW_CANCELLED` と同じ文字列。より新しい要求に置き換えられたプレビューが返すエラー。 */
export const BLEND_PREVIEW_CANCELLED = 'cancelled';

/** Rust 側の `PREVIEW_HEADER_BYTES`。 */
const HEADER_BYTES = 40;

/**
 * `blend_map_preview` の応答（`BlendPreviewResult::into_bytes`）を読む。リトルエンディアンで、
 * `width: u32`, `height: u32`, `origin: f64 × 3`, `resolution: f64`、続けて RGBA の画素。
 */
export function parseBlendPreview(buffer: ArrayBuffer): BlendPreviewResult {
  if (buffer.byteLength < HEADER_BYTES) {
    throw new Error(`Blend preview response is too short (${buffer.byteLength} bytes)`);
  }
  const view = new DataView(buffer);
  const width = view.getUint32(0, true);
  const height = view.getUint32(4, true);
  const rgba = new Uint8Array(buffer, HEADER_BYTES);
  if (rgba.length !== width * height * 4) {
    throw new Error(
      `Blend preview has ${rgba.length} pixel bytes, expected ${width * height * 4} for ${width}×${height}`,
    );
  }
  return {
    width,
    height,
    origin: [view.getFloat64(8, true), view.getFloat64(16, true), view.getFloat64(24, true)],
    resolution: view.getFloat64(32, true),
    rgba,
  };
}
