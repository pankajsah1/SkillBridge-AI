/**
 * Owns the signed-in academician's profile: loading it, and every write to it.
 *
 * Shaped deliberately like usePortfolio.js — the same `mutate` funnel, the same
 * `isSaving` / `busyKey` / `saveError` / `fieldErrors` / `successMessage` set, the
 * same mounted-ref guard — because the academician profile page does the same job as
 * the student portfolio page, and a second dialect of one idea is a second thing to
 * maintain.
 *
 * WHY EVERY WRITE STORES A PAIR. Every academician endpoint answers with
 * `{profile, completion}`, and both halves land in a single state update. The
 * completion panel sits directly beside the lists it scores, so storing them apart
 * would let a failed or out-of-order second request leave "70%" next to a list that
 * no longer justifies it. As one value they are always the same snapshot, and the
 * client never recomputes a number the server owns.
 *
 * NO USER OR PROFILE ID APPEARS IN HERE, because none appears in academician.api.js:
 * the server reads the owner from the token. "Edit another academician's profile" is
 * not a request this hook is able to express.
 *
 * WHAT THIS REPLACES. The first cut of this file exported six small hooks, read
 * `err.response.status`, and expected `{data, message}` back from the API module.
 * None of those three things exist in this client — axiosInstance normalises every
 * rejection to `{status, message, errors, isNetworkError}` with no `.response` at
 * all, and the API module resolves unwrapped payloads. `fieldErrorsFrom` is the
 * shared translation from that rejection to per-input messages.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createAchievement,
  createEducation,
  createExperience,
  createExpertise,
  createProfile,
  deleteAchievement,
  deleteEducation,
  deleteExperience,
  deleteExpertise,
  fetchMyProfile,
  updateAchievement,
  updateEducation,
  updateExperience,
  updateExpertise,
  updateProfile,
} from '../api/academician.api.js';
import { fieldErrorsFrom } from '../utils/apiErrors.js';

/**
 * Which API function handles which list, so a page can call
 * `addRecord('education', payload)` instead of switching on a string in three
 * places.
 *
 * The keys are the server's route segments verbatim (`experiences`, not
 * `experience`), which is also what the section configs in
 * constants/academicianSections.js use — one spelling from the form to the URL.
 */
const SECTION_API = Object.freeze({
  education: { create: createEducation, update: updateEducation, remove: deleteEducation },
  experiences: { create: createExperience, update: updateExperience, remove: deleteExperience },
  achievements: {
    create: createAchievement,
    update: updateAchievement,
    remove: deleteAchievement,
  },
});

