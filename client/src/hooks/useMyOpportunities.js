/**
 * Owns the signed-in company's own postings: loading them, filtering them, and
 * every mutation to them.
 *
 * Same shape as useStudentProfile.js — an `isMounted` guard, one `mutate()` funnel
 * that every write goes through, and actions named for what the employer did
 * rather than for the HTTP verb. Two hooks with the same internal contract is
 * cheaper to reason about than two hooks with two contracts.
 *
 * WHY MUTATIONS RELOAD THE LIST INSTEAD OF PATCHING IT IN PLACE. Closing a
 * posting changes the summary counts, and publishing a draft changes which
 * `status` filter it belongs to. Splicing the returned document into local state
 * would leave the counts and the filter stale, so the list would disagree with
 * itself until the next navigation. A refetch is one request at hackathon scale
 * and it cannot drift.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  deleteOpportunity as deleteOpportunityRequest,
  fetchMyOpportunities,
  updateOpportunity as updateOpportunityRequest,
} from '../api/opportunity.api.js';
import { OPPORTUNITY_PAGE, OPPORTUNITY_STATUSES } from '../constants/opportunities.js';

/** No status, no type, no search — the unfiltered management view. */
export const emptyOwnerFilters = () => ({ status: '', type: '', search: '' });

/**
 * @param {{autoLoad?: boolean, limit?: number}} [options]
 */
export default function useMyOpportunities({
  autoLoad = true,
  limit = OPPORTUNITY_PAGE.defaultLimit,
} = {}) {
  const [opportunities, setOpportunities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState(null);

  const [filters, setFilters] = useState(emptyOwnerFilters);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(autoLoad);
  const [loadError, setLoadError] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  /**
   * Guards against setting state after the component has gone.
   *
   * Without it, navigating away mid-request logs a warning and, worse, can
   * resurrect a stale error onto a page that has already moved on.
   */
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Identifies the most recent request, so a slow earlier one cannot overwrite it.
   *
   * Typing in the search box fires several loads; without this, whichever
   * *responds* last wins rather than whichever was *asked* last, and the list can
   * settle on results for a query the employer already deleted.
   */
  const requestId = useRef(0);

  const load = useCallback(
    async (overrides = {}) => {
      const id = ++requestId.current;

      setIsLoading(true);
      setLoadError(null);

      const query = {
        status: overrides.status ?? filters.status,
        type: overrides.type ?? filters.type,
        search: overrides.search ?? filters.search,
        page: overrides.page ?? page,
        limit,
      };

      try {
        const result = await fetchMyOpportunities(query);

        if (isMounted.current && id === requestId.current) {
          setOpportunities(result.opportunities);
          setSummary(result.summary);
          setPagination(result.pagination);
        }

        return result;
      } catch (error) {
        // A 401 is already handled globally by axiosInstance (it clears the
        // session), so anything reaching here is worth showing.
        if (isMounted.current && id === requestId.current) setLoadError(error);
        return null;
      } finally {
        if (isMounted.current && id === requestId.current) setIsLoading(false);
      }
    },
    [filters.status, filters.type, filters.search, page, limit],
  );

  useEffect(() => {
    if (autoLoad) load();
    // `load` already closes over every filter and the page, so depending on it is
    // what makes a filter change refetch.
  }, [autoLoad, load]);

  /**
   * Steps back when the page being viewed has stopped existing.
   *
   * Deleting the last posting on page 2 leaves the employer on an empty page 2, and
   * an empty list is indistinguishable from "you have posted nothing" — which is
   * alarming and false. The correction uses the server's reported `totalPages`
   * rather than a local guess, and changing `page` reloads on its own.
   */
  useEffect(() => {
    if (!pagination) return;

    const lastPage = Math.max(pagination.totalPages ?? 1, 1);
    if (page > lastPage) setPage(lastPage);
  }, [pagination, page]);

  /**
   * Runs one write, then reloads, funnelling all of them through the same state
   * handling so every action gets consistent loading and feedback behaviour.
   *
   * Rethrows so a caller that needs to react to a specific failure still can.
   */
  const mutate = useCallback(
    async (operation, message) => {
      setIsSaving(true);
      setSaveError(null);
      setSuccessMessage(null);

      try {
        const result = await operation();
        await load();
        if (isMounted.current && message) setSuccessMessage(message);
        return result;
      } catch (error) {
        if (isMounted.current) setSaveError(error);
        throw error;
      } finally {
        if (isMounted.current) setIsSaving(false);
      }
    },
    [load],
  );

  const clearFeedback = useCallback(() => {
    setSaveError(null);
    setSuccessMessage(null);
  }, []);

  /**
   * Applies a filter change and returns to page 1.
   *
   * Staying on page 3 while narrowing the results is how an employer ends up
   * looking at an empty page and concluding the filter found nothing.
   */
  const applyFilters = useCallback((next) => {
    setFilters((previous) => ({ ...previous, ...next }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(emptyOwnerFilters());
    setPage(1);
  }, []);

  const hasActiveFilters = useMemo(
    () => Boolean(filters.status || filters.type || filters.search.trim()),
    [filters],
  );

  // --- actions --------------------------------------------------------------
  // Named for the employer's intention. `changeStatus` is deliberately not
  // exposed raw: "publish" and "reopen" are the same PATCH but different promises
  // to the person clicking, and the confirmation they see should say which.

  const publish = useCallback(
    (opportunityId) =>
      mutate(
        () => updateOpportunityRequest(opportunityId, { status: OPPORTUNITY_STATUSES.ACTIVE }),
        'Opportunity published. Students can see it now.',
      ),
    [mutate],
  );

  const reopen = useCallback(
    (opportunityId) =>
      mutate(
        () => updateOpportunityRequest(opportunityId, { status: OPPORTUNITY_STATUSES.ACTIVE }),
        'Opportunity reopened.',
      ),
    [mutate],
  );

  const close = useCallback(
    (opportunityId) =>
      mutate(
        () => updateOpportunityRequest(opportunityId, { status: OPPORTUNITY_STATUSES.CLOSED }),
        'Opportunity closed. It is no longer shown to students.',
      ),
    [mutate],
  );

  const remove = useCallback(
    (opportunityId) => mutate(() => deleteOpportunityRequest(opportunityId), 'Opportunity deleted.'),
    [mutate],
  );

  /** Routes a target status to the action whose message fits. */
  const changeStatus = useCallback(
    (opportunity, to) => {
      if (to === OPPORTUNITY_STATUSES.CLOSED) return close(opportunity.id);
      return opportunity.status === OPPORTUNITY_STATUSES.DRAFT
        ? publish(opportunity.id)
        : reopen(opportunity.id);
    },
    [close, publish, reopen],
  );

  return {
    opportunities,
    summary,
    pagination,

    filters,
    applyFilters,
    clearFilters,
    hasActiveFilters,

    page,
    setPage,

    isLoading,
    loadError,
    reload: load,

    isSaving,
    saveError,
    successMessage,
    clearFeedback,

    publish,
    reopen,
    close,
    remove,
    changeStatus,
  };
}
