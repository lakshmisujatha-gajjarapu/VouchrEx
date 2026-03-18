import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'nativewind';

import { darkTheme, lightTheme } from '@/theme/tokens';
import type { AppTheme, ThemePreference } from '@/theme/tokens';

const ThemeContext = createContext<AppTheme>(lightTheme);

export function ThemeProvider({
  children,
  preference,
}: {
  readonly children: React.ReactNode;
  readonly preference: ThemePreference;
}) {
  const nativeWindColorScheme = useColorScheme();
  const colorScheme = nativeWindColorScheme.colorScheme;

  useEffect(() => {
    nativeWindColorScheme.setColorScheme(preference);
  }, [nativeWindColorScheme, preference]);

  const theme = useMemo(() => {
    const effective = preference === 'system' ? (colorScheme ?? 'light') : preference;
    return effective === 'dark' ? darkTheme : lightTheme;
  }, [colorScheme, preference]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  return useContext(ThemeContext);
}
