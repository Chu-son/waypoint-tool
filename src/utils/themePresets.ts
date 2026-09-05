import { CustomUiTheme, CustomUiThemeColors } from '../types/customUi';

export interface ThemeColorSet {
  primaryBase: string;
  primaryHover: string;
  surfaceBase: string;
  surfacePanel: string;
  surfaceHover: string;
  surfaceActive?: string;
  borderBase: string;
  borderFocus: string;
  borderError: string;
  textBase: string;
  textMuted: string;
  textInverse: string;
  dangerBase: string;
  dangerHover: string;
  accentAnchor: string;
  accentGenerator: string;
  accentReference: string;
  accentAutomation: string;
  statusSuccess: string;
  statusWarning: string;
  occupancyFree: string;
  occupancyObstacle: string;
  occupancyUnknown: string;
  colorScheme: 'dark' | 'light';
}

export const THEME_PRESETS: Record<string, ThemeColorSet> = {
  default: {
    primaryBase: '#5e6ad2',
    primaryHover: '#6f7be8',
    surfaceBase: '#090a0c',
    surfacePanel: '#121316',
    surfaceHover: 'rgba(255, 255, 255, 0.05)',
    surfaceActive: 'rgba(255, 255, 255, 0.08)',
    borderBase: 'rgba(255, 255, 255, 0.08)',
    borderFocus: '#5e6ad2',
    borderError: '#ef4444',
    textBase: '#f7f8f8',
    textMuted: '#8a8f98',
    textInverse: '#ffffff',
    dangerBase: '#b91c1c',
    dangerHover: '#dc2626',
    accentAnchor: '#fbbf24',
    accentGenerator: '#34d399',
    accentReference: '#c084fc',
    accentAutomation: '#22d3ee',
    statusSuccess: '#10b981',
    statusWarning: '#f59e0b',
    occupancyFree: '#34d399',
    occupancyObstacle: '#fb7185',
    occupancyUnknown: '#c084fc',
    colorScheme: 'dark',
  },
  emerald: {
    primaryBase: '#10b981',
    primaryHover: '#059669',
    surfaceBase: '#091e17',
    surfacePanel: '#112e24',
    surfaceHover: '#1a4234',
    borderBase: '#1d4e3e',
    borderFocus: '#10b981',
    borderError: '#ef4444',
    textBase: '#ecfdf5',
    textMuted: '#6ee7b7',
    textInverse: '#ffffff',
    dangerBase: '#b91c1c',
    dangerHover: '#dc2626',
    accentAnchor: '#fbbf24',
    accentGenerator: '#10b981',
    accentReference: '#c084fc',
    accentAutomation: '#22d3ee',
    statusSuccess: '#10b981',
    statusWarning: '#f59e0b',
    occupancyFree: '#10b981',
    occupancyObstacle: '#fb7185',
    occupancyUnknown: '#c084fc',
    colorScheme: 'dark',
  },
  ocean: {
    primaryBase: '#0284c7',
    primaryHover: '#0369a1',
    surfaceBase: '#030712',
    surfacePanel: '#0f172a',
    surfaceHover: '#1e293b',
    borderBase: '#1e293b',
    borderFocus: '#38bdf8',
    borderError: '#ef4444',
    textBase: '#f0f9ff',
    textMuted: '#7dd3fc',
    textInverse: '#ffffff',
    dangerBase: '#b91c1c',
    dangerHover: '#dc2626',
    accentAnchor: '#fbbf24',
    accentGenerator: '#38bdf8',
    accentReference: '#a78bfa',
    accentAutomation: '#06b6d4',
    statusSuccess: '#10b981',
    statusWarning: '#f59e0b',
    occupancyFree: '#38bdf8',
    occupancyObstacle: '#fb7185',
    occupancyUnknown: '#a78bfa',
    colorScheme: 'dark',
  },
  amber: {
    primaryBase: '#f59e0b',
    primaryHover: '#d97706',
    surfaceBase: '#18181b',
    surfacePanel: '#27272a',
    surfaceHover: '#3f3f46',
    borderBase: '#3f3f46',
    borderFocus: '#fbbf24',
    borderError: '#ef4444',
    textBase: '#fafaf9',
    textMuted: '#a1a1aa',
    textInverse: '#ffffff',
    dangerBase: '#b91c1c',
    dangerHover: '#dc2626',
    accentAnchor: '#f59e0b',
    accentGenerator: '#34d399',
    accentReference: '#c084fc',
    accentAutomation: '#22d3ee',
    statusSuccess: '#10b981',
    statusWarning: '#f59e0b',
    occupancyFree: '#34d399',
    occupancyObstacle: '#fb7185',
    occupancyUnknown: '#c084fc',
    colorScheme: 'dark',
  },
  purple: {
    primaryBase: '#8b5cf6',
    primaryHover: '#7c3aed',
    surfaceBase: '#0f0728',
    surfacePanel: '#1e1145',
    surfaceHover: '#2e1c68',
    borderBase: '#3b2582',
    borderFocus: '#a78bfa',
    borderError: '#ef4444',
    textBase: '#f5f3ff',
    textMuted: '#c4b5fd',
    textInverse: '#ffffff',
    dangerBase: '#b91c1c',
    dangerHover: '#dc2626',
    accentAnchor: '#fbbf24',
    accentGenerator: '#a78bfa',
    accentReference: '#8b5cf6',
    accentAutomation: '#22d3ee',
    statusSuccess: '#10b981',
    statusWarning: '#f59e0b',
    occupancyFree: '#a78bfa',
    occupancyObstacle: '#fb7185',
    occupancyUnknown: '#8b5cf6',
    colorScheme: 'dark',
  },
  midnight: {
    primaryBase: '#06b6d4',
    primaryHover: '#0891b2',
    surfaceBase: '#000000',
    surfacePanel: '#121212',
    surfaceHover: '#242424',
    borderBase: '#2a2a2a',
    borderFocus: '#06b6d4',
    borderError: '#ef4444',
    textBase: '#ffffff',
    textMuted: '#888888',
    textInverse: '#000000',
    dangerBase: '#b91c1c',
    dangerHover: '#dc2626',
    accentAnchor: '#fbbf24',
    accentGenerator: '#06b6d4',
    accentReference: '#c084fc',
    accentAutomation: '#06b6d4',
    statusSuccess: '#10b981',
    statusWarning: '#f59e0b',
    occupancyFree: '#06b6d4',
    occupancyObstacle: '#fb7185',
    occupancyUnknown: '#c084fc',
    colorScheme: 'dark',
  },
  light: {
    primaryBase: '#5e6ad2',
    primaryHover: '#4b55c0',
    surfaceBase: '#f7f8f9',
    surfacePanel: '#ffffff',
    surfaceHover: '#f0f1f4',
    surfaceActive: 'rgba(0, 0, 0, 0.07)',
    borderBase: '#e2e4e8',
    borderFocus: '#5e6ad2',
    borderError: '#ef4444',
    textBase: '#17171a',
    textMuted: '#686b74',
    textInverse: '#ffffff',
    dangerBase: '#dc2626',
    dangerHover: '#b91c1c',
    accentAnchor: '#d97706',
    accentGenerator: '#059669',
    accentReference: '#7c3aed',
    accentAutomation: '#0891b2',
    statusSuccess: '#16a34a',
    statusWarning: '#d97706',
    occupancyFree: '#059669',
    occupancyObstacle: '#e11d48',
    occupancyUnknown: '#7c3aed',
    colorScheme: 'light',
  },
};

