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
    primaryHover: '#34d399',
    surfaceBase: '#080c0a',
    surfacePanel: '#101512',
    surfaceHover: 'rgba(255, 255, 255, 0.05)',
    surfaceActive: 'rgba(255, 255, 255, 0.08)',
    borderBase: 'rgba(255, 255, 255, 0.08)',
    borderFocus: '#10b981',
    borderError: '#ef4444',
    textBase: '#f7f8f8',
    textMuted: '#8a8f98',
    textInverse: '#ffffff',
    dangerBase: '#b91c1c',
    dangerHover: '#dc2626',
    accentAnchor: '#fbbf24',
    accentGenerator: '#10b981',
    accentReference: '#c084fc',
    accentAutomation: '#22d3ee',
    statusSuccess: '#10b981',
    statusWarning: '#f59e0b',
    occupancyFree: '#34d399',
    occupancyObstacle: '#fb7185',
    occupancyUnknown: '#c084fc',
    colorScheme: 'dark',
  },
  ocean: {
    primaryBase: '#0ea5e9',
    primaryHover: '#38bdf8',
    surfaceBase: '#080a0f',
    surfacePanel: '#0f131a',
    surfaceHover: 'rgba(255, 255, 255, 0.05)',
    surfaceActive: 'rgba(255, 255, 255, 0.08)',
    borderBase: 'rgba(255, 255, 255, 0.08)',
    borderFocus: '#0ea5e9',
    borderError: '#ef4444',
    textBase: '#f7f8f8',
    textMuted: '#8a8f98',
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
    primaryHover: '#fbbf24',
    surfaceBase: '#0c0a09',
    surfacePanel: '#161311',
    surfaceHover: 'rgba(255, 255, 255, 0.05)',
    surfaceActive: 'rgba(255, 255, 255, 0.08)',
    borderBase: 'rgba(255, 255, 255, 0.08)',
    borderFocus: '#f59e0b',
    borderError: '#ef4444',
    textBase: '#f7f8f8',
    textMuted: '#8a8f98',
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
    primaryHover: '#a78bfa',
    surfaceBase: '#09080e',
    surfacePanel: '#121018',
    surfaceHover: 'rgba(255, 255, 255, 0.05)',
    surfaceActive: 'rgba(255, 255, 255, 0.08)',
    borderBase: 'rgba(255, 255, 255, 0.08)',
    borderFocus: '#8b5cf6',
    borderError: '#ef4444',
    textBase: '#f7f8f8',
    textMuted: '#8a8f98',
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
    primaryHover: '#22d3ee',
    surfaceBase: '#000000',
    surfacePanel: '#0c0c0d',
    surfaceHover: 'rgba(255, 255, 255, 0.05)',
    surfaceActive: 'rgba(255, 255, 255, 0.08)',
    borderBase: 'rgba(255, 255, 255, 0.08)',
    borderFocus: '#06b6d4',
    borderError: '#ef4444',
    textBase: '#f7f8f8',
    textMuted: '#8a8f98',
    textInverse: '#ffffff',
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

export interface ThemePresetOption {
  id: string;
  name: string;
  title: string;
  label: string;
  primaryBase: string;
  primaryColor: string;
}

export const DARK_THEME_PRESETS: ThemePresetOption[] = [
  { id: 'default', name: 'Indigo', title: 'Indigo', label: 'Indigo', primaryBase: '#5e6ad2', primaryColor: '#5e6ad2' },
  { id: 'emerald', name: 'Emerald', title: 'Emerald', label: 'Emerald', primaryBase: '#10b981', primaryColor: '#10b981' },
  { id: 'ocean', name: 'Ocean', title: 'Ocean', label: 'Ocean', primaryBase: '#0ea5e9', primaryColor: '#0ea5e9' },
  { id: 'amber', name: 'Amber', title: 'Amber', label: 'Amber', primaryBase: '#f59e0b', primaryColor: '#f59e0b' },
  { id: 'purple', name: 'Purple', title: 'Purple', label: 'Purple', primaryBase: '#8b5cf6', primaryColor: '#8b5cf6' },
  { id: 'midnight', name: 'Midnight', title: 'Midnight', label: 'Midnight', primaryBase: '#06b6d4', primaryColor: '#06b6d4' },
];

export const THEME_PRESET_OPTIONS = DARK_THEME_PRESETS;
export const ACCENT_THEME_PRESETS = DARK_THEME_PRESETS;

export const VALID_ACCENT_THEME_PRESET_IDS: readonly string[] = DARK_THEME_PRESETS.map((p) => p.id);
export const VALID_DARK_THEME_PRESET_IDS = VALID_ACCENT_THEME_PRESET_IDS;
export const VALID_THEME_PRESET_IDS = VALID_ACCENT_THEME_PRESET_IDS;

/**
 * Light mode hover colors darkened to ensure strong contrast against light backgrounds.
 */
export const LIGHT_ACCENT_HOVERS: Record<string, string> = {
  default: '#4b55c0',
  emerald: '#059669',
  ocean: '#0284c7',
  amber: '#d97706',
  purple: '#7c3aed',
  midnight: '#0891b2',
};

/**
 * Darkens a hex color by a given factor (default 0.85).
 * Useful as a fallback for custom primary colors in light mode to ensure contrast.
 */
export function darkenHex(hex: string, factor = 0.85): string {
  if (!hex || typeof hex !== 'string') return hex;
  const trimmed = hex.trim();
  if (!/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return hex;
  }
  const cleaned = trimmed.replace(/^#/, '');
  let fullHex = cleaned;
  if (cleaned.length === 3) {
    fullHex = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  } else if (cleaned.length === 8) {
    fullHex = cleaned.slice(0, 6);
  }
  const num = parseInt(fullHex, 16);
  if (isNaN(num)) return hex;
  const clampedFactor = Math.max(0, factor);
  const r = Math.max(0, Math.min(255, Math.floor(((num >> 16) & 0xff) * clampedFactor)));
  const g = Math.max(0, Math.min(255, Math.floor(((num >> 8) & 0xff) * clampedFactor)));
  const b = Math.max(0, Math.min(255, Math.floor((num & 0xff) * clampedFactor)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Resolves a CustomUiTheme configuration into a map of CSS custom properties and color-scheme.
 * In Light mode, synthesizes a Linear Light theme with the chosen accent preset.
 * Priority: theme.cssVariables > theme.colors > Preset > Default
 */
export function resolveThemeVariables(theme?: CustomUiTheme): {
  variables: Record<string, string>;
  colorScheme: 'dark' | 'light';
} {
  const presetKey = theme?.preset || 'default';
  const effectiveAccentKey =
    presetKey === 'light'
      ? 'default'
      : presetKey === 'roomba'
      ? 'emerald'
      : presetKey === 'dark'
      ? 'default'
      : presetKey;

  const accentPreset = THEME_PRESETS[effectiveAccentKey] || THEME_PRESETS.default;

  const targetColorScheme: 'dark' | 'light' =
    theme?.colorScheme || (presetKey === 'light' ? 'light' : accentPreset.colorScheme);

  let base: ThemeColorSet;
  if (targetColorScheme === 'light') {
    const lightHover =
      LIGHT_ACCENT_HOVERS[effectiveAccentKey] || darkenHex(accentPreset.primaryBase);

    base = {
      ...THEME_PRESETS.light,
      primaryBase: accentPreset.primaryBase,
      primaryHover: lightHover,
      borderFocus: accentPreset.primaryBase,
      colorScheme: 'light',
    };
  } else {
    base = accentPreset;
  }

  const colors: Partial<CustomUiThemeColors> = theme?.colors || {};

  const merged: ThemeColorSet = {
    primaryBase: colors.primaryBase || base.primaryBase,
    primaryHover:
      colors.primaryHover ||
      (colors.primaryBase
        ? targetColorScheme === 'light'
          ? darkenHex(colors.primaryBase)
          : colors.primaryBase
        : base.primaryHover),
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
    colorScheme: targetColorScheme,
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
