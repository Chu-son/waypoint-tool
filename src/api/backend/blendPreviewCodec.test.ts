import { describe, expect, it } from 'vitest';
import { parseBlendPreview } from './blendPreviewCodec';

/** What the backend sends: the header (all little-endian) and then the pixels. */
function response(width: number, height: number, origin: number[], resolution: number, pixels: number[]) {
  const bytes = new ArrayBuffer(40 + pixels.length);
  const view = new DataView(bytes);
  view.setUint32(0, width, true);
  view.setUint32(4, height, true);
  origin.forEach((value, i) => view.setFloat64(8 + i * 8, value, true));
  view.setFloat64(32, resolution, true);
  new Uint8Array(bytes, 40).set(pixels);
  return bytes;
}

describe('parseBlendPreview', () => {
  it('reads the size, placement and pixels of the preview', () => {
    const pixels = [0, 0, 0, 255, 254, 254, 254, 255];

    const preview = parseBlendPreview(response(2, 1, [-1.5, 2.25, 0], 0.05, pixels));

    expect(preview.width).toBe(2);
    expect(preview.height).toBe(1);
    expect(preview.origin).toEqual([-1.5, 2.25, 0]);
    expect(preview.resolution).toBe(0.05);
    expect(Array.from(preview.rgba)).toEqual(pixels);
  });

  it('rejects a response whose pixels do not match the size in its header', () => {
    expect(() => parseBlendPreview(response(2, 2, [0, 0, 0], 0.05, [0, 0, 0, 255]))).toThrow(/pixel bytes/);
  });

  it('rejects a response too short to hold a header', () => {
    expect(() => parseBlendPreview(new ArrayBuffer(8))).toThrow(/too short/);
  });
});
