/**
 * useNextActions — the role's Action Center, fetched from `/coach/next-actions`.
 *
 * A THIN WRAPPER OVER ONE ENDPOINT. The server picks the source from the signed-in
 * role and returns `{ role, title, actions }`, each action already ordered by
 * priority and grounded in real state. This hook fetches, holds and reloads them; it
 * ranks nothing, because a second ordering in the browser would eventually disagree
 * with the one the server computed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchNextActions } from '../api/coach.api.js';

export default function useNextActions({ autoLoad = true } = {}) {
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
      const loaded = await fetchNextActions();
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
  }, []);

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  return {
    title: data?.title ?? 'Your Next Actions',
    actions: data?.actions ?? [],
    isLoading,
    loadError,
    reload: load,
  };
}
