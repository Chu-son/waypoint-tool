import { useMemo } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { resolveThemeVariables } from '../../../utils/themePresets';
import { hexStringToNumber } from '../../../utils/colorUtils';
import { CANVAS_SURFACE_BASE, CANVAS_SURFACE_BASE_HEX } from '../canvasConstants';

/**
 * Theme values the canvas needs: the resolved theme, whether a custom UI config defines its own
 * surface colors, and the viewport background color.
 *
 * In light mode the viewport stays dark (CAD / RViz style) so ROS maps (free space = white) and
 * paths remain clearly visible, unless the custom UI explicitly overrides the surface color.
 */
export function useCanvasTheme() {
  const customUiConfig = useAppStore((state) => state.customUiConfig);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);
  const themeMode = useAppStore((state) => state.themeMode);
  const themePreset = useAppStore((state) => state.themePreset);

  const resolvedTheme = useMemo(() => {
    if (isCustomUiMode && customUiConfig?.theme) {
      return resolveThemeVariables(customUiConfig.theme);
    }
    return resolveThemeVariables({
      preset: themePreset || 'default',
      colorScheme: themeMode,
    });
  }, [isCustomUiMode, customUiConfig, themeMode, themePreset]);

  const hasExplicitCustomSurface = useMemo(() => {
    return Boolean(
      isCustomUiMode &&
      (customUiConfig?.theme?.colors?.surfaceBase ||
        customUiConfig?.theme?.colors?.surfacePanel ||
        customUiConfig?.theme?.cssVariables?.['--color-surface-base'] ||
        customUiConfig?.theme?.cssVariables?.['--color-surface-panel']),
    );
  }, [isCustomUiMode, customUiConfig]);

  const canvasBackgroundColor = useMemo(() => {
    if (!hasExplicitCustomSurface && resolvedTheme.colorScheme === 'light') {
      return CANVAS_SURFACE_BASE;
    }
    const surfaceBaseHex = resolvedTheme.variables['--color-surface-base'] || CANVAS_SURFACE_BASE_HEX;
    return hexStringToNumber(surfaceBaseHex, CANVAS_SURFACE_BASE);
  }, [resolvedTheme, hasExplicitCustomSurface]);

  return { resolvedTheme, hasExplicitCustomSurface, canvasBackgroundColor };
}
