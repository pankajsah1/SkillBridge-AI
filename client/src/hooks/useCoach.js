/**
 * useCoach — the student AI Coach, fetched from `/coach/explanations`.
 *
 * A THIN WRAPPER OVER ONE ENDPOINT. The server answers a fixed set of employability
 * questions, each grounded in stored data, and optionally rewords them in natural
 * language. This hook fetches, holds and reloads them; it invents no answer, because
 * the whole point of the coach is that every sentence traces to real data.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchCoach } from '../api/coach.api.js';

export default function useCoach({ careerRoleId, autoLoad = true } = {}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [loadError, setLoadError] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const loaded = await fetchCoach({ careerRoleId });
      if (isMounted.current) setData(loaded);
      return loaded;
    } catch (error) {
      if (isMounted.current) {
        setLoadError(error);
        setData(null);
      }
      return null;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [careerRoleId]);

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  return {
    coach: data,
    aiEnabled: data?.aiEnabled ?? false,
    careerRole: data?.careerRole ?? null,
    readinessScore: data?.readinessScore ?? null,
    explanations: data?.explanations ?? [],
    isLoading,
    loadError,
    reload: load,
  };
}