// "roomba" alias for "emerald"
THEME_PRESETS.roomba = THEME_PRESETS.emerald;
// "dark" alias for "default"
THEME_PRESETS.dark = THEME_PRESETS.default;

/**
 * Resolves a CustomUiTheme configuration into a map of CSS custom properties and color-scheme.
 * Priority: theme.cssVariables > theme.colors > THEME_PRESETS[preset] > THEME_PRESETS.default
 */
export function resolveThemeVariables(theme?: CustomUiTheme): {
  variables: Record<string, string>;
  colorScheme: 'dark' | 'light';
} {
  const presetKey = theme?.preset || 'default';
  const base = THEME_PRESETS[presetKey] || THEME_PRESETS.default;
  const colors: Partial<CustomUiThemeColors> = theme?.colors || {};

  const merged: ThemeColorSet = {
    primaryBase: colors.primaryBase || base.primaryBase,
    primaryHover: colors.primaryHover || (colors.primaryBase ? colors.primaryBase : base.primaryHover),
    surfaceBase: colors.surfaceBase || base.surfaceBase,
    surfacePanel: colors.surfacePanel || base.surfacePanel,
    surfaceHover: colors.surfaceHover || base.surfaceHover,
    surfaceActive:
      colors.surfaceActive ||
      base.surfaceActive ||
      (base.colorScheme === 'light' ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.08)'),
    borderBase: colors.borderBase || base.borderBase,
    borderFocus: colors.borderFocus || (colors.primaryBase ? colors.primaryBase : base.borderFocus),
    borderError: colors.borderError || base.borderError,
    textBase: colors.textBase || base.textBase,
    textMuted: colors.textMuted || base.textMuted,
    textInverse: colors.textInverse || base.textInverse,
    dangerBase: colors.dangerBase || base.dangerBase,
    dangerHover: colors.dangerHover || base.dangerHover,
    accentAnchor: colors.accentAnchor || base.accentAnchor,
    accentGenerator: colors.accentGenerator || base.accentGenerator,
    accentReference: colors.accentReference || base.accentReference,
    accentAutomation: colors.accentAutomation || base.accentAutomation,
    statusSuccess: colors.statusSuccess || base.statusSuccess,
    statusWarning: colors.statusWarning || base.statusWarning,
    occupancyFree: colors.occupancyFree || base.occupancyFree,
    occupancyObstacle: colors.occupancyObstacle || base.occupancyObstacle,
    occupancyUnknown: colors.occupancyUnknown || base.occupancyUnknown,
    colorScheme: theme?.colorScheme || base.colorScheme,
  };

  const variables: Record<string, string> = {
    '--color-surface-base': merged.surfaceBase,
    '--color-surface-panel': merged.surfacePanel,
    '--color-surface-hover': merged.surfaceHover,
    '--color-surface-active': merged.surfaceActive || (merged.colorScheme === 'light' ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.08)'),
    '--color-border-base': merged.borderBase,
    '--color-border-focus': merged.borderFocus,
    '--color-border-error': merged.borderError,
    '--color-text-base': merged.textBase,
    '--color-text-muted': merged.textMuted,
    '--color-text-inverse': merged.textInverse,
    '--color-primary-base': merged.primaryBase,
    '--color-primary-hover': merged.primaryHover,
    '--color-danger-base': merged.dangerBase,
    '--color-danger-hover': merged.dangerHover,
    '--color-accent-anchor': merged.accentAnchor,
    '--color-accent-generator': merged.accentGenerator,
    '--color-accent-reference': merged.accentReference,
    '--color-accent-automation': merged.accentAutomation,
    '--color-status-success': merged.statusSuccess,
    '--color-status-warning': merged.statusWarning,
    '--color-occupancy-free': merged.occupancyFree,
    '--color-occupancy-obstacle': merged.occupancyObstacle,
    '--color-occupancy-unknown': merged.occupancyUnknown,
  };

  // Direct CSS variables override takes highest priority
  if (theme?.cssVariables) {
    Object.assign(variables, theme.cssVariables);
  }

  return {
    variables,
    colorScheme: merged.colorScheme,
  };
}
