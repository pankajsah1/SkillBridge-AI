/**
 * Owns the signed-in student's profile: loading it, and every mutation to it.
 *
 * WHY A HOOK AND NOT A CONTEXT. Only two surfaces need this data (the profile
 * page and the student dashboard), they are never mounted at the same time, and
 * neither needs to observe the other's writes. A context would add a provider,
 * a re-render boundary and a cache-invalidation question to solve a problem that
 * does not exist yet. AuthContext stays the one global — his brief asks not to
 * introduce Redux or extra state machinery without a strong reason.
 *
 * WHY MUTATIONS RETURN THE WHOLE PROFILE. Every write endpoint answers with the
 * complete profile, because adding a skill also changes `profileCompletion`.
 * Storing that response wholesale means the UI never has to recompute a derived
 * value the server already calculated, so the number on screen cannot drift from
 * the number in the database.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  addMySkill,
  createMyProfile,
  fetchMyProfile,
  removeMySkill,
  updateMyCareerGoals,
  updateMyProfile,
  updateMySkillLevel,
} from '../api/studentProfile.api.js';

/**
 * @param {{autoLoad?: boolean}} [options]
 */
export default function useStudentProfile({ autoLoad = true } = {}) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [loadError, setLoadError] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
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

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const loaded = await fetchMyProfile();
      if (isMounted.current) setProfile(loaded);
      return loaded;
    } catch (error) {
      // A 401 is already handled globally by axiosInstance (it clears the
      // session), so anything reaching here is worth showing.
      if (isMounted.current) setLoadError(error);
      return null;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  /**
   * Runs one write, funnelling all of them through the same state handling so
   * every action gets consistent loading, error and confirmation behaviour.
   *
   * Rethrows so a caller that needs to react to a specific failure — the 409 on
   * a duplicate skill, say — still can.
   */
  const mutate = useCallback(async (operation, message) => {
    setIsSaving(true);
    setSaveError(null);
    setFieldErrors({});
    setSuccessMessage(null);

    try {
      const updated = await operation();
      if (isMounted.current) {
        setProfile(updated);
        if (message) setSuccessMessage(message);
      }
      return updated;
    } catch (error) {
      if (isMounted.current) {
        setSaveError(error);
        // Field-level messages are surfaced separately so the form can put each
        // one beside its input instead of dumping them all in a banner.
        const mapped = {};
        for (const item of error?.errors ?? []) {
          if (item?.field && item?.message && !mapped[item.field]) mapped[item.field] = item.message;
        }
        setFieldErrors(mapped);
      }
      throw error;
    } finally {
      if (isMounted.current) setIsSaving(false);
    }
  }, []);

  /** Dismisses the confirmation or error banner. */
  const clearFeedback = useCallback(() => {
    setSaveError(null);
    setFieldErrors({});
    setSuccessMessage(null);
  }, []);

  const clearFieldError = useCallback((field) => {
    setFieldErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
  }, []);

  // --- actions -------------------------------------------------------------
  // Named for what the student did, not for the HTTP verb, so the calling
  // component reads as a description of the interface.

  const create = useCallback(
    (payload) => mutate(() => createMyProfile(payload), 'Profile created.'),
    [mutate],
  );

  const save = useCallback(
    (patch) => mutate(() => updateMyProfile(patch), 'Profile saved.'),
    [mutate],
  );

  const saveCareerGoals = useCallback(
    (roleIds) => mutate(() => updateMyCareerGoals(roleIds), 'Career goals saved.'),
    [mutate],
  );

  const addSkill = useCallback(
    (payload) => mutate(() => addMySkill(payload), 'Skill added.'),
    [mutate],
  );

  const updateSkill = useCallback(
    (skillId, level) => mutate(() => updateMySkillLevel(skillId, level), 'Skill level updated.'),
    [mutate],
  );

  const removeSkill = useCallback(
    (skillId) => mutate(() => removeMySkill(skillId), 'Skill removed.'),
    [mutate],
  );

  return {
    profile,
    // `profile === null` after a successful load is the real "first visit"
    // signal; before the load finishes it is just unknown.
    hasProfile: Boolean(profile),
    isFirstVisit: !isLoading && !loadError && profile === null,

    isLoading,
    loadError,
    reload: load,

    isSaving,
    saveError,
    fieldErrors,
    successMessage,
    clearFeedback,
    clearFieldError,

    create,
    save,
    saveCareerGoals,
    addSkill,
    updateSkill,
    removeSkill,
  };
}
