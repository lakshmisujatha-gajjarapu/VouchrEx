const fontFamily = {
  headline: 'Manrope_700Bold',
  headlineExtra: 'Manrope_800ExtraBold',
  body: 'WorkSans_400Regular',
  label: 'WorkSans_500Medium',
  labelSemi: 'WorkSans_600SemiBold',
  mono: 'JetBrainsMono_500Medium',
  // Legacy aliases so existing inline style refs continue to resolve
  display: 'Manrope_700Bold',
  ui: 'WorkSans_400Regular',
} as const;

const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32 } as const;
const radius = { sm: 12, md: 18, lg: 24, xl: 30, pill: 999 } as const;
const fontSize = { display: 32, title: 22, heading: 18, body: 15, label: 13, caption: 12, mono: 16 } as const;

const blurIntensity = {
  low: 60,
  mid: 80,
  high: 95,
} as const;

const gradients = {
  // Sign-in / onboarding background sweep
  signIn:  ['#FAF8FF', '#F4F3FB', '#EBDDFF'] as const,
  // Brand violet button (4-stop for richer depth)
  brand:   ['#7C3AED', '#8B5CF6', '#9D77F5', '#A78BFA'] as const,
} as const;

const gradientsDark = {
  signIn:  ['#0D0B1E', '#1A173D', '#2E1F6B'] as const,
  brand:   ['#7C3AED', '#8B5CF6', '#9D77F5', '#A78BFA'] as const,
} as const;

export const lightTheme = {
  colors: {
    // Backgrounds
    background: '#FAF8FF',
    surface: '#FFFFFF',
    surfaceRaised: '#F4F3FB',   // surface-container-low
    surfaceTray: '#EEEDF5',     // surface-container
    surfaceHigh: '#E8E7EF',     // surface-container-high (inputs, chips unselected)
    surfaceHighest: '#E2E2E9',  // surface-container-highest

    // Brand (violet / secondary)
    brand: '#6E3ACA',
    brandBright: '#8856E5',
    brandSoft: '#EBDDFF',       // secondary-fixed

    // Action (emerald / primary)
    action: '#059669',
    actionBright: '#10B981',
    actionSoft: '#D1FAE5',
    actionFixed: '#85F8C4',     // primary-fixed — card accent stripe in light

    // Text
    ink: '#1A1B21',             // on-surface
    inkSecondary: '#4A4453',    // on-surface-variant
    inkMuted: '#7B7485',        // outline

    // Borders
    border: '#CCC3D6',          // outline-variant
    borderStrong: '#6E3ACA',    // brand color as strong border

    // Semantic
    danger: '#BA1A1A',
    dangerSoft: '#FFDAD6',
    success: '#59CD9C',         // on-primary-container
    successSoft: '#D1FAE5',
    warning: '#D97706',
    warningSoft: '#FEF3C7',

    // Badges
    gold: '#F59E0B',
    silver: '#94A3B8',
    bronze: '#B45309',

    // Glass
    glassSurface: '#FFFFFF14',
    glassSurfaceStrong: '#FFFFFF24',
    glassBorder: '#FFFFFF2E',
    glassBorderStrong: '#FFFFFF38',
    glassText: '#FFFFFFD6',

    // Timer
    countdown: '#D97706',
    countdownSoft: '#FEF3C7',

    // Pill borders
    pillBrandBorder: '#C4B5FD',
    pillSuccessBorder: '#6EE7B7',
    pillDangerBorder: '#FCA5A5',
    pillWarnBorder: '#FDE68A',

    // Shadows (ambient, low-opacity tinted)
    shadow: '#1A1B210A',
    shadowStrong: '#1A1B211A',

    // Decorative glows (ambient blobs on sign-in / hero sections)
    brandGlow: '#6E3ACA26',     // brand violet at 15%
    actionGlow: '#05966914',     // action emerald at 8%

    // Focus ring — form field focused border (brand at 20% opacity)
    focusRing: '#6E3ACA33',

    // Hairline divider — subtle separator between list items
    borderHair: '#CCC3D630',

    // Scrim — modal/overlay backdrop tint
    scrim: '#00000073',

    white: '#FFFFFF',
    transparent: 'transparent',
  },
  gradients,
  spacing,
  radius,
  fontSize,
  fontFamily,
  blurIntensity,
} as const;

export const darkTheme = {
  colors: {
    // Backgrounds
    background: '#0D0B1E',
    surface: '#13102B',         // surface-container
    surfaceRaised: '#1A173D',   // surface-container-low
    surfaceTray: '#13102B',     // surface-container
    surfaceHigh: '#1C1935',     // surface-container-high
    surfaceHighest: '#272445',  // surface-container-highest

    // Brand (violet — primary in dark)
    brand: '#A78BFA',
    brandBright: '#C4B5FD',
    brandSoft: '#4A3199',       // secondary-container dark

    // Action (emerald)
    action: '#34D399',
    actionBright: '#34D399',
    actionSoft: '#064E3B',
    actionFixed: '#68DBA9',     // primary-fixed-dim — card accent stripe in dark

    // Text
    ink: '#E2E2E9',             // on-surface dark
    inkSecondary: '#C4C5D0',    // on-surface-variant dark
    inkMuted: '#938F99',        // outline dark

    // Borders
    border: '#4A4453',          // outline-variant dark
    borderStrong: '#938F99',    // outline dark

    // Semantic
    danger: '#FFB4AB',
    dangerSoft: '#93000A',
    success: '#68DBA9',
    successSoft: '#064E3B',
    warning: '#FCD34D',
    warningSoft: '#451A03',

    // Badges
    gold: '#F59E0B',
    silver: '#94A3B8',
    bronze: '#B45309',

    // Glass
    glassSurface: '#FFFFFF14',
    glassSurfaceStrong: '#0D0B1E8C',
    glassBorder: '#FFFFFF2E',
    glassBorderStrong: '#A78BFA26',
    glassText: '#FFFFFFD6',

    // Timer
    countdown: '#FCD34D',
    countdownSoft: '#451A03',

    // Pill borders
    pillBrandBorder: '#4C3D8F',
    pillSuccessBorder: '#065F46',
    pillDangerBorder: '#7F1D1D',
    pillWarnBorder: '#78350F',

    // Shadows
    shadow: '#0000004D',
    shadowStrong: '#00000080',

    // Decorative glows
    brandGlow: '#A78BFA26',    // brand violet at 15% (dark)
    actionGlow: '#34D39914',    // action emerald at 8% (dark)

    // Focus ring
    focusRing: '#A78BFA33',

    // Hairline divider (dark uses surfaceHighest tone)
    borderHair: '#272445',

    // Scrim
    scrim: '#00000073',

    white: '#FFFFFF',
    transparent: 'transparent',
  },
  gradients: gradientsDark,
  spacing,
  radius,
  fontSize,
  fontFamily,
  blurIntensity,
} as const;

export const themeNames = ['light', 'dark'] as const;

export type AppTheme = typeof lightTheme | typeof darkTheme;
export type AppThemeName = (typeof themeNames)[number];
export type ThemePreference = AppThemeName | 'system';
