/**
 * Learner discovery: browsing, searching and filtering the learning catalogue.
 *
 * SEPARATE FROM useMyLearningPrograms for the same reason useOpportunities is
 * separate from useMyOpportunities: that hook manages a publisher's own catalogue —
 * drafts included, mutations included, filtered by status — while this one reads a
 * list that only ever contains programmes someone can actually enrol in, and its
 * one mutation is enrolling.
 *
 * NO RANKING HAPPENS HERE. The hub's "Recommended for you" strip comes from
 * useLearningRecommendations, which asks the server; this hook is the plain
 * catalogue, in the order the server sent it. A relevance number computed in a
 * browser from whatever page happened to be loaded would be worse than none.
 *
 * The "is this still open?" rule is the server's: GET /learning/programs returns
 * published programmes that have not ended, so there is nothing to exclude here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { enrollInProgram, fetchLearningPrograms } from '../api/learning.api.js';
import { LEARNING_PAGE } from '../constants/learning.js';

/** Nothing selected — the whole open catalogue. */
export const emptyLearningFilters = () => ({
  type: '',
  level: '',
  deliveryMode: '',
  skills: [],
  search: '',
});

/**
 * @param {{limit?: number}} [options]
 */
export default function useLearningPrograms({ limit = LEARNING_PAGE.defaultLimit } = {}) {
  const [programs, setPrograms] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState(null);

  const [filters, setFilters] = useState(emptyLearningFilters);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [enrollingId, setEnrollingId] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /** Identifies the newest request so a slow earlier one cannot overwrite it. */
  const requestId = useRef(0);

  /** `skills` is an array, so it needs a stable dependency for `load`. */
  const skillKey = filters.skills.join(',');

  const load = useCallback(async () => {
    const id = ++requestId.current;

    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await fetchLearningPrograms({
        type: filters.type,
        level: filters.level,
        deliveryMode: filters.deliveryMode,
        skills: skillKey ? skillKey.split(',') : [],
        search: filters.search,
        page,
        limit,
      });

      if (isMounted.current && id === requestId.current) {
        setPrograms(result.programs);
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
  }, [filters.type, filters.level, filters.deliveryMode, filters.search, skillKey, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  /** Steps back when the page being viewed has stopped existing. */
  useEffect(() => {
    if (!pagination) return;

    const lastPage = Math.max(pagination.totalPages ?? 1, 1);
    if (page > lastPage) setPage(lastPage);
  }, [pagination, page]);

  /**
   * Enrols, then patches that one row rather than refetching the page.
   *
   * The row's `enrollment` is what its button reads, so writing the server's answer
   * straight into it turns "Enrol" into "Continue" immediately and without a second
   * request. The object the POST returns is a fuller view than the light projection
   * the list carries — same `id`, `status` and `progress`, more besides — which is
   * harmless here because those three are all a card reads.
   *
   * The rejection is deliberately not swallowed: a 409 "already enrolled" is
   * something the page must say out loud, and a hook that returned null would leave
   * the button looking broken instead.
   */
  const enroll = useCallback(async (programId) => {
    setEnrollingId(programId);

    try {
      const enrollment = await enrollInProgram(programId);

      if (isMounted.current) {
        setPrograms((rows) =>
          rows.map((row) => (row.id === programId ? { ...row, enrollment } : row)),
        );
      }

      return enrollment;
    } finally {
      if (isMounted.current) setEnrollingId(null);
    }
  }, []);

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
    setFilters(emptyLearningFilters());
    setPage(1);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.type) count += 1;
    if (filters.level) count += 1;
    if (filters.deliveryMode) count += 1;
    if (filters.search.trim()) count += 1;
    count += filters.skills.length;
    return count;
  }, [filters]);

  return {
    programs,
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

    enroll,
    enrollingId,

    isLoading,
    loadError,
    reload: load,
  };
}
