import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Executa `fetcher` imediatamente e depois a cada `intervalMs` (padrão 30s),
 * sem recarregar a página. Retorna estado de carregamento, timestamp da
 * última atualização e uma função para atualizar manualmente.
 */
export function usePolling<T>(fetcher: () => Promise<T>, deps: any[] = [], intervalMs = 30000) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erro ao atualizar dados.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    run();
    const id = setInterval(() => run(false), intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = useCallback(() => run(true), [run]);

  return { data, loading, refreshing, lastUpdated, error, refresh };
}
