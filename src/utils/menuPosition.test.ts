import { describe, it, expect } from 'vitest';
import { clampMenuPosition } from './menuPosition';

const viewport = { width: 1000, height: 800 };
const size = { width: 200, height: 300 };

describe('clampMenuPosition', () => {
  it('keeps the pointer position when the menu fits', () => {
    expect(clampMenuPosition(100, 100, size, viewport)).toEqual({ left: 100, top: 100 });
  });

  it('opens to the left of the pointer near the right edge', () => {
    expect(clampMenuPosition(980, 100, size, viewport)).toEqual({ left: 780, top: 100 });
  });

  it('opens above the pointer near the bottom edge', () => {
    expect(clampMenuPosition(100, 780, size, viewport)).toEqual({ left: 100, top: 480 });
  });

  it('handles the bottom-right corner', () => {
    expect(clampMenuPosition(995, 795, size, viewport)).toEqual({ left: 792, top: 492 });
  });

  it('stays inside the window when flipping would leave it on the other side', () => {
    const narrow = { width: 250, height: 800 };
    expect(clampMenuPosition(100, 100, { width: 300, height: 100 }, narrow).left).toBe(8);
  });

  it('limits the height and scrolls when the menu is taller than the window', () => {
    expect(clampMenuPosition(100, 400, { width: 200, height: 2000 }, viewport)).toEqual({
      left: 100,
      top: 8,
      maxHeight: 784,
    });
  });
});
