import { useCallback, useEffect, useState } from 'react';

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

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const next = await load();
      setData(next);
      return next;
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Something went wrong.');
      return null;
    } finally {
      setLoading(false);
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