export default function useAcademicianProfile({ autoLoad = true } = {}) {
  /** The profile and its score, together. See the note at the top of the file. */
  const [data, setData] = useState({ profile: null, completion: null });
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [loadError, setLoadError] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);

  /**
   * Which specific thing is mid-request — a record id, a skill id, or a section key.
   *
   * `isSaving` alone is not enough on a page carrying a dozen remove buttons: one
   * global flag would spin all of them when an academician deletes one publication.
   * This is what puts the busy state on the row that is actually busy.
   */
  const [busyKey, setBusyKey] = useState(null);

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
      if (isMounted.current) setData(loaded);
      return loaded;
    } catch (error) {
      // A 401 has already been handled globally by axiosInstance, which clears the
      // session — anything reaching here is worth putting on screen.
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
   * Runs one write through shared loading, error and confirmation handling.
   *
   * Rethrows, so a caller that needs to react to a failure still can — the record
   * forms close themselves only on success, and they find out by the absence of a
   * throw.
   *
   * @param {() => Promise<{profile: object, completion: object}>} operation
   * @param {string} message shown as the confirmation banner
   * @param {string|null} [key] the row to mark busy
   */
  const mutate = useCallback(async (operation, message, key = null) => {
    setIsSaving(true);
    setBusyKey(key);
    setSaveError(null);
    setFieldErrors({});
    setSuccessMessage(null);

    try {
      const result = await operation();

      if (isMounted.current) {
        // Both halves, in one update. See the note at the top of the file.
        setData({ profile: result.profile, completion: result.completion });
        if (message) setSuccessMessage(message);
      }

      return result;
    } catch (error) {
      if (isMounted.current) {
        setSaveError(error);
        // Field messages go beside their inputs; the banner shows the rest.
        setFieldErrors(fieldErrorsFrom(error));
      }
      throw error;
    } finally {
      if (isMounted.current) {
        setIsSaving(false);
        setBusyKey(null);
      }
    }
  }, []);

  const clearFeedback = useCallback(() => {
    setSaveError(null);
    setFieldErrors({});
    setSuccessMessage(null);
  }, []);

  const clearFieldError = useCallback((field) => {
    setFieldErrors((previous) =>
      previous[field] ? { ...previous, [field]: undefined } : previous,
    );
  }, []);

  // --- the profile itself --------------------------------------------------

  const hasProfile = Boolean(data.profile);

  /**
   * Creates or updates, decided here rather than by the caller.
   *
   * POST answers 409 when a profile already exists and PATCH answers 404 when one
   * does not, so getting this branch wrong is the difference between "saved" and an
   * error the academician can do nothing about. Deciding it from loaded state means
   * the page has one save button and no flag of its own to keep in step.
   */
  const saveProfile = useCallback(
    (fields) =>
      mutate(
        () => (hasProfile ? updateProfile(fields) : createProfile(fields)),
        hasProfile ? 'Profile saved.' : 'Profile created.',
        'profile',
      ),
    [mutate, hasProfile],
  );

  // --- expertise ------------------------------------------------------------
  // These three signatures match components/profile/SkillsSection.jsx exactly, which
  // is what lets the academician page reuse the student skills editor unchanged: it
  // reads only `profile.skills`, and that array has the same shape for both roles
  // because both sides reference the same skill catalogue.

  const addSkill = useCallback(
    ({ skillId, level }) =>
      mutate(() => createExpertise({ skillId, level }), 'Expertise added.', 'add:skill'),
    [mutate],
  );

  const setSkillLevel = useCallback(
    (skillId, level) =>
      mutate(() => updateExpertise(skillId, { level }), 'Level updated.', skillId),
    [mutate],
  );

  const removeSkill = useCallback(
    (skillId) => mutate(() => deleteExpertise(skillId), 'Expertise removed.', skillId),
    [mutate],
  );

  // --- education, experience, achievements ---------------------------------
  // Three functions for three sections rather than nine near-identical ones. The
  // section key is data here, which is what keeps "add a degree" and "add a
  // publication" from drifting apart.

  const addRecord = useCallback(
    (section, payload) =>
      mutate(
        () => SECTION_API[section].create(payload),
        'Added to your profile.',
        `add:${section}`,
      ),
    [mutate],
  );

  const saveRecord = useCallback(
    (section, recordId, payload) =>
      mutate(() => SECTION_API[section].update(recordId, payload), 'Changes saved.', recordId),
    [mutate],
  );

  const removeRecord = useCallback(
    (section, recordId) =>
      mutate(() => SECTION_API[section].remove(recordId), 'Removed from your profile.', recordId),
    [mutate],
  );

  return {
    profile: data.profile,
    completion: data.completion,

    hasProfile,
    // `profile === null` *after* a clean load is the real "no profile yet" signal.
    // Before the load resolves it is merely unknown, and treating unknown as absent
    // would flash a "create your profile" prompt at somebody who already has one.
    isFirstVisit: !isLoading && !loadError && data.profile === null,

    isLoading,
    loadError,
    reload: load,

    isSaving,
    busyKey,
    saveError,
    fieldErrors,
    successMessage,
    clearFeedback,
    clearFieldError,

    saveProfile,

    addSkill,
    setSkillLevel,
    removeSkill,

    addRecord,
    saveRecord,
    removeRecord,
  };
}
