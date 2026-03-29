import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Device from 'expo-device';

import { api, type OtpRequestResult, type SessionUser } from '@/lib/api';
import { clearSessionToken, readSessionToken, writeSessionToken } from '@/lib/storage';

function getDeviceFingerprint(): string {
  return [Device.brand, Device.modelName, Device.osName, Device.osVersion]
    .filter(Boolean)
    .join(':')
    .slice(0, 128);
}

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
  refreshUser(): Promise<void>;
  signOut(): Promise<void>;
  clearOtpRequest(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [otpRequest, setOtpRequest] = useState<OtpRequestResult | null>(null);

  useEffect(() => {
    void (async () => {
      const persistedToken = await readSessionToken();

      if (!persistedToken) {
        setStatus('signedOut');
        return;
      }

      try {
        const me = await api.me(persistedToken);
        setUser(me);
        setSessionToken(persistedToken);
        setStatus('signedIn');
      } catch {
        await clearSessionToken();
        setStatus('signedOut');
      }
    })();
  }, []);

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
        const response = await api.verifyOtp(input);
        await writeSessionToken(response.sessionToken);
        setSessionToken(response.sessionToken);
        setUser(response.user);
        setOtpRequest(null);
        setStatus('signedIn');
      },
      async refreshUser() {
        if (!sessionToken) {
          return;
        }

        const me = await api.me(sessionToken);
        setUser(me);
      },
      async signOut() {
        if (sessionToken) {
          await api.logout(sessionToken).catch(() => null);
        }

        await clearSessionToken();
        setSessionToken(null);
        setUser(null);
        setOtpRequest(null);
        setStatus('signedOut');
      },
      clearOtpRequest() {
        setOtpRequest(null);
      }
    }),
    [otpRequest, sessionToken, status, user]
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
