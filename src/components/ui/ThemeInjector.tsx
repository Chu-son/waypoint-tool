import { useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import { BackendAPI } from '../../api';

export function ThemeInjector() {
  const customUiConfig = useAppStore((state) => state.customUiConfig);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);
  const appliedVariablesRef = useRef<string[]>([]);

  useEffect(() => {
    // 1. CSS Variables Injection
    const root = document.documentElement;

    // Reset previously applied variables
    appliedVariablesRef.current.forEach((varName) => {
      root.style.removeProperty(varName);
    });
    appliedVariablesRef.current = [];

    if (isCustomUiMode && customUiConfig?.theme?.cssVariables) {
      const vars = customUiConfig.theme.cssVariables;
      Object.entries(vars).forEach(([key, val]) => {
        root.style.setProperty(key, val);
        appliedVariablesRef.current.push(key);
      });
    }

    // 2. Custom CSS Injection
    const existingStyle = document.getElementById('custom-ui-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    if (isCustomUiMode && customUiConfig?.theme?.customCssPath) {
      const loadCustomCss = async () => {
        try {
          const cssContent = await BackendAPI.readTextFile(customUiConfig.theme!.customCssPath!);
          const styleEl = document.createElement('style');
          styleEl.id = 'custom-ui-style';
          styleEl.innerHTML = cssContent;
          document.head.appendChild(styleEl);
        } catch (err) {
          console.warn('Failed to load Custom UI CSS:', err);
        }
      };
      loadCustomCss();
    }

    return () => {
      appliedVariablesRef.current.forEach((varName) => {
        root.style.removeProperty(varName);
      });
      appliedVariablesRef.current = [];
      const styleEl = document.getElementById('custom-ui-style');
      if (styleEl) {
        styleEl.remove();
      }
    };
  }, [customUiConfig, isCustomUiMode]);

  return null;
}
