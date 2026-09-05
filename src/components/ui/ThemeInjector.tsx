import { useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import { BackendAPI } from '../../api';
import { resolveThemeVariables } from '../../utils/themePresets';

export function ThemeInjector() {
  const customUiConfig = useAppStore((state) => state.customUiConfig);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);
  const themeMode = useAppStore((state) => state.themeMode);
  const appliedVariablesRef = useRef<string[]>([]);

  useEffect(() => {
    // 1. CSS Variables Injection
    const root = document.documentElement;

    // Reset previously applied variables
    appliedVariablesRef.current.forEach((varName) => {
      root.style.removeProperty(varName);
    });
    root.style.removeProperty('color-scheme');
    appliedVariablesRef.current = [];

    // Custom UI theme takes precedence if specified; otherwise use themeMode ('dark' | 'light')
    const activeThemeConfig =
      isCustomUiMode && customUiConfig?.theme
        ? customUiConfig.theme
        : themeMode === 'light'
        ? { preset: 'light' as const }
        : undefined;

    if (activeThemeConfig) {
      const { variables, colorScheme } = resolveThemeVariables(activeThemeConfig);
      Object.entries(variables).forEach(([key, val]) => {
        root.style.setProperty(key, val);
        appliedVariablesRef.current.push(key);
      });
      root.style.setProperty('color-scheme', colorScheme);
      appliedVariablesRef.current.push('color-scheme');
    }

    // 2. Custom CSS Injection
    const existingStyle = document.getElementById('custom-ui-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    let isCancelled = false;

    if (isCustomUiMode && customUiConfig?.theme?.customCssPath) {
      const loadCustomCss = async () => {
        try {
          const cssContent = await BackendAPI.readTextFile(customUiConfig.theme!.customCssPath!);
          if (isCancelled) return;
          const styleEl = document.createElement('style');
          styleEl.id = 'custom-ui-style';
          styleEl.innerHTML = cssContent;
          document.head.appendChild(styleEl);
        } catch (err) {
          if (!isCancelled) {
            console.warn('Failed to load Custom UI CSS:', err);
          }
        }
      };
      loadCustomCss();
    }

    return () => {
      isCancelled = true;
      appliedVariablesRef.current.forEach((varName) => {
        root.style.removeProperty(varName);
      });
      root.style.removeProperty('color-scheme');
      appliedVariablesRef.current = [];
      const styleEl = document.getElementById('custom-ui-style');
      if (styleEl) {
        styleEl.remove();
      }
    };
  }, [customUiConfig, isCustomUiMode, themeMode]);

  return null;
}
