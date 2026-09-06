import { describe, it, expect } from 'vitest';
import {
  resolveThemeVariables,
  THEME_PRESETS,
  DARK_THEME_PRESETS,
  ACCENT_THEME_PRESETS,
  VALID_ACCENT_THEME_PRESET_IDS,
  darkenHex,
} from './themePresets';

describe('themePresets & resolveThemeVariables', () => {
  it('resolves default preset when theme is empty or undefined', () => {
    const { variables, colorScheme } = resolveThemeVariables(undefined);
    expect(colorScheme).toBe('dark');
    expect(variables['--color-primary-base']).toBe('#5e6ad2');
    expect(variables['--color-surface-base']).toBe('#090a0c');
    expect(variables['--color-accent-anchor']).toBe('#fbbf24');
    expect(variables['--color-accent-generator']).toBe('#34d399');
    expect(variables['--color-accent-reference']).toBe('#c084fc');
    expect(variables['--color-accent-automation']).toBe('#22d3ee');
  });

  it('resolves emerald / roomba preset correctly', () => {
    const emeraldRes = resolveThemeVariables({ preset: 'emerald' });
    expect(emeraldRes.variables['--color-primary-base']).toBe('#10b981');
    expect(emeraldRes.variables['--color-primary-hover']).toBe('#34d399');
    expect(emeraldRes.variables['--color-surface-base']).toBe('#080c0a');
    expect(emeraldRes.variables['--color-surface-panel']).toBe('#101512');
    expect(emeraldRes.variables['--color-text-base']).toBe('#f7f8f8');

    const roombaRes = resolveThemeVariables({ preset: 'roomba' });
    expect(roombaRes.variables['--color-primary-base']).toBe('#10b981');
    expect(roombaRes.variables['--color-surface-base']).toBe('#080c0a');
  });

  it('resolves ocean, amber, purple, and midnight presets with Linear Style colors', () => {
    const oceanRes = resolveThemeVariables({ preset: 'ocean' });
    expect(oceanRes.variables['--color-primary-base']).toBe('#0ea5e9');
    expect(oceanRes.variables['--color-primary-hover']).toBe('#38bdf8');
    expect(oceanRes.variables['--color-surface-base']).toBe('#080a0f');
    expect(oceanRes.variables['--color-surface-panel']).toBe('#0f131a');

    const amberRes = resolveThemeVariables({ preset: 'amber' });
    expect(amberRes.variables['--color-primary-base']).toBe('#f59e0b');
    expect(amberRes.variables['--color-primary-hover']).toBe('#fbbf24');
    expect(amberRes.variables['--color-surface-base']).toBe('#0c0a09');
    expect(amberRes.variables['--color-surface-panel']).toBe('#161311');

    const purpleRes = resolveThemeVariables({ preset: 'purple' });
    expect(purpleRes.variables['--color-primary-base']).toBe('#8b5cf6');
    expect(purpleRes.variables['--color-primary-hover']).toBe('#a78bfa');
    expect(purpleRes.variables['--color-surface-base']).toBe('#09080e');
    expect(purpleRes.variables['--color-surface-panel']).toBe('#121018');

    const midnightRes = resolveThemeVariables({ preset: 'midnight' });
    expect(midnightRes.variables['--color-primary-base']).toBe('#06b6d4');
    expect(midnightRes.variables['--color-primary-hover']).toBe('#22d3ee');
    expect(midnightRes.variables['--color-surface-base']).toBe('#000000');
    expect(midnightRes.variables['--color-surface-panel']).toBe('#0c0c0d');
  });

  it('ensures all dark theme presets enforce neutral text and hairline borders (Golden Rules 2 & 3)', () => {
    const darkPresetKeys = ['default', 'emerald', 'ocean', 'amber', 'purple', 'midnight'];
    darkPresetKeys.forEach((key) => {
      const { variables } = resolveThemeVariables({ preset: key });
      expect(variables['--color-text-base']).toBe('#f7f8f8');
      expect(variables['--color-text-muted']).toBe('#8a8f98');
      expect(variables['--color-text-inverse']).toBe('#ffffff');
      expect(variables['--color-border-base']).toBe('rgba(255, 255, 255, 0.08)');
    });
  });

  it('resolves light preset correctly', () => {
    const { variables, colorScheme } = resolveThemeVariables({ preset: 'light' });
    expect(colorScheme).toBe('light');
    expect(variables['--color-primary-base']).toBe('#5e6ad2');
    expect(variables['--color-primary-hover']).toBe('#4b55c0');
    expect(variables['--color-surface-base']).toBe('#f7f8f9');
    expect(variables['--color-surface-panel']).toBe('#ffffff');
    expect(variables['--color-surface-hover']).toBe('#f0f1f4');
    expect(variables['--color-surface-active']).toBe('rgba(0, 0, 0, 0.07)');
    expect(variables['--color-border-base']).toBe('#e2e4e8');
    expect(variables['--color-text-base']).toBe('#17171a');
    expect(variables['--color-text-muted']).toBe('#686b74');
  });

  it('resolves dark alias preset correctly', () => {
    const { variables, colorScheme } = resolveThemeVariables({ preset: 'dark' });
    expect(colorScheme).toBe('dark');
    expect(variables['--color-primary-base']).toBe('#5e6ad2');
    expect(variables['--color-surface-base']).toBe('#090a0c');
    expect(variables['--color-surface-active']).toBe('rgba(255, 255, 255, 0.08)');
  });

  it('allows overriding preset colors with custom colors', () => {
    const { variables } = resolveThemeVariables({
      preset: 'ocean',
      colors: {
        primaryBase: '#e11d48', // Custom rose primary
        surfaceBase: '#121212',
        surfaceActive: 'rgba(255, 0, 0, 0.2)',
      },
    });

    expect(variables['--color-primary-base']).toBe('#e11d48');
    expect(variables['--color-surface-base']).toBe('#121212');
    expect(variables['--color-surface-active']).toBe('rgba(255, 0, 0, 0.2)');
    // Non-overridden colors remain from preset
    expect(variables['--color-surface-panel']).toBe(THEME_PRESETS.ocean.surfacePanel);
  });

  it('gives direct cssVariables highest priority', () => {
    const { variables } = resolveThemeVariables({
      preset: 'midnight',
      colors: {
        primaryBase: '#10b981',
      },
      cssVariables: {
        '--color-primary-base': '#ff00ff',
        '--custom-var': '123px',
      },
    });

    expect(variables['--color-primary-base']).toBe('#ff00ff');
    expect(variables['--custom-var']).toBe('123px');
  });

  it('synthesizes Linear Light theme with each accent preset maintaining light surfaces and darkened hover', () => {
    const testCases: Array<{
      preset: string;
      expectedPrimary: string;
      expectedHover: string;
    }> = [
      { preset: 'default', expectedPrimary: '#5e6ad2', expectedHover: '#4b55c0' },
      { preset: 'emerald', expectedPrimary: '#10b981', expectedHover: '#059669' },
      { preset: 'ocean', expectedPrimary: '#0ea5e9', expectedHover: '#0284c7' },
      { preset: 'amber', expectedPrimary: '#f59e0b', expectedHover: '#d97706' },
      { preset: 'purple', expectedPrimary: '#8b5cf6', expectedHover: '#7c3aed' },
      { preset: 'midnight', expectedPrimary: '#06b6d4', expectedHover: '#0891b2' },
    ];

    testCases.forEach(({ preset, expectedPrimary, expectedHover }) => {
      const { variables, colorScheme } = resolveThemeVariables({
        preset,
        colorScheme: 'light',
      });

      expect(colorScheme).toBe('light');
      expect(variables['--color-primary-base']).toBe(expectedPrimary);
      expect(variables['--color-primary-hover']).toBe(expectedHover);
      expect(variables['--color-border-focus']).toBe(expectedPrimary);

      // Light surface tokens must be strictly preserved
      expect(variables['--color-surface-base']).toBe('#f7f8f9');
      expect(variables['--color-surface-panel']).toBe('#ffffff');
      expect(variables['--color-surface-hover']).toBe('#f0f1f4');
      expect(variables['--color-border-base']).toBe('#e2e4e8');
      expect(variables['--color-text-base']).toBe('#17171a');
      expect(variables['--color-text-muted']).toBe('#686b74');
      expect(variables['--color-text-inverse']).toBe('#ffffff');
    });
  });

  it('handles roomba alias in light mode', () => {
    const { variables, colorScheme } = resolveThemeVariables({
      preset: 'roomba',
      colorScheme: 'light',
    });

    expect(colorScheme).toBe('light');
    expect(variables['--color-primary-base']).toBe('#10b981');
    expect(variables['--color-primary-hover']).toBe('#059669');
    expect(variables['--color-surface-base']).toBe('#f7f8f9');
  });

  it('auto-darkens custom primary color hover in light mode when primaryHover is not provided', () => {
    const { variables } = resolveThemeVariables({
      preset: 'ocean',
      colorScheme: 'light',
      colors: {
        primaryBase: '#3b82f6', // blue-500
      },
    });

    expect(variables['--color-primary-base']).toBe('#3b82f6');
    expect(variables['--color-surface-base']).toBe('#f7f8f9');
    // Hover should be darkened from #3b82f6 (0.85 factor -> #326ed1)
    expect(variables['--color-primary-hover']).toBe('#326ed1');
  });

  it('provides metadata for dark/accent theme presets with titles and primary colors', () => {
    expect(DARK_THEME_PRESETS).toHaveLength(6);
    expect(ACCENT_THEME_PRESETS).toBe(DARK_THEME_PRESETS);
    expect(VALID_ACCENT_THEME_PRESET_IDS).toEqual(DARK_THEME_PRESETS.map((p) => p.id));
    const ids = DARK_THEME_PRESETS.map((p) => p.id);
    expect(ids).toEqual(['default', 'emerald', 'ocean', 'amber', 'purple', 'midnight']);

    DARK_THEME_PRESETS.forEach((preset) => {
      expect(preset.primaryBase).toBeTruthy();
      expect(preset.primaryColor).toBe(preset.primaryBase);
      expect(THEME_PRESETS[preset.id]).toBeDefined();
      expect(THEME_PRESETS[preset.id].primaryBase).toBe(preset.primaryBase);
    });
  });

  describe('darkenHex utility', () => {
    it('darkens standard 6-digit hex correctly', () => {
      // #ffffff * 0.85 = rgb(216, 216, 216) -> #d8d8d8
      expect(darkenHex('#ffffff', 0.85)).toBe('#d8d8d8');
      // #10b981 (16, 185, 129) * 0.85 = (13, 157, 109) -> #0d9d6d
      expect(darkenHex('#10b981', 0.85)).toBe('#0d9d6d');
    });

    it('darkens 3-digit shorthand hex correctly', () => {
      // #fff -> #ffffff * 0.85 -> #d8d8d8
      expect(darkenHex('#fff', 0.85)).toBe('#d8d8d8');
      expect(darkenHex('#000', 0.85)).toBe('#000000');
    });

    it('handles 8-digit hex by extracting rgb channels', () => {
      expect(darkenHex('#10b981ff', 0.85)).toBe('#0d9d6d');
    });

    it('clamps factor properly (0 to 1+)', () => {
      expect(darkenHex('#10b981', 0)).toBe('#000000');
      // Factor > 1 is clamped to max 255 per channel
      expect(darkenHex('#ffffff', 1.5)).toBe('#ffffff');
    });

    it('safely returns invalid hex string or empty without throwing', () => {
      expect(darkenHex('not_a_hex')).toBe('not_a_hex');
      expect(darkenHex('')).toBe('');
      expect(darkenHex(null as any)).toBe(null);
      expect(darkenHex(undefined as any)).toBe(undefined);
    });
  });
});

