import { render } from '@testing-library/react';
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
    expect(root.style.getPropertyValue('--color-primary-base')).toBe('#2563eb');
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('#f8fafc');
    expect(root.style.getPropertyValue('color-scheme')).toBe('light');
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
