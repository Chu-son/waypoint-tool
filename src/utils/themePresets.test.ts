import { describe, it, expect } from 'vitest';
import { resolveThemeVariables, THEME_PRESETS } from './themePresets';

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
    expect(emeraldRes.variables['--color-surface-base']).toBe('#091e17');

    const roombaRes = resolveThemeVariables({ preset: 'roomba' });
    expect(roombaRes.variables['--color-primary-base']).toBe('#10b981');
    expect(roombaRes.variables['--color-surface-base']).toBe('#091e17');
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
});
