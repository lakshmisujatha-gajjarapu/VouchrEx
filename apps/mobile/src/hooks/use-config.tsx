import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { SOCKET_EVENTS } from '@/constants';
import { api } from '@/lib/api';
import { useSocket } from './use-socket';

type PublicConfig = {
  readonly buyerFeeRate: number;
  readonly sellerCommissionRate: number;
  readonly listingMaxPriceInr: number;
};

const FALLBACK: PublicConfig = {
  buyerFeeRate: 0.10,
  sellerCommissionRate: 0.10,
  listingMaxPriceInr: 1000
};

type ConfigChangeBanner = {
  readonly title: string;
  readonly message: string;
};

type ConfigContextValue = PublicConfig & {
  readonly loading: boolean;
  refresh(): Promise<void>;
  /**
   * Set when a config change was detected since the user last dismissed.
   * Screens that care about a specific value (sell/edit) can render this as a
   * persistent in-page banner. Toast-style alerts are deliberately not used.
   */
  readonly changeBanner: ConfigChangeBanner | null;
  dismissChangeBanner(): void;
};

const ConfigContext = createContext<ConfigContextValue | null>(null);

function formatInr(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatPercent(rate: number): string {
  const pct = rate * 100;
  return Math.abs(pct - Math.round(pct)) < 1e-6 ? `${String(Math.round(pct))}%` : `${pct.toFixed(1)}%`;
}

function buildBanner(prev: PublicConfig, next: PublicConfig): ConfigChangeBanner | null {
  const lines: string[] = [];

  if (prev.listingMaxPriceInr !== next.listingMaxPriceInr) {
    if (next.listingMaxPriceInr > prev.listingMaxPriceInr) {
      lines.push(`You can now list vouchers up to ${formatInr(next.listingMaxPriceInr)}.`);
    } else {
      lines.push(`Listing cap is now ${formatInr(next.listingMaxPriceInr)}.`);
    }
  }
  if (prev.buyerFeeRate !== next.buyerFeeRate) {
    lines.push(`Buyer fee is now ${formatPercent(next.buyerFeeRate)}.`);
  }
  if (prev.sellerCommissionRate !== next.sellerCommissionRate) {
    lines.push(`Seller commission is now ${formatPercent(next.sellerCommissionRate)}.`);
  }

  if (lines.length === 0) return null;
  return {
    title: 'Marketplace settings updated',
    message: lines.join(' ')
  };
}

export function ConfigProvider({ children }: { readonly children: React.ReactNode }) {
  const [config, setConfig] = useState<PublicConfig>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [changeBanner, setChangeBanner] = useState<ConfigChangeBanner | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const configRef = useRef<PublicConfig>(FALLBACK);
  const hasLoadedOnceRef = useRef(false);
  const { socket } = useSocket();

  const applyConfig = useCallback((next: PublicConfig) => {
    const prev = configRef.current;
    configRef.current = next;
    setConfig(next);
    if (hasLoadedOnceRef.current) {
      const banner = buildBanner(prev, next);
      if (banner) setChangeBanner(banner);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const remote = await api.getPublicConfig();
      applyConfig({
        buyerFeeRate: remote.buyerFeeRate,
        sellerCommissionRate: remote.sellerCommissionRate,
        listingMaxPriceInr: remote.listingMaxPriceInr
      });
    } catch {
      // Network/error — keep fallback so app is usable offline-ish.
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    void load();

    const subscription = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        void load();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = (payload: PublicConfig) => {
      applyConfig({
        buyerFeeRate: payload.buyerFeeRate,
        sellerCommissionRate: payload.sellerCommissionRate,
        listingMaxPriceInr: payload.listingMaxPriceInr
      });
    };
    socket.on(SOCKET_EVENTS.CONFIG_UPDATED, handler);
    return () => {
      socket.off(SOCKET_EVENTS.CONFIG_UPDATED, handler);
    };
  }, [socket, applyConfig]);

  const dismissChangeBanner = useCallback(() => { setChangeBanner(null); }, []);

  const value = useMemo<ConfigContextValue>(
    () => ({
      ...config,
      loading,
      refresh: load,
      changeBanner,
      dismissChangeBanner
    }),
    [config, loading, load, changeBanner, dismissChangeBanner]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return ctx;
}
