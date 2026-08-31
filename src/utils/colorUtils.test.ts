import { describe, it, expect } from 'vitest';
import { hexStringToNumber, hexStringToVec3, getCssVariable } from './colorUtils';

describe('colorUtils', () => {
  describe('hexStringToNumber', () => {
    it('should convert standard 6-digit hex string to number', () => {
      expect(hexStringToNumber('#3b82f6')).toBe(0x3b82f6);
      expect(hexStringToNumber('10b981')).toBe(0x10b981);
      expect(hexStringToNumber('#ffffff')).toBe(0xffffff);
      expect(hexStringToNumber('#000000')).toBe(0x000000);
    });

    it('should convert 3-digit short hex string to number', () => {
      expect(hexStringToNumber('#fff')).toBe(0xffffff);
      expect(hexStringToNumber('#000')).toBe(0x000000);
      expect(hexStringToNumber('f00')).toBe(0xff0000);
    });

    it('should return fallback for invalid or null inputs', () => {
      expect(hexStringToNumber(null, 0x123456)).toBe(0x123456);
      expect(hexStringToNumber(undefined, 0x123456)).toBe(0x123456);
      expect(hexStringToNumber('invalid', 0x123456)).toBe(0x123456);
      expect(hexStringToNumber('', 0x123456)).toBe(0x123456);
    });
  });

  describe('hexStringToVec3', () => {
    it('should convert hex string to normalized RGB vec3', () => {
      const red = hexStringToVec3('#ff0000');
      expect(red[0]).toBeCloseTo(1.0);
      expect(red[1]).toBeCloseTo(0.0);
      expect(red[2]).toBeCloseTo(0.0);

      const white = hexStringToVec3('#ffffff');
      expect(white[0]).toBeCloseTo(1.0);
      expect(white[1]).toBeCloseTo(1.0);
      expect(white[2]).toBeCloseTo(1.0);

      const black = hexStringToVec3('#000000');
      expect(black[0]).toBeCloseTo(0.0);
      expect(black[1]).toBeCloseTo(0.0);
      expect(black[2]).toBeCloseTo(0.0);
    });

    it('should return fallback for invalid inputs', () => {
      expect(hexStringToVec3('invalid', [0.5, 0.5, 0.5])).toEqual([0.5, 0.5, 0.5]);
    });
  });

  describe('getCssVariable', () => {
    it('should retrieve variable if document is present', () => {
      document.documentElement.style.setProperty('--test-var', '#10b981');
      expect(getCssVariable('--test-var')).toBe('#10b981');
      document.documentElement.style.removeProperty('--test-var');
    });

    it('should return fallback if variable is missing', () => {
      expect(getCssVariable('--non-existent-var', '#default')).toBe('#default');
    });
  });
});
