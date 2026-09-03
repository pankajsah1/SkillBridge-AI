/**
 * Owns one learning programme while it is being written: loading it for editing, and
 * saving it.
 *
 * SEPARATE FROM useMyLearningPrograms for the reason useOpportunityEditor is
 * separate from useMyOpportunities. That hook reloads the whole list after every
 * write, which is right for a management view and wasteful on a form that is about
 * to navigate away; it also has no use for field-level errors, which are the main
 * thing a form needs.
 *
 * The form's own state lives in the form component. This hook holds only what came
 * from or goes to the server, so "what did the publisher type?" and "what is stored?"
 * never get confused — the second is what the patch is diffed against.
 *
 * IT READS THROUGH THE SHARED DETAIL ENDPOINT, GET /learning/programs/:id, which
 * serves every signed-in reader including the publisher. A second owner-only detail
 * route would be a second thing to keep in step for no gain; the server already
 * refuses a stranger's draft.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createLearningProgram as createLearningProgramRequest,
  fetchLearningProgram,
  updateLearningProgram as updateLearningProgramRequest,
} from '../api/learning.api.js';
import { fieldErrorsFrom } from '../utils/apiErrors.js';
import {
  buildLearningProgramPatch,
  buildLearningProgramPayload,
} from '../utils/learningValidation.js';

/**
 * @param {{programId?: string}} [options] Omit the id to create a new programme.
 */
export default function useLearningProgramEditor({ programId } = {}) {
  const isEditing = Boolean(programId);

  /** The stored version, and the baseline the patch is diffed against. */
  const [original, setOriginal] = useState(null);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [loadError, setLoadError] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!programId) return null;

    setIsLoading(true);
    setLoadError(null);

    try {
      const loaded = await fetchLearningProgram(programId);
      // Only the programme half is kept: the enrolment beside it belongs to the
      // reader, and a publisher editing their own programme has no use for it.
      if (isMounted.current) setOriginal(loaded.program);
      return loaded.program;
    } catch (error) {
      // A 404 here is the honest answer for another publisher's draft as well as
      // for a deleted programme — the API refuses to distinguish them, so neither
      // does this.
      if (isMounted.current) setLoadError(error);
      return null;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    load();
  }, [load]);

  const clearFieldError = useCallback((field) => {
    setFieldErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
  }, []);

  const clearFeedback = useCallback(() => {
    setSaveError(null);
    setFieldErrors({});
  }, []);

  /**
   * Creates or updates, whichever this editor is for.
   *
   * On an edit it sends only what changed. `null` means there was nothing to send —
   * the caller decides what to say about that, because "you have not changed
   * anything" is information, not an error, and the API would answer it with a 400
   * reading "No editable fields were provided", which looks like a bug.
   *
   * Rethrows on failure so the caller can stay on the form rather than navigating
   * away from an unsaved draft.
   */
  const save = useCallback(
    async (form) => {
      setIsSaving(true);
      setSaveError(null);
      setFieldErrors({});

      try {
        if (!isEditing) {
          const created = await createLearningProgramRequest(buildLearningProgramPayload(form));
          if (isMounted.current) setOriginal(created);
          return created;
        }

        const patch = buildLearningProgramPatch(form, original ?? {});
        if (Object.keys(patch).length === 0) return null;

        const updated = await updateLearningProgramRequest(programId, patch);
        if (isMounted.current) setOriginal(updated);
        return updated;
      } catch (error) {
        if (isMounted.current) {
          setSaveError(error);
          // Field messages are surfaced separately so the form can put each one
          // beside its input instead of dumping them all in a banner.
          setFieldErrors(fieldErrorsFrom(error));
        }
        throw error;
      } finally {
        if (isMounted.current) setIsSaving(false);
      }
    },
    [isEditing, programId, original],
  );

  return {
    isEditing,
    original,

    isLoading,
    loadError,
    reload: load,

    isSaving,
    saveError,
    fieldErrors,
    clearFeedback,
    clearFieldError,

    save,
  };
}
