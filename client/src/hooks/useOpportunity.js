/**
 * Loads one opportunity for reading.
 *
 * WHY NOT REUSE useOpportunityEditor, WHICH ALSO LOADS ONE. Because that hook is
 * built around writing: it holds the stored version specifically as the baseline a
 * patch is diffed against, and it carries create and update requests a student's
 * token would be refused for. Pointing a read-only page at it would mean importing
 * two mutations that must never fire and reading a field named `original` when
 * there is no edited version for it to be original to.
 *
 * Both call the same GET /opportunities/:id, which is the part that would be
 * genuine duplication if it were written twice — it is not; it lives in
 * api/opportunity.api.js and both hooks use it.
 *
 * A 404 is left exactly as the API sent it. The server answers "not found" for a
 * deleted posting and for someone else's draft with the same words on purpose, so
 * that an unpublished posting cannot be discovered by guessing ids. This hook does
 * not try to tell the two apart, because it cannot and should not.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchOpportunity } from '../api/opportunity.api.js';

/**
 * @param {string | undefined} opportunityId
 */
export default function useOpportunity(opportunityId) {
  const [opportunity, setOpportunity] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(opportunityId));
  const [loadError, setLoadError] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!opportunityId) {
      setOpportunity(null);
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const loaded = await fetchOpportunity(opportunityId);
      if (isMounted.current) setOpportunity(loaded);
      return loaded;
    } catch (error) {
      if (isMounted.current) {
        setLoadError(error);
        // Cleared so a failed reload cannot leave the previous posting on screen
        // under a new error message, which would read as if the error belonged to
        // the posting still visible.
        setOpportunity(null);
      }
      return null;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    load();
  }, [load]);

  return { opportunity, isLoading, loadError, reload: load };
}
