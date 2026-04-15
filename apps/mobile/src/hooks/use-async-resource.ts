import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsyncResource<T>(
  load: () => Promise<T>,
  options?: {
    readonly enabled?: boolean;
  }
) {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const next = await load();
      if (id !== requestIdRef.current) return null; // stale — a newer request is in flight
      setData(next);
      return next;
    } catch (error_) {
      if (id !== requestIdRef.current) return null;
      setError(error_ instanceof Error ? error_.message : 'Something went wrong.');
      return null;
    } finally {
      if (id === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [load]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void reload();
  }, [enabled, reload]);

  return {
    data,
    error,
    loading,
    reload,
    setData
  };
}
