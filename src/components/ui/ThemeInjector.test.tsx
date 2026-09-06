import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeInjector } from './ThemeInjector';
import { useAppStore } from '../../stores/appStore';

describe('ThemeInjector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.style.cssText = '';
    useAppStore.setState({
      customUiConfig: null,
      isCustomUiMode: false,
      themeMode: 'dark',
      themePreset: 'default',
    });
  });

  it('injects preset theme CSS variables into document.documentElement when Custom UI mode is active', () => {
    useAppStore.setState({
      isCustomUiMode: true,
      customUiConfig: {
        theme: {
          preset: 'emerald',
        },
      },
    });

    render(<ThemeInjector />);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#10b981');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#080c0a');
    expect(root.style.getPropertyValue('color-scheme')).toBe('dark');
  });

  it('injects light theme preset and colorScheme into document.documentElement', () => {
    useAppStore.setState({
      isCustomUiMode: true,
      customUiConfig: {
        theme: {
          preset: 'light',
        },
      },
    });

    render(<ThemeInjector />);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#5e6ad2');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#f7f8f9');
    expect(root.style.getPropertyValue('color-scheme')).toBe('light');
  });

  it('injects Linear Light theme CSS variables when themeMode is light in standard mode', () => {
    useAppStore.setState({
      isCustomUiMode: false,
      themeMode: 'light',
    });

    render(<ThemeInjector />);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#5e6ad2');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#f7f8f9');
    expect(root.style.getPropertyValue('color-scheme')).toBe('light');
  });

  it('injects dark theme preset CSS variables in standard dark mode', () => {
    useAppStore.setState({
      isCustomUiMode: false,
      themeMode: 'dark',
      themePreset: 'ocean',
    });

    render(<ThemeInjector />);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#0ea5e9');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#080a0f');
    expect(root.style.getPropertyValue('color-scheme')).toBe('dark');
  });

  it('updates CSS variables when themePreset changes in standard dark mode', () => {
    useAppStore.setState({
      isCustomUiMode: false,
      themeMode: 'dark',
      themePreset: 'default',
    });

    const { rerender } = render(<ThemeInjector />);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#5e6ad2');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#090a0c');

    act(() => {
      useAppStore.setState({ themePreset: 'amber' });
    });
    rerender(<ThemeInjector />);

    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#f59e0b');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#0c0a09');
  });

  it('applies chosen themePreset in standard light mode', () => {
    useAppStore.setState({
      isCustomUiMode: false,
      themeMode: 'light',
      themePreset: 'ocean',
    });

    render(<ThemeInjector />);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#0ea5e9');
    expect(root.style.getPropertyValue('--color-primary-hover')).toBe('#0284c7');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#f7f8f9');
    expect(root.style.getPropertyValue('color-scheme')).toBe('light');
  });

  it('updates CSS variables when themePreset changes in standard light mode', () => {
    useAppStore.setState({
      isCustomUiMode: false,
      themeMode: 'light',
      themePreset: 'emerald',
    });

    const { rerender } = render(<ThemeInjector />);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#10b981');
    expect(root.style.getPropertyValue('--color-primary-hover')).toBe('#059669');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#f7f8f9');

    act(() => {
      useAppStore.setState({ themePreset: 'purple' });
    });
    rerender(<ThemeInjector />);

    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#8b5cf6');
    expect(root.style.getPropertyValue('--color-primary-hover')).toBe('#7c3aed');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#f7f8f9');
  });

  it('switches between light mode and dark mode while preserving chosen accent themePreset', () => {
    useAppStore.setState({
      isCustomUiMode: false,
      themeMode: 'light',
      themePreset: 'emerald',
    });

    const { rerender } = render(<ThemeInjector />);
    const root = document.documentElement;
    // In light mode with emerald preset: primary is #10b981, light surface is #f7f8f9, hover is #059669
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#10b981');
    expect(root.style.getPropertyValue('--color-primary-hover')).toBe('#059669');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#f7f8f9');
    expect(root.style.getPropertyValue('color-scheme')).toBe('light');

    act(() => {
      useAppStore.setState({ themeMode: 'dark' });
    });
    rerender(<ThemeInjector />);

    // In dark mode with emerald preset: primary is #10b981, dark surface is #080c0a, hover is #34d399
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#10b981');
    expect(root.style.getPropertyValue('--color-primary-hover')).toBe('#34d399');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#080c0a');
    expect(root.style.getPropertyValue('color-scheme')).toBe('dark');
  });

  it('normalizes legacy aliases and updates CSS variables when setThemePreset action is called', () => {
    useAppStore.setState({
      isCustomUiMode: false,
      themeMode: 'dark',
      themePreset: 'default',
    });

    render(<ThemeInjector />);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#5e6ad2');

    // Test legacy 'roomba' alias -> normalizes to 'emerald'
    act(() => {
      useAppStore.getState().setThemePreset('roomba');
    });
    expect(useAppStore.getState().themePreset).toBe('emerald');
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#10b981');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#080c0a');

    // Test legacy 'dark' alias -> normalizes to 'default'
    act(() => {
      useAppStore.getState().setThemePreset('dark');
    });
    expect(useAppStore.getState().themePreset).toBe('default');
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#5e6ad2');

    // Test invalid preset -> falls back to 'default'
    act(() => {
      useAppStore.getState().setThemePreset('unknown_preset_xyz');
    });
    expect(useAppStore.getState().themePreset).toBe('default');
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#5e6ad2');
  });

  it('allows overriding colors in theme', () => {
    useAppStore.setState({
      isCustomUiMode: true,
      customUiConfig: {
        theme: {
          preset: 'ocean',
          colors: {
            primaryBase: '#ff0055',
          },
        },
      },
    });

    render(<ThemeInjector />);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#ff0055');
  });

  it('resets injected variables when Custom UI mode is disabled', () => {
    useAppStore.setState({
      isCustomUiMode: true,
      customUiConfig: {
        theme: {
          preset: 'emerald',
        },
      },
    });

    const { unmount } = render(<ThemeInjector />);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#10b981');

    unmount();
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('');
    expect(root.style.getPropertyValue('color-scheme')).toBe('');
  });
});
