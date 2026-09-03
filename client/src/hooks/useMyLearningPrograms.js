/**
 * Owns the signed-in publisher's own learning programmes: loading them, filtering
 * them, and every mutation to them.
 *
 * The management twin of useLearningPrograms, and separate from it for the reason
 * useMyOpportunities is separate from useOpportunities: this list includes drafts,
 * archived and ended programmes, is filtered by status, and carries writes a
 * learner's token would be refused for.
 *
 * WHY MUTATIONS RELOAD THE LIST INSTEAD OF PATCHING IT IN PLACE. Archiving a
 * programme changes the summary counts and moves the row out of whichever `status`
 * filter is active. Splicing the returned document into local state would leave the
 * counts and the filter stale, so the list would disagree with itself until the next
 * navigation.
 *
 * `enrollment` ON EACH ROW IS A COUNT, NOT A PERSON — `{total, enrolled, inProgress,
 * completed}`. The same key on the learner's list means the caller's own enrolment.
 * Publishers see numbers here and never names, which is the API's decision, not a
 * display choice this hook could reverse.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  deleteLearningProgram as deleteLearningProgramRequest,
  fetchMyLearningPrograms,
  updateLearningProgram as updateLearningProgramRequest,
} from '../api/learning.api.js';
import { LEARNING_PAGE, LEARNING_PROGRAM_STATUSES } from '../constants/learning.js';

/** No status, no type, no search — the unfiltered management view. */
export const emptyPublisherFilters = () => ({ status: '', type: '', search: '' });

/**
 * @param {{autoLoad?: boolean, limit?: number}} [options]
 */
export default function useMyLearningPrograms({
  autoLoad = true,
  limit = LEARNING_PAGE.defaultLimit,
} = {}) {
  const [programs, setPrograms] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState(null);

  const [filters, setFilters] = useState(emptyPublisherFilters);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(autoLoad);
  const [loadError, setLoadError] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /** Identifies the newest request so a slow earlier one cannot overwrite it. */
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;

    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await fetchMyLearningPrograms({
        status: filters.status,
        type: filters.type,
        search: filters.search,
        page,
        limit,
      });

      if (isMounted.current && id === requestId.current) {
        setPrograms(result.programs);
        setTotal(result.total);
        setSummary(result.summary);
        setPagination(result.pagination);
      }

      return result;
    } catch (error) {
      if (isMounted.current && id === requestId.current) setLoadError(error);
      return null;
    } finally {
      if (isMounted.current && id === requestId.current) setIsLoading(false);
    }
  }, [filters.status, filters.type, filters.search, page, limit]);

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  /** Steps back when the page being viewed has stopped existing. */
  useEffect(() => {
    if (!pagination) return;

    const lastPage = Math.max(pagination.totalPages ?? 1, 1);
    if (page > lastPage) setPage(lastPage);
  }, [pagination, page]);

  /**
   * Runs one write, then reloads, funnelling all of them through the same state
   * handling. Rethrows so a caller that needs to react to a specific failure can —
   * a refused delete ("learners are enrolled") is the case that matters.
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

  const applyFilters = useCallback((next) => {
    setFilters((previous) => ({ ...previous, ...next }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(emptyPublisherFilters());
    setPage(1);
  }, []);

  const hasActiveFilters = useMemo(
    () => Boolean(filters.status || filters.type || filters.search.trim()),
    [filters],
  );

  // --- actions --------------------------------------------------------------
  // Named for the publisher's intention rather than the verb, because `publish`
  // and `restore` are the same PATCH but different promises to the person
  // clicking: one shows learners something new, the other shows them something
  // they have seen before.

  const publish = useCallback(
    (programId) =>
      mutate(
        () =>
          updateLearningProgramRequest(programId, {
            status: LEARNING_PROGRAM_STATUSES.PUBLISHED,
          }),
        'Program published. Learners can enrol now.',
      ),
    [mutate],
  );

  const restore = useCallback(
    (programId) =>
      mutate(
        () =>
          updateLearningProgramRequest(programId, {
            status: LEARNING_PROGRAM_STATUSES.PUBLISHED,
          }),
        'Program restored to the catalogue.',
      ),
    [mutate],
  );

  /**
   * Archiving, which is what retiring a programme means here.
   *
   * There is no unpublish: learners may already be enrolled, and making their
   * programme vanish is not something a publisher should be able to do. Archiving is
   * visible, honest and reversible.
   */
  const archive = useCallback(
    (programId) =>
      mutate(
        () =>
          updateLearningProgramRequest(programId, {
            status: LEARNING_PROGRAM_STATUSES.ARCHIVED,
          }),
        'Program archived. It is no longer offered to learners.',
      ),
    [mutate],
  );

  const remove = useCallback(
    (programId) =>
      mutate(() => deleteLearningProgramRequest(programId), 'Program deleted.'),
    [mutate],
  );

  /** Routes a target status to the action whose message fits. */
  const changeStatus = useCallback(
    (program, to) => {
      if (to === LEARNING_PROGRAM_STATUSES.ARCHIVED) return archive(program.id);
      return program.status === LEARNING_PROGRAM_STATUSES.DRAFT
        ? publish(program.id)
        : restore(program.id);
    },
    [archive, publish, restore],
  );

  return {
    programs,
    total,
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
    restore,
    archive,
    remove,
    changeStatus,
  };
}
