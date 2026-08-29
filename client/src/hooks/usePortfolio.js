/**
 * Owns the signed-in student's portfolio: loading it, and every write to it.
 *
 * Shaped deliberately like useStudentProfile.js — same `mutate` funnel, same
 * `isSaving` / `saveError` / `fieldErrors` / `successMessage` quartet, same
 * mounted-ref guard — so the portfolio page reads like the profile page rather
 * than like a second dialect of the same idea.
 *
 * ONE THING IS DIFFERENT, AND IT IS THE WHOLE REASON THIS IS A SEPARATE HOOK.
 * Every portfolio write answers with `{profile, completion}`, and both halves are
 * stored together in a single state update. That pairing is not cosmetic: the
 * completion panel sits directly beside the lists it scores, so if the score and
 * the lists were stored separately, a failed second request or an out-of-order
 * response would leave "75%" next to a list that no longer justifies it. Stored as
 * one value, the panel and the lists are always the same snapshot, and the client
 * never computes the number itself — the server owns it.
 *
 * WHY NOT EXTEND useStudentProfile. That hook is shipped and its mutations resolve
 * to a bare profile, not a pair. Changing its contract would mean touching the
 * profile page and the dashboard, both working, to add a field neither uses — a
 * refactor of tested code for no behavioural gain, which the brief asks me not to
 * do.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createAchievement,
  createCertification,
  createExperience,
  createProject,
  deleteAchievement,
  deleteCertification,
  deleteEntryDocument,
  deleteExperience,
  deleteProject,
  deleteResume,
  downloadDocument,
  fetchMyPortfolio,
  updateAchievement,
  updateCertification,
  updateExperience,
  updateProject,
  uploadEntryDocument,
  uploadResume,
} from '../api/portfolio.api.js';
import { fieldErrorsFrom } from '../utils/apiErrors.js';

/**
 * Which API function handles which section, so the page can call
 * `add('projects', payload)` instead of switching on a string in four places.
 *
 * The keys match the server's route segments exactly (`experiences`, not
 * `experience`), which is also what the section config in
 * constants/portfolioSections.js uses — one spelling end to end.
 */
const SECTION_API = Object.freeze({
  projects: { create: createProject, update: updateProject, remove: deleteProject },
  certifications: {
    create: createCertification,
    update: updateCertification,
    remove: deleteCertification,
  },
  achievements: {
    create: createAchievement,
    update: updateAchievement,
    remove: deleteAchievement,
  },
  experiences: { create: createExperience, update: updateExperience, remove: deleteExperience },
});

export default function usePortfolio({ autoLoad = true } = {}) {
  /**
   * The profile and its score, together.
   *
   * One state object rather than two `useState` calls, so a mutation response
   * lands as a single atomic update. Two setters would give React two renders and,
   * briefly, a score that does not match the list beside it.
   */
  const [data, setData] = useState({ profile: null, completion: null });
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [loadError, setLoadError] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);

  /**
   * Which specific record is mid-request — an id, or a section key, or 'resume'.
   *
   * `isSaving` alone is not enough on this page. It has a dozen delete buttons on
   * screen at once, and a single global flag would spin every one of them when a
   * student deletes one project. This is what lets the busy state land on the row
   * that is actually busy.
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
      const loaded = await fetchMyPortfolio();
      if (isMounted.current) setData(loaded);
      return loaded;
    } catch (error) {
      // A 401 has already been handled globally by axiosInstance, which clears
      // the session — anything reaching here is worth putting on screen.
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
   * Rethrows, so a caller that needs to react to a specific failure still can —
   * the record forms close themselves only on success, and they find out by the
   * absence of a throw.
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

  // --- record actions ------------------------------------------------------
  // Three functions for four sections, rather than twelve near-identical ones.
  // The section key is data here, which is what keeps "add a project" and "add a
  // certification" from drifting apart.

  const addRecord = useCallback(
    (section, payload) =>
      mutate(() => SECTION_API[section].create(payload), 'Added to your portfolio.', `add:${section}`),
    [mutate],
  );

  const saveRecord = useCallback(
    (section, recordId, payload) =>
      mutate(() => SECTION_API[section].update(recordId, payload), 'Changes saved.', recordId),
    [mutate],
  );

  const removeRecord = useCallback(
    (section, recordId) =>
      mutate(() => SECTION_API[section].remove(recordId), 'Removed from your portfolio.', recordId),
    [mutate],
  );

  // --- documents -----------------------------------------------------------

  const saveResume = useCallback(
    (file) => mutate(() => uploadResume(file), 'Resume uploaded.', 'resume'),
    [mutate],
  );

  const removeResume = useCallback(
    () => mutate(() => deleteResume(), 'Resume removed.', 'resume'),
    [mutate],
  );

  const saveRecordDocument = useCallback(
    (section, recordId, file) =>
      mutate(
        () => uploadEntryDocument(section, recordId, file),
        'File attached.',
        `document:${recordId}`,
      ),
    [mutate],
  );

  const removeRecordDocument = useCallback(
    (section, recordId) =>
      mutate(
        () => deleteEntryDocument(section, recordId),
        'File removed.',
        `document:${recordId}`,
      ),
    [mutate],
  );

  /**
   * Downloads a file without touching portfolio state.
   *
   * NOT routed through `mutate`, on purpose: a download changes nothing, so it has
   * no business clearing the confirmation banner from the edit the student just
   * made or replacing the stored profile with the same profile. Its own small busy
   * flag drives the one row's spinner, and a failure is reported through
   * `saveError` because that is where the page already looks.
   */
  const [downloadingFileName, setDownloadingFileName] = useState(null);

  const download = useCallback(async (metadata) => {
    setDownloadingFileName(metadata.fileName);
    setSaveError(null);

    try {
      await downloadDocument(metadata);
    } catch (error) {
      if (isMounted.current) setSaveError(error);
      throw error;
    } finally {
      if (isMounted.current) setDownloadingFileName(null);
    }
  }, []);

  return {
    profile: data.profile,
    completion: data.completion,

    hasProfile: Boolean(data.profile),
    // `profile === null` *after* a clean load is the real "no profile yet"
    // signal. Before the load resolves it is merely unknown, and treating
    // unknown as absent would flash a "create your profile" prompt at a student
    // who has one.
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

    addRecord,
    saveRecord,
    removeRecord,

    saveResume,
    removeResume,
    saveRecordDocument,
    removeRecordDocument,

    download,
    downloadingFileName,
  };
}
