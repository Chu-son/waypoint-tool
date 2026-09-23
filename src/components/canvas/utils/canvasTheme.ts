/**
 * Resolves colors for the canvas fallback grid texture when no maps are loaded.
 * Under Option A (CAD / RViz approach), in light mode the viewport maintains high-contrast
 * dark charcoal styling (#121316 background, hairline grid lines, muted text) unless
 * customUiConfig explicitly defines custom surface colors.
 */
export function getFallbackGridColors(
  resolvedTheme: { variables: Record<string, string>; colorScheme: 'dark' | 'light' },
  hasExplicitCustomSurface: boolean,
): { bg: string; grid: string; text: string } {
  const isCadDarkViewport = resolvedTheme.colorScheme === 'light' && !hasExplicitCustomSurface;
  return {
    bg: isCadDarkViewport ? '#121316' : resolvedTheme.variables['--color-surface-panel'] || '#121316',
    grid: isCadDarkViewport ? 'rgba(255, 255, 255, 0.08)' : resolvedTheme.variables['--color-border-base'] || '#334155',
    text: isCadDarkViewport ? '#8a8f98' : resolvedTheme.variables['--color-text-muted'] || '#94a3b8',
  };
}
