import { describe, it, expect } from 'vitest';
import { coerceOptionValue, isOptionValueValid, toStoredOptionValue } from './optionValues';

describe('optionValues', () => {
  describe('toStoredOptionValue', () => {
    it.each([
      ['float', '0.5', 0.5],
      ['integer', '7', 7],
      ['boolean', 'true', true],
      ['boolean', 'false', false],
      ['string', 'map', 'map'],
      ['list', ['a', 'b'], ['a', 'b']],
    ])('stores a %s input %j as %j', (type, raw, expected) => {
      expect(toStoredOptionValue(raw, type)).toEqual(expected);
    });

    it.each([
      ['string', ''],
      ['float', ''],
      ['list', []],
      ['string', undefined],
    ])('treats an empty %s input as unset', (type, raw) => {
      expect(toStoredOptionValue(raw, type)).toBeUndefined();
    });
  });

  describe('isOptionValueValid', () => {
    it.each([
      ['float', '1.5', true],
      ['float', 'abc', false],
      ['integer', '3', true],
      ['integer', '3.5', false],
      ['boolean', 'TRUE', true],
      ['boolean', 'yes', false],
      ['string', 'anything', true],
      ['float', '', true],
      ['float', undefined, true],
    ])('%s value %j is valid: %s', (type, value, expected) => {
      expect(isOptionValueValid(type, value)).toBe(expected);
    });
  });

  describe('coerceOptionValue', () => {
    it('falls back when a number cannot be parsed', () => {
      expect(coerceOptionValue('abc', 'float', 1.5)).toBe(1.5);
      expect(coerceOptionValue('abc', 'integer', 2)).toBe(2);
    });

    it('wraps a scalar into a list', () => {
      expect(coerceOptionValue('a', 'list')).toEqual(['a']);
    });
  });
});
