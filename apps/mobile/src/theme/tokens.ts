const fontFamily = {
  display: 'IBMPlexSans_700Bold',
  ui: 'IBMPlexSans_400Regular',
  mono: 'IBMPlexSans_600SemiBold',
} as const;

const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32 } as const;
const radius = { sm: 12, md: 18, lg: 24, xl: 30, pill: 999 } as const;
const fontSize = { display: 32, title: 22, heading: 18, body: 15, label: 13, caption: 12, mono: 16 } as const;

export const lightTheme = {
  colors: {
    background: '#F8F7FF',
    surface: '#FFFFFF',
    surfaceRaised: '#F3F1FF',
    surfaceTray: '#EDE9FE',

    brand: '#5B21B6',
    brandBright: '#7C3AED',
    brandSoft: '#EDE9FE',

    action: '#059669',
    actionBright: '#10B981',
    actionSoft: '#D1FAE5',

    ink: '#1E1B4B',
    inkSecondary: '#4338CA',
    inkMuted: '#6B7280',

    border: '#DDD6FE',
    borderStrong: '#A78BFA',

    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    success: '#059669',
    successSoft: '#D1FAE5',
    warning: '#D97706',
    warningSoft: '#FEF3C7',

    gold: '#F59E0B',
    silver: '#94A3B8',
    bronze: '#B45309',

    glassSurface: 'rgba(255,255,255,0.08)',
    glassBorder: 'rgba(255,255,255,0.18)',
    countdown: '#D97706',
    countdownSoft: '#FEF3C7',

    pillBrandBorder: '#C4B5FD',
    pillSuccessBorder: '#6EE7B7',
    pillDangerBorder: '#FCA5A5',
    pillWarnBorder: '#FDE68A',

    shadow: 'rgba(91, 33, 182, 0.08)',
    shadowStrong: 'rgba(91, 33, 182, 0.16)',
    white: '#FFFFFF',
  },
  spacing,
  radius,
  fontSize,
  fontFamily,
} as const;

export const darkTheme = {
  colors: {
    background: '#0D0B1E',
    surface: '#13102B',
    surfaceRaised: '#1A1640',
    surfaceTray: '#221E4A',

    brand: '#A78BFA',
    brandBright: '#C4B5FD',
    brandSoft: '#2E1F6B',

    action: '#10B981',
    actionBright: '#34D399',
    actionSoft: '#064E3B',

    ink: '#F5F3FF',
    inkSecondary: '#C4B5FD',
    inkMuted: '#9CA3AF',

    border: '#2E2A5E',
    borderStrong: '#4C3D8F',

    danger: '#F87171',
    dangerSoft: '#450A0A',
    success: '#34D399',
    successSoft: '#064E3B',
    warning: '#FCD34D',
    warningSoft: '#451A03',

    gold: '#F59E0B',
    silver: '#94A3B8',
    bronze: '#B45309',

    glassSurface: 'rgba(255,255,255,0.08)',
    glassBorder: 'rgba(255,255,255,0.18)',
    countdown: '#FCD34D',
    countdownSoft: '#451A03',

    pillBrandBorder: '#4C3D8F',
    pillSuccessBorder: '#065F46',
    pillDangerBorder: '#7F1D1D',
    pillWarnBorder: '#78350F',

    shadow: 'rgba(0, 0, 0, 0.40)',
    shadowStrong: 'rgba(0, 0, 0, 0.60)',
    white: '#FFFFFF',
  },
  spacing,
  radius,
  fontSize,
  fontFamily,
} as const;

export const themeNames = ['light', 'dark'] as const;

export type AppTheme = typeof lightTheme | typeof darkTheme;
export type AppThemeName = (typeof themeNames)[number];
export type ThemePreference = AppThemeName | 'system';
