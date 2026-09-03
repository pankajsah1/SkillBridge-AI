/**
 * "Recommended for you" — programmes chosen from this student's real skill gaps.
 *
 * A THIN WRAPPER OVER ONE ENDPOINT, ON PURPOSE. Every judgement in the response is
 * the server's: which gaps count, which programmes cover them, the order, the
 * `priority` band, the `reasons` sentences, the `coverage` figures and the
 * `readinessScore` they are measured against. This hook fetches and holds them. It
 * does not sort, score, filter or explain, because a second ranking computed in the
 * browser would eventually disagree with the one the readiness page shows for the
 * same student.
 *
 * `reason` IS A STATE, NOT AN ERROR. 'no-profile', 'no-career-goal', 'no-gaps' and
 * 'no-programs' each mean the list is legitimately empty for a different reason, and
 * each deserves different words on screen — so it is returned as-is rather than
 * flattened into `loadError`. An empty array with a reason is a successful response.
 *
 * `careerRoleId` is optional and behaves exactly as it does on the readiness page:
 * omitted means "use my primary career goal", which is what the server does too.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchLearningRecommendations } from '../api/learning.api.js';

/** What an unanswered request looks like, so no consumer has to guard on null. */
const emptyResult = () => ({
  recommendations: [],
  careerRole: null,
  readinessScore: null,
  reason: null,
  gapsConsidered: 0,
  uncoveredGaps: [],
});

/**
 * @param {{careerRoleId?: string, limit?: number, autoLoad?: boolean}} [options]
 */
export default function useLearningRecommendations({
  careerRoleId,
  limit,
  autoLoad = true,
} = {}) {
  const [result, setResult] = useState(emptyResult);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [loadError, setLoadError] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /** Switching roles quickly must not let an earlier answer land last. */
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;

    setIsLoading(true);
    setLoadError(null);

    try {
      const loaded = await fetchLearningRecommendations({
        careerRoleId: careerRoleId || undefined,
        limit,
      });

      if (isMounted.current && id === requestId.current) {
        setResult({
          recommendations: loaded.recommendations ?? [],
          careerRole: loaded.careerRole ?? null,
          readinessScore: loaded.readinessScore ?? null,
          reason: loaded.reason ?? null,
          gapsConsidered: loaded.gapsConsidered ?? 0,
          uncoveredGaps: loaded.uncoveredGaps ?? [],
        });
      }

      return loaded;
    } catch (error) {
      if (isMounted.current && id === requestId.current) {
        setLoadError(error);
        // Cleared so a stale role's recommendations cannot sit under an error
        // about a different one.
        setResult(emptyResult());
      }
      return null;
    } finally {
      if (isMounted.current && id === requestId.current) setIsLoading(false);
    }
  }, [careerRoleId, limit]);

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  return {
    ...result,
    isLoading,
    loadError,
    reload: load,
  };
}
