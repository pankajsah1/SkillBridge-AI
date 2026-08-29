/**
 * Portfolio endpoint client.
 *
 * Like studentProfile.api.js: every route operates on *the caller's own*
 * portfolio, and no path anywhere in this file carries a student id — the server
 * derives the owner from the token. "Student A edits student B's portfolio" is
 * therefore not a bug this file could contain, because the request cannot be
 * expressed.
 *
 * THE UPLOAD CALLS ARE THE ONE PLACE THAT LOOKS UNUSUAL, and it is worth knowing
 * why before changing them. There is no multipart parser on the server (the npm
 * registry was unreachable, so multer could not be installed), so a document is
 * sent as the raw request body with the file's own content type. That means:
 *
 *   - the body is the File object itself, not FormData
 *   - Content-Type is overridden per request to the file's type
 *   - the display name travels in `X-File-Name`, percent-encoded, because HTTP
 *     header values cannot carry arbitrary Unicode and a student's file may well
 *     be named in Hindi or contain an em dash
 *
 * DOWNLOADS GO THROUGH AXIOS RATHER THAN A PLAIN LINK for a related reason: the
 * download route is authenticated, and an `<a href>` sends no Authorization
 * header, so a link would return 401. The file is fetched as a blob and handed to
 * the browser from memory.
 */

import axiosInstance from './axiosInstance.js';
import { resolveUploadMimeType } from '../constants/portfolio.js';

/**
 * GET /students/portfolio
 *
 * Resolves `{profile, completion}`. `profile` is null — not an error — for a
 * student who has not created a profile yet, and `completion` is null with it.
 *
 * @returns {Promise<{profile: object|null, completion: object|null}>}
 */
export const fetchMyPortfolio = async () => {
  const response = await axiosInstance.get('/students/portfolio');
  const { profile = null, completion = null } = response.data.data;
  return { profile, completion };
};

/**
 * GET /students/portfolio/completion
 *
 * The score on its own, for refreshing the panel without re-fetching everything.
 * Always resolves to a real object: no profile is an honest 0%, not an error.
 *
 * @returns {Promise<{completionPercentage: number, completedSections: string[],
 *                    missingSections: Array<object>}>}
 */
export const fetchMyCompletion = async () => {
  const response = await axiosInstance.get('/students/portfolio/completion');
  return response.data.data.completion;
};

/**
 * Every mutation resolves to the same `{profile, completion}` pair, because every
 * write can move the score — adding a project changes it, and so does deleting
 * one. Returning both means the panel can never disagree with the list it sits
 * next to, and the client never recomputes a number the server owns.
 */
const unwrapMutation = (response) => {
  const { profile, completion, document = null } = response.data.data;
  return { profile, completion, document };
};

// --- projects --------------------------------------------------------------

export const createProject = async (payload) =>
  unwrapMutation(await axiosInstance.post('/students/portfolio/projects', payload));

export const updateProject = async (projectId, payload) =>
  unwrapMutation(await axiosInstance.patch(`/students/portfolio/projects/${projectId}`, payload));

export const deleteProject = async (projectId) =>
  unwrapMutation(await axiosInstance.delete(`/students/portfolio/projects/${projectId}`));

// --- certifications --------------------------------------------------------

export const createCertification = async (payload) =>
  unwrapMutation(await axiosInstance.post('/students/portfolio/certifications', payload));

export const updateCertification = async (certificationId, payload) =>
  unwrapMutation(
    await axiosInstance.patch(`/students/portfolio/certifications/${certificationId}`, payload),
  );

export const deleteCertification = async (certificationId) =>
  unwrapMutation(
    await axiosInstance.delete(`/students/portfolio/certifications/${certificationId}`),
  );

// --- achievements ----------------------------------------------------------

export const createAchievement = async (payload) =>
  unwrapMutation(await axiosInstance.post('/students/portfolio/achievements', payload));

export const updateAchievement = async (achievementId, payload) =>
  unwrapMutation(
    await axiosInstance.patch(`/students/portfolio/achievements/${achievementId}`, payload),
  );

export const deleteAchievement = async (achievementId) =>
  unwrapMutation(await axiosInstance.delete(`/students/portfolio/achievements/${achievementId}`));

// --- experience ------------------------------------------------------------

export const createExperience = async (payload) =>
  unwrapMutation(await axiosInstance.post('/students/portfolio/experiences', payload));

export const updateExperience = async (experienceId, payload) =>
  unwrapMutation(
    await axiosInstance.patch(`/students/portfolio/experiences/${experienceId}`, payload),
  );

export const deleteExperience = async (experienceId) =>
  unwrapMutation(await axiosInstance.delete(`/students/portfolio/experiences/${experienceId}`));

// --- documents -------------------------------------------------------------

/**
 * Thrown before any request when a chosen file is obviously unacceptable.
 *
 * Shaped like axiosInstance's normalised rejection so a component can render it
 * through exactly the same path as a server error, with no special case.
 */
const localUploadError = (message) => ({
  status: 0,
  message,
  errors: [{ field: 'file', message }],
  isNetworkError: false,
  isLocal: true,
});

