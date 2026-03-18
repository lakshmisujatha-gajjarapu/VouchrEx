import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { readThemePreference, writeThemePreference } from '@/lib/storage';
import type { ThemePreference } from '@/theme/tokens';

type ThemePreferenceContextValue = {
  readonly preference: ThemePreference;
  readonly ready: boolean;
  setPreference(preference: ThemePreference): Promise<void>;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({
  children,
  fallback = null,
}: {
  readonly children: React.ReactNode;
  readonly fallback?: React.ReactNode;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    void (async () => {
      try {
        const persisted = await readThemePreference();
        if (!mountedRef.current) return;
        setPreferenceState(persisted);
      } finally {
        if (mountedRef.current) setReady(true);
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const value = useMemo<ThemePreferenceContextValue>(
    () => ({
      preference,
      ready,
      async setPreference(next) {
        setPreferenceState(next);
        await writeThemePreference(next).catch(() => undefined);
      },
    }),
    [preference, ready],
  );

  if (!ready) return <>{fallback}</>;

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const context = useContext(ThemePreferenceContext);
  if (!context) throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  return context;
}
