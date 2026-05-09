import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Device from 'expo-device';

import { api, type OtpRequestResult, type SessionUser } from '@/lib/api';
import { unregisterFromPush } from '@/lib/push';
import {
  clearAccessTokenExpiresAt,
  clearRefreshToken,
  clearSessionToken,
  readAccessTokenExpiresAt,
  readRefreshToken,
  readSessionToken,
  writeAccessTokenExpiresAt,
  writeRefreshToken,
  writeSessionToken
} from '@/lib/storage';

function getDeviceFingerprint(): string {
  return [Device.brand, Device.modelName, Device.osName, Device.osVersion]
    .filter(Boolean)
    .join(':')
    .slice(0, 128);
}

// Refresh the access token this many ms before it expires
const REFRESH_BEFORE_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  readonly status: AuthStatus;
  readonly user: SessionUser | null;
  readonly sessionToken: string | null;
  readonly otpRequest: OtpRequestResult | null;
  requestOtp(input: {
    readonly phone: string;
    readonly name?: string;
  }): Promise<OtpRequestResult>;
  verifyOtp(input: {
    readonly phone: string;
    readonly code: string;
    readonly name?: string;
    readonly email?: string;
  }): Promise<void>;
  /** Returns a valid access token, silently refreshing if near expiry. Use before API calls. */
  ensureValidToken(): Promise<string | null>;
  refreshUser(): Promise<void>;
  updateProfile(input: { readonly name?: string; readonly email?: string | null }): Promise<void>;
  signOut(): Promise<void>;
  clearOtpRequest(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [otpRequest, setOtpRequest] = useState<OtpRequestResult | null>(null);
  const accessTokenExpiresAtRef = useRef<Date | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAllTokens = useCallback(async () => {
    await Promise.all([clearSessionToken(), clearRefreshToken(), clearAccessTokenExpiresAt()]);
  }, []);

  const scheduleRefresh = useCallback((expiresAt: Date) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    const msUntilRefresh = expiresAt.getTime() - Date.now() - REFRESH_BEFORE_EXPIRY_MS;
    if (msUntilRefresh <= 0) return;

    refreshTimerRef.current = setTimeout(() => {
      void (async () => {
        const storedRefreshToken = await readRefreshToken();
        if (!storedRefreshToken) return;
        try {
          const result = await api.refreshTokens(storedRefreshToken);
          const newExpiresAt = new Date(result.accessTokenExpiresAt);
          await Promise.all([
            writeSessionToken(result.accessToken),
            writeRefreshToken(result.refreshToken),
            writeAccessTokenExpiresAt(newExpiresAt)
          ]);
          accessTokenExpiresAtRef.current = newExpiresAt;
          setSessionToken(result.accessToken);
          scheduleRefresh(newExpiresAt);
        } catch {
          // Refresh failed — sign out
          await clearAllTokens();
          setSessionToken(null);
          setUser(null);
          setOtpRequest(null);
          setStatus('signedOut');
        }
      })();
    }, msUntilRefresh);
  }, [clearAllTokens]);

  // Boot: restore session, silently refresh if access token is expired
  useEffect(() => {
    void (async () => {
      const [persistedToken, persistedRefreshToken, persistedExpiresAt] = await Promise.all([
        readSessionToken(),
        readRefreshToken(),
        readAccessTokenExpiresAt()
      ]);

      if (!persistedToken || !persistedRefreshToken) {
        setStatus('signedOut');
        return;
      }

      const now = new Date();
      const accessExpired = !persistedExpiresAt || persistedExpiresAt <= now;

      if (accessExpired) {
        // Access token expired — try silent refresh using refresh token
        try {
          const result = await api.refreshTokens(persistedRefreshToken);
          const newExpiresAt = new Date(result.accessTokenExpiresAt);
          await Promise.all([
            writeSessionToken(result.accessToken),
            writeRefreshToken(result.refreshToken),
            writeAccessTokenExpiresAt(newExpiresAt)
          ]);
          accessTokenExpiresAtRef.current = newExpiresAt;
          const me = await api.me(result.accessToken);
          setUser(me);
          setSessionToken(result.accessToken);
          setStatus('signedIn');
          scheduleRefresh(newExpiresAt);
        } catch {
          await clearAllTokens();
          setStatus('signedOut');
        }
        return;
      }

      // Access token still valid — use it directly
      try {
        const me = await api.me(persistedToken);
        accessTokenExpiresAtRef.current = persistedExpiresAt;
        setUser(me);
        setSessionToken(persistedToken);
        setStatus('signedIn');
        scheduleRefresh(persistedExpiresAt);
      } catch {
        await clearAllTokens();
        setStatus('signedOut');
      }
    })();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [clearAllTokens, scheduleRefresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionToken,
      otpRequest,
      async requestOtp(input) {
        const response = await api.requestOtp({ ...input, deviceId: getDeviceFingerprint() });
        setOtpRequest(response);
        return response;
      },
      async verifyOtp(input) {
        const response = await api.verifyOtp({ ...input, deviceId: getDeviceFingerprint() });
        const expiresAt = new Date(response.accessTokenExpiresAt);
        await Promise.all([
          writeSessionToken(response.accessToken),
          writeRefreshToken(response.refreshToken),
          writeAccessTokenExpiresAt(expiresAt)
        ]);
        accessTokenExpiresAtRef.current = expiresAt;
        setSessionToken(response.accessToken);
        setUser(response.user);
        setOtpRequest(null);
        setStatus('signedIn');
        scheduleRefresh(expiresAt);
      },
      async ensureValidToken() {
        const expiresAt = accessTokenExpiresAtRef.current;
        const isNearExpiry = !expiresAt || expiresAt.getTime() - Date.now() < REFRESH_BEFORE_EXPIRY_MS;

        if (!isNearExpiry && sessionToken) {
          return sessionToken;
        }

        const storedRefreshToken = await readRefreshToken();
        if (!storedRefreshToken) return null;

        try {
          const result = await api.refreshTokens(storedRefreshToken);
          const newExpiresAt = new Date(result.accessTokenExpiresAt);
          await Promise.all([
            writeSessionToken(result.accessToken),
            writeRefreshToken(result.refreshToken),
            writeAccessTokenExpiresAt(newExpiresAt)
          ]);
          accessTokenExpiresAtRef.current = newExpiresAt;
          setSessionToken(result.accessToken);
          scheduleRefresh(newExpiresAt);
          return result.accessToken;
        } catch {
          return null;
        }
      },
      async refreshUser() {
        if (!sessionToken) return;
        const me = await api.me(sessionToken);
        setUser(me);
      },
      async updateProfile(input) {
        if (!sessionToken) return;
        const updated = await api.updateMe(sessionToken, input);
        setUser(updated);
      },
      async signOut() {
        if (sessionToken) {
          try {
            await unregisterFromPush(sessionToken);
          } catch {
            // best-effort
          }
          await api.logout(sessionToken).catch(() => null);
        }
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
        }
        await clearAllTokens();
        accessTokenExpiresAtRef.current = null;
        setSessionToken(null);
        setUser(null);
        setOtpRequest(null);
        setStatus('signedOut');
      },
      clearOtpRequest() {
        setOtpRequest(null);
      }
    }),
    [clearAllTokens, otpRequest, scheduleRefresh, sessionToken, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
