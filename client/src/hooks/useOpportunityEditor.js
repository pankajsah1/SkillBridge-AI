/**
 * Owns one opportunity while it is being written: loading it for editing, and
 * saving it.
 *
 * SEPARATE FROM useMyOpportunities BECAUSE THE TWO WANT OPPOSITE THINGS. That hook
 * reloads the whole list after every write, which is right for a management view
 * and wasteful on a form that is about to navigate away. It also has no use for
 * field-level errors, which are the main thing a form needs. Same internal
 * contract as useStudentProfile.js — an `isMounted` guard and a single funnel —
 * but a different job.
 *
 * The form's own state lives in the form component. This hook holds only what
 * came from or goes to the server, so "what did the employer type?" and "what is
 * stored?" never get confused: the second is what the patch diff is measured
 * against.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createOpportunity as createOpportunityRequest,
  fetchOpportunity,
  updateOpportunity as updateOpportunityRequest,
} from '../api/opportunity.api.js';
import { fieldErrorsFrom } from '../utils/apiErrors.js';
import { buildOpportunityPatch, buildOpportunityPayload } from '../utils/opportunityValidation.js';

/**
 * @param {{opportunityId?: string}} [options] Omit the id to create a new posting.
 */
export default function useOpportunityEditor({ opportunityId } = {}) {
  const isEditing = Boolean(opportunityId);

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
    if (!opportunityId) return null;

    setIsLoading(true);
    setLoadError(null);

    try {
      const loaded = await fetchOpportunity(opportunityId);
      if (isMounted.current) setOriginal(loaded);
      return loaded;
    } catch (error) {
      // A 404 here is the honest answer for someone else's draft as well as for a
      // deleted posting — the API refuses to distinguish them, so neither does
      // this. The page renders the message it was given.
      if (isMounted.current) setLoadError(error);
      return null;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [opportunityId]);

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
   * On an edit it sends only what changed. `null` means there was nothing to send
   * — the caller decides what to say about that, because "you have not changed
   * anything" is information, not an error, and the API would answer it with a
   * 400 that reads like a bug.
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
          const created = await createOpportunityRequest(buildOpportunityPayload(form));
          if (isMounted.current) setOriginal(created);
          return created;
        }

        const patch = buildOpportunityPatch(form, original ?? {});
        if (Object.keys(patch).length === 0) return null;

        const updated = await updateOpportunityRequest(opportunityId, patch);
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
    [isEditing, opportunityId, original],
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
