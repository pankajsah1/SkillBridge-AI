/**
 * Student discovery: browsing, searching and filtering open opportunities.
 *
 * SEPARATE FROM useMyOpportunities BECAUSE THE TWO LISTS ARE NOT THE SAME LIST.
 * That hook manages a company's own postings — drafts included, mutations included,
 * filtered by status. This one reads a list that only ever contains postings a
 * student can actually act on, has nothing to mutate, and filters on the four
 * dimensions a student cares about: type, location, skills and work mode. Merging
 * them behind an `isOwner` flag would mean every read of either had to work out
 * which of the two it was looking at.
 *
 * There is deliberately no match score, no ranking and no "recommended for you"
 * here. The API does not calculate one yet and this hook must not invent one — a
 * number the student would read as a verified fit, computed in a browser from
 * whatever happened to be loaded, is worse than no number.
 *
 * The ordering and the "is this still open?" rule are both the server's. GET
 * /opportunities sorts by deadline ascending and returns only active postings whose
 * deadline has not passed, so there is nothing to sort or exclude here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchOpportunities } from '../api/opportunity.api.js';
import { OPPORTUNITY_PAGE } from '../constants/opportunities.js';

/** Nothing selected — the full list of open opportunities. */
export const emptyDiscoveryFilters = () => ({
  type: '',
  workMode: '',
  location: '',
  skills: [],
  search: '',
});

/**
 * @param {{limit?: number}} [options]
 */
export default function useOpportunities({ limit = OPPORTUNITY_PAGE.defaultLimit } = {}) {
  const [opportunities, setOpportunities] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState(null);

  const [filters, setFilters] = useState(emptyDiscoveryFilters);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Identifies the most recent request so a slow earlier one cannot overwrite it.
   *
   * Filtering is the one place this really matters: ticking three skills in quick
   * succession fires three searches, and without this the list settles on whichever
   * *responded* last rather than whichever was *asked* last.
   */
  const requestId = useRef(0);

  /**
   * `skills` is an array, so it needs a stable dependency.
   *
   * A new array literal on every render would make `load` a new function on every
   * render, and the effect below would then refetch forever.
   */
  const skillKey = filters.skills.join(',');

  const load = useCallback(async () => {
    const id = ++requestId.current;

    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await fetchOpportunities({
        type: filters.type,
        workMode: filters.workMode,
        location: filters.location,
        skills: skillKey ? skillKey.split(',') : [],
        search: filters.search,
        page,
        limit,
      });

      if (isMounted.current && id === requestId.current) {
        setOpportunities(result.opportunities);
        setTotal(result.total);
        setPagination(result.pagination);
      }

      return result;
    } catch (error) {
      if (isMounted.current && id === requestId.current) setLoadError(error);
      return null;
    } finally {
      if (isMounted.current && id === requestId.current) setIsLoading(false);
    }
  }, [filters.type, filters.workMode, filters.location, filters.search, skillKey, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Steps back when the page being viewed has stopped existing.
   *
   * Postings expire and get closed while a student is looking at page 3 of them. An
   * empty page 3 reads as "there is nothing here", which is a false answer to a
   * question they did not ask.
   */
  useEffect(() => {
    if (!pagination) return;

    const lastPage = Math.max(pagination.totalPages ?? 1, 1);
    if (page > lastPage) setPage(lastPage);
  }, [pagination, page]);

  /** Applies a filter change and returns to page 1. */
  const applyFilters = useCallback((next) => {
    setFilters((previous) => ({ ...previous, ...next }));
    setPage(1);
  }, []);

  const toggleSkill = useCallback((skillId) => {
    setFilters((previous) => ({
      ...previous,
      skills: previous.skills.includes(skillId)
        ? previous.skills.filter((id) => id !== skillId)
        : [...previous.skills, skillId],
    }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(emptyDiscoveryFilters());
    setPage(1);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.type) count += 1;
    if (filters.workMode) count += 1;
    if (filters.location.trim()) count += 1;
    if (filters.search.trim()) count += 1;
    count += filters.skills.length;
    return count;
  }, [filters]);

  return {
    opportunities,
    total,
    pagination,

    filters,
    applyFilters,
    toggleSkill,
    clearFilters,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,

    page,
    setPage,

    isLoading,
    loadError,
    reload: load,
  };
}