/**
 * Builds the request config for a raw-body upload.
 *
 * `Content-Type` is overridden because axiosInstance defaults to
 * `application/json`, and sending a PDF under that header would have the server's
 * JSON parser try to consume it. `transformRequest` is emptied so axios passes the
 * File through untouched rather than attempting to serialise it.
 */
const uploadConfig = (file, mimeType) => ({
  headers: {
    'Content-Type': mimeType,
    // Percent-encoded: header values are effectively latin-1, and the server
    // decodes this back. Display metadata only — it never becomes a path.
    'X-File-Name': encodeURIComponent(file.name),
  },
  transformRequest: [(data) => data],
});

/**
 * Checks a file locally, then returns what the request needs.
 *
 * Refusing here is a courtesy, not a security control: the server re-checks the
 * declared type against the allowlist AND against the file's own magic bytes, and
 * counts the real bytes as they arrive. This exists so a student picking a 40 MB
 * video gets an instant, specific answer instead of a slow upload and a 400.
 */
const prepareUpload = (file, maxBytes) => {
  if (!file) throw localUploadError('Choose a file first.');

  if (file.size === 0) {
    throw localUploadError('That file is empty. Check it opens on your computer first.');
  }

  if (file.size > maxBytes) {
    const limit = Math.round(maxBytes / (1024 * 1024));
    throw localUploadError(`Files must be ${limit} MB or smaller. That one is larger.`);
  }

  const mimeType = resolveUploadMimeType(file);

  if (!mimeType) {
    throw localUploadError(
      'That file type is not accepted. Use a PDF, PNG, JPG, DOCX or TXT file.',
    );
  }

  return uploadConfig(file, mimeType);
};

/**
 * POST /students/portfolio/resume
 *
 * Replaces whatever resume was there: a student has one current CV, and the old
 * file is deleted from the server once the new metadata is safely saved.
 *
 * @param {File} file
 * @param {{maxBytes?: number}} [options]
 * @returns {Promise<{profile: object, completion: object, document: object}>}
 */
export const uploadResume = async (file, { maxBytes = 5 * 1024 * 1024 } = {}) => {
  const config = prepareUpload(file, maxBytes);
  return unwrapMutation(await axiosInstance.post('/students/portfolio/resume', file, config));
};

/** DELETE /students/portfolio/resume */
export const deleteResume = async () =>
  unwrapMutation(await axiosInstance.delete('/students/portfolio/resume'));

/**
 * POST /students/portfolio/:section/:entryId/document
 *
 * The section decides the document type server-side, so there is no documentType
 * to pass and no way to attach a certificate to a project.
 *
 * @param {'projects'|'certifications'|'achievements'|'experiences'} section
 * @param {string} entryId
 * @param {File} file
 */
export const uploadEntryDocument = async (
  section,
  entryId,
  file,
  { maxBytes = 5 * 1024 * 1024 } = {},
) => {
  const config = prepareUpload(file, maxBytes);

  return unwrapMutation(
    await axiosInstance.post(`/students/portfolio/${section}/${entryId}/document`, file, config),
  );
};

/** DELETE /students/portfolio/:section/:entryId/document */
export const deleteEntryDocument = async (section, entryId) =>
  unwrapMutation(
    await axiosInstance.delete(`/students/portfolio/${section}/${entryId}/document`),
  );

/**
 * GET /students/portfolio/documents/:fileName
 *
 * Fetches the bytes as a Blob. This is the one call in the app whose response is
 * not the `{success, message, data}` envelope, because the body is a file.
 *
 * @param {string} fileName the server-generated storage name from the metadata
 * @returns {Promise<Blob>}
 */
export const fetchDocumentBlob = async (fileName) => {
  const response = await axiosInstance.get(`/students/portfolio/documents/${fileName}`, {
    responseType: 'blob',
  });

  return response.data;
};

/**
 * Fetches a document and hands it to the browser as a download.
 *
 * The object URL is revoked afterwards; without that, every download would leak
 * the whole file for as long as the tab stays open, which on a portfolio page a
 * student clicks through is a real amount of memory.
 *
 * @param {{fileName: string, originalName?: string}} metadata
 */
export const downloadDocument = async ({ fileName, originalName }) => {
  const blob = await fetchDocumentBlob(fileName);
  const url = URL.createObjectURL(blob);

  try {
    const link = window.document.createElement('a');
    link.href = url;
    link.download = originalName || fileName;
    // Appended before clicking: a detached anchor is ignored by some browsers.
    window.document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // A tick of delay, because revoking synchronously can cancel the download
    // that was only just handed to the browser.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

export default {
  fetchMyPortfolio,
  fetchMyCompletion,
  createProject,
  updateProject,
  deleteProject,
  createCertification,
  updateCertification,
  deleteCertification,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  createExperience,
  updateExperience,
  deleteExperience,
  uploadResume,
  deleteResume,
  uploadEntryDocument,
  deleteEntryDocument,
  fetchDocumentBlob,
  downloadDocument,
};
