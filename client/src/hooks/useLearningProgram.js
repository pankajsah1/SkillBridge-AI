/**
 * Loads one learning programme for reading, and carries the two writes a reader can
 * make about it: enrolling, and reporting progress.
 *
 * WHY IT HOLDS BOTH HALVES. GET /learning/programs/:id answers with the programme
 * AND with the caller's own enrolment on it (or null), because the page cannot
 * decide what to offer without both: "Enrol" and "Continue — 40%" are the same
 * button in two states. Storing them separately would let one go stale against the
 * other; the API sends them together, so this hook keeps them together.
 *
 * A 404 is left exactly as the API sent it, for the reason useOpportunity gives: an
 * unpublished programme and a deleted one answer alike on purpose, so ids cannot be
 * guessed at to discover a draft.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  enrollInProgram,
  fetchLearningProgram,
  updateEnrollment,
} from '../api/learning.api.js';

/**
 * @param {string | undefined} programId
 */
export default function useLearningProgram(programId) {
  const [program, setProgram] = useState(null);
  /** The caller's own enrolment on this programme, or null. */
  const [enrollment, setEnrollment] = useState(null);

  const [isLoading, setIsLoading] = useState(Boolean(programId));
  const [loadError, setLoadError] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  /**
   * The server's answer to the last progress write: `{justCompleted, nextAction,
   * skillsToReassess}`.
   *
   * `justCompleted` is true exactly once, on the response that crossed 100%, so it
   * is what the celebratory wording is driven from. The *prompt* is driven from the
   * enrolment's own status instead, because it has to survive a refresh — the server
   * draws the same distinction at `toEnrollmentResult`, where `nextAction` is
   * attached on every read of a complete row and `justCompleted` only on the write
   * that completed it. This page's read is GET /learning/programs/:id, which carries
   * no `nextAction`, so the page reads `enrollment.status` and takes the skills from
   * `program.targetSkills` in the same response.
   */
  const [completion, setCompletion] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!programId) {
      setProgram(null);
      setEnrollment(null);
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const loaded = await fetchLearningProgram(programId);

      if (isMounted.current) {
        setProgram(loaded.program);
        setEnrollment(loaded.enrollment ?? null);
      }

      return loaded;
    } catch (error) {
      if (isMounted.current) {
        setLoadError(error);
        // Cleared so a failed reload cannot leave the previous programme on screen
        // under an error message that does not belong to it.
        setProgram(null);
        setEnrollment(null);
      }
      return null;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    load();
  }, [load]);

  const clearFeedback = useCallback(() => {
    setSaveError(null);
    setCompletion(null);
  }, []);

  /**
   * Enrols the signed-in learner. The body is `{programId}` and nothing else.
   *
   * The 409 for "already enrolled" is stored rather than swallowed, and the page
   * says it out loud: a button that silently did nothing would read as broken.
   */
  const enroll = useCallback(async () => {
    if (!programId) return null;

    setIsSaving(true);
    setSaveError(null);

    try {
      const created = await enrollInProgram(programId);
      if (isMounted.current) setEnrollment(created);
      return created;
    } catch (error) {
      if (isMounted.current) setSaveError(error);
      throw error;
    } finally {
      if (isMounted.current) setIsSaving(false);
    }
  }, [programId]);

  /**
   * Reports progress on this programme's enrolment.
   *
   * SENDS ONLY `progress`. There is no `/complete` route and none is invented here:
   * 100 IS completion, and the server derives the status, stamps `completedAt` and
   * reports `justCompleted` — so the client never has to decide any of the three.
   *
   * @param {number} progress 0–100
   */
  const saveProgress = useCallback(
    async (progress) => {
      if (!enrollment?.id) return null;

      setIsSaving(true);
      setSaveError(null);

      try {
        const result = await updateEnrollment(enrollment.id, { progress });

        if (isMounted.current) {
          setEnrollment(result.enrollment);
          setCompletion({
            justCompleted: Boolean(result.justCompleted),
            nextAction: result.nextAction ?? null,
            skillsToReassess: result.skillsToReassess ?? [],
          });
        }

        return result;
      } catch (error) {
        if (isMounted.current) setSaveError(error);
        throw error;
      } finally {
        if (isMounted.current) setIsSaving(false);
      }
    },
    [enrollment?.id],
  );

  return {
    program,
    enrollment,

    isLoading,
    loadError,
    reload: load,

    isSaving,
    saveError,
    completion,
    clearFeedback,

    enroll,
    saveProgress,
  };
}
