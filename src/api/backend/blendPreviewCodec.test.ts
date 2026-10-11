import { describe, expect, it } from 'vitest';
import { cellsToRgba, parseBlendPreview } from './blendPreviewCodec';

/** What the backend sends: the header (all little-endian) and then one byte per cell. */
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
  it('reads the size, placement and cells of the preview', () => {
    const cells = [2, 1];

    const preview = parseBlendPreview(response(2, 1, [-1.5, 2.25, 0], 0.05, cells));

    expect(preview.width).toBe(2);
    expect(preview.height).toBe(1);
    expect(preview.origin).toEqual([-1.5, 2.25, 0]);
    expect(preview.resolution).toBe(0.05);
    expect(Array.from(preview.cells)).toEqual(cells);
  });

  it('rejects a response whose cells do not match the size in its header', () => {
    expect(() => parseBlendPreview(response(2, 2, [0, 0, 0], 0.05, [2, 2]))).toThrow(/cell bytes/);
  });

  it('rejects a response too short to hold a header', () => {
    expect(() => parseBlendPreview(new ArrayBuffer(8))).toThrow(/too short/);
  });
});

describe('cellsToRgba', () => {
  it('colours obstacles black, free cells white-ish and unknown cells grey, all opaque', () => {
    expect(Array.from(cellsToRgba(new Uint8Array([2, 1, 0])))).toEqual([
      0, 0, 0, 255, 254, 254, 254, 255, 205, 205, 205, 255,
    ]);
  });

  it('treats a value it does not know as unknown rather than transparent', () => {
    expect(Array.from(cellsToRgba(new Uint8Array([200])))).toEqual([205, 205, 205, 255]);
  });
});
