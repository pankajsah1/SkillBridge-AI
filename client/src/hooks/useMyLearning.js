/**
 * Owns the signed-in learner's own enrolments: My Learning.
 *
 * SEPARATE FROM useLearningPrograms, which browses the catalogue. That hook reads a
 * list of programmes anyone may enrol in; this one reads a list of rows that belong
 * to this learner, each carrying their own progress and status, and its writes move
 * that progress forward.
 *
 * WHY A PROGRESS WRITE RELOADS THE LIST rather than patching the row in place — the
 * same reason useMyOpportunities gives. Reporting 60% moves a row from "Enrolled" to
 * "In progress", which changes both the summary counts and which status tab the row
 * belongs to. Splicing the returned document into local state would leave the counts
 * and the active tab disagreeing with the rows under them.
 *
 * NOTHING HERE TOUCHES A SKILL SCORE. Completing a programme records that the
 * learning happened; the assessment engine remains the only thing that decides what
 * a learner is good at, and it does so when they reassess. `skillsToReassess` below
 * is the server's list of what to reassess on — an invitation, not an update.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchMyLearning, updateEnrollment } from '../api/learning.api.js';
import { LEARNING_PAGE, PROGRESS_ON_COMPLETION } from '../constants/learning.js';

/**
 * @param {{status?: string, limit?: number, autoLoad?: boolean}} [options]
 */
export default function useMyLearning({
  status: initialStatus = '',
  limit = LEARNING_PAGE.defaultLimit,
  autoLoad = true,
} = {}) {
  const [enrollments, setEnrollments] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState(null);

  /** `''` is every enrolment; otherwise one ENROLLMENT_STATUSES value. */
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(autoLoad);
  const [loadError, setLoadError] = useState(null);

  const [savingId, setSavingId] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  /**
   * The server's answer to the last progress write, plus which row it was about:
   * `{enrollmentId, justCompleted, nextAction, skillsToReassess}`.
   *
   * `justCompleted` is true on exactly one response — the one that crossed 100% — so
   * the reassessment prompt is driven from here and never from `status ===
   * 'completed'`, which stays true for good and would show the prompt forever.
   */
  const [completion, setCompletion] = useState(null);

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
      const result = await fetchMyLearning({ status, page, limit });

      if (isMounted.current && id === requestId.current) {
        setEnrollments(result.enrollments);
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
  }, [status, page, limit]);

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  /** Steps back when the page being viewed has stopped existing. */
  useEffect(() => {
    if (!pagination) return;

    const lastPage = Math.max(pagination.totalPages ?? 1, 1);
    if (page > lastPage) setPage(lastPage);
  }, [pagination, page]);

  const clearFeedback = useCallback(() => {
    setSaveError(null);
    setSuccessMessage(null);
    setCompletion(null);
  }, []);

  /**
   * Reports progress on one enrolment, then reloads.
   *
   * SENDS ONLY `progress`, because 100 IS completion: the server derives the status,
   * stamps `completedAt` and answers `justCompleted`. A client that also sent
   * `status: 'completed'` would be asserting something it is not the authority on.
   *
   * Rethrows so a page that wants to keep a slider where the learner left it can.
   *
   * @param {string} enrollmentId
   * @param {number} progress 0–100
   */
  const saveProgress = useCallback(
    async (enrollmentId, progress) => {
      setSavingId(enrollmentId);
      setSaveError(null);
      setSuccessMessage(null);
      setCompletion(null);

      try {
        const result = await updateEnrollment(enrollmentId, { progress });
        await load();

        if (isMounted.current) {
          setCompletion({
            enrollmentId,
            justCompleted: Boolean(result.justCompleted),
            nextAction: result.nextAction ?? null,
            skillsToReassess: result.skillsToReassess ?? [],
          });

          setSuccessMessage(
            result.justCompleted
              ? 'Program completed. Reassess the skills it covered to update your profile.'
              : 'Progress saved.',
          );
        }

        return result;
      } catch (error) {
        if (isMounted.current) setSaveError(error);
        throw error;
      } finally {
        if (isMounted.current) setSavingId(null);
      }
    },
    [load],
  );

  /** Finishing, expressed the only way the API models it. */
  const markComplete = useCallback(
    (enrollmentId) => saveProgress(enrollmentId, PROGRESS_ON_COMPLETION),
    [saveProgress],
  );

  /** Applies a status filter and returns to page 1. */
  const applyStatus = useCallback((next) => {
    setStatus(next ?? '');
    setPage(1);
  }, []);

  const hasActiveFilters = useMemo(() => Boolean(status), [status]);

  return {
    enrollments,
    total,
    summary,
    pagination,

    status,
    applyStatus,
    hasActiveFilters,

    page,
    setPage,

    isLoading,
    loadError,
    reload: load,

    savingId,
    saveError,
    successMessage,
    completion,
    clearFeedback,

    saveProgress,
    markComplete,
  };
}
