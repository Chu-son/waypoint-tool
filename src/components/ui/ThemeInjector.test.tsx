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
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#091e17');
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

  it('resets variables when themeMode switches from light to dark in standard mode', () => {
    useAppStore.setState({
      isCustomUiMode: false,
      themeMode: 'light',
    });

    const { rerender } = render(<ThemeInjector />);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#f7f8f9');

    act(() => {
      useAppStore.setState({ themeMode: 'dark' });
    });
    rerender(<ThemeInjector />);

    expect(root.style.getPropertyValue('--color-surface-base')).toBe('');
    expect(root.style.getPropertyValue('color-scheme')).toBe('');
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
