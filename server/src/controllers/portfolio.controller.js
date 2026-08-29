/**
 * Portfolio controllers — request in, envelope out.
 *
 * EVERY HANDLER READS `req.user.id`. That is the shape `authMiddleware` provides:
 * it sets `req.user = user.toSafeObject()`, and `toSafeObject()` returns
 * `{id, name, email, role, isActive, createdAt}` — a string `id`, and no `_id` at
 * all. `req.user._id` would be `undefined`, which as a Mongoose query filter
 * matches nothing rather than throwing, so the failure would be a silent empty
 * result rather than a loud error. Hence: `req.user.id`, everywhere, always.
 *
 * No handler reads a student id from the body, the query or the params. There is
 * no route in this module that takes one — see `portfolio.service.js` on why
 * ownership is structural rather than checked.
 *
 * Mutating handlers return the whole portfolio plus the recomputed completion, so
 * the page cannot drift out of sync with the server after an edit.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import env from '../config/env.js';
import { DOCUMENT_TYPES } from '../constants/portfolio.js';
import {
  addAchievement,
  addCertification,
  addExperience,
  addProject,
  getOwnCompletion,
  getOwnPortfolio,
  readOwnDocument,
  removeAchievement,
  removeCertification,
  removeDocument,
  removeExperience,
  removeProject,
  updateAchievement,
  updateCertification,
  updateExperience,
  updateProject,
  uploadDocument,
} from '../services/portfolio.service.js';

// --- reading ---------------------------------------------------------------

/**
 * GET /students/portfolio
 *
 * `profile: null` is a 200, not a 404: "you have not created a profile yet" is a
 * normal first-run state and the page renders a prompt for it.
 */
export const getPortfolio = asyncHandler(async (req, res) => {
  const { profile, completion } = await getOwnPortfolio({ userId: req.user.id });

  sendSuccess(res, {
    message: profile ? 'Portfolio loaded.' : 'No profile yet.',
    data: { profile, completion },
  });
});

/** GET /students/portfolio/completion */
export const getCompletion = asyncHandler(async (req, res) => {
  const completion = await getOwnCompletion({ userId: req.user.id });

  sendSuccess(res, { message: 'Portfolio completion calculated.', data: { completion } });
});

// --- projects --------------------------------------------------------------

export const createProject = asyncHandler(async (req, res) => {
  const result = await addProject({ userId: req.user.id, data: req.body });

  sendCreated(res, { message: 'Project added.', data: result });
});

export const patchProject = asyncHandler(async (req, res) => {
  const result = await updateProject({
    userId: req.user.id,
    projectId: req.params.projectId,
    data: req.body,
  });

  sendSuccess(res, { message: 'Project updated.', data: result });
});

/**
 * Returns 200 with the updated portfolio rather than 204.
 *
 * Same reasoning as `deleteSkill` in the profile controller: removing a record
 * changes the completion score, and the client should not have to guess the new
 * value or make a second request for it.
 */
export const deleteProject = asyncHandler(async (req, res) => {
  const result = await removeProject({
    userId: req.user.id,
    projectId: req.params.projectId,
  });

  sendSuccess(res, { message: 'Project removed.', data: result });
});

// --- certifications --------------------------------------------------------

export const createCertification = asyncHandler(async (req, res) => {
  const result = await addCertification({ userId: req.user.id, data: req.body });

  sendCreated(res, { message: 'Certification added.', data: result });
});

export const patchCertification = asyncHandler(async (req, res) => {
  const result = await updateCertification({
    userId: req.user.id,
    certificationId: req.params.certificationId,
    data: req.body,
  });

  sendSuccess(res, { message: 'Certification updated.', data: result });
});

export const deleteCertification = asyncHandler(async (req, res) => {
  const result = await removeCertification({
    userId: req.user.id,
    certificationId: req.params.certificationId,
  });

  sendSuccess(res, { message: 'Certification removed.', data: result });
});

// --- achievements ----------------------------------------------------------

export const createAchievement = asyncHandler(async (req, res) => {
  const result = await addAchievement({ userId: req.user.id, data: req.body });

  sendCreated(res, { message: 'Achievement added.', data: result });
});

export const patchAchievement = asyncHandler(async (req, res) => {
  const result = await updateAchievement({
    userId: req.user.id,
    achievementId: req.params.achievementId,
    data: req.body,
  });

  sendSuccess(res, { message: 'Achievement updated.', data: result });
});

export const deleteAchievement = asyncHandler(async (req, res) => {
  const result = await removeAchievement({
    userId: req.user.id,
    achievementId: req.params.achievementId,
  });

  sendSuccess(res, { message: 'Achievement removed.', data: result });
});

// --- experience ------------------------------------------------------------

export const createExperience = asyncHandler(async (req, res) => {
  const result = await addExperience({ userId: req.user.id, data: req.body });

  sendCreated(res, { message: 'Experience added.', data: result });
});

export const patchExperience = asyncHandler(async (req, res) => {
  const result = await updateExperience({
    userId: req.user.id,
    experienceId: req.params.experienceId,
    data: req.body,
  });

  sendSuccess(res, { message: 'Experience updated.', data: result });
});

export const deleteExperience = asyncHandler(async (req, res) => {
  const result = await removeExperience({
    userId: req.user.id,
    experienceId: req.params.experienceId,
  });

  sendSuccess(res, { message: 'Experience removed.', data: result });
});

// --- documents -------------------------------------------------------------

/**
 * POST /students/portfolio/resume
 *
 * The request body IS the file — raw bytes, not multipart, because no multipart
 * parser is available. `express.json()` does not touch it: these routes declare
 * binary content types that the JSON parser skips.
 *
 * The uploaded name arrives in the `X-File-Name` header, which is display
 * metadata only and is never used to build a path.
 */
export const uploadResume = asyncHandler(async (req, res) => {
  const result = await uploadDocument({
    req,
    userId: req.user.id,
    documentType: DOCUMENT_TYPES.RESUME,
    apiPrefix: env.apiPrefix,
  });

  sendCreated(res, { message: 'Resume uploaded.', data: result });
});

/** DELETE /students/portfolio/resume */
export const deleteResume = asyncHandler(async (req, res) => {
  const result = await removeDocument({
    userId: req.user.id,
    documentType: DOCUMENT_TYPES.RESUME,
  });

  sendSuccess(res, { message: 'Resume removed.', data: result });
});

/**
 * POST /students/portfolio/:section/:entryId/document
 *
 * The section in the path decides the document type, so a student cannot attach
 * a file to a record type it does not belong to. An unknown section is a 404 from
 * the router's own pattern rather than something this handler has to police.
 */
const SECTION_DOCUMENT_TYPES = Object.freeze({
  projects: DOCUMENT_TYPES.PROJECT_ATTACHMENT,
  certifications: DOCUMENT_TYPES.CERTIFICATE,
  achievements: DOCUMENT_TYPES.ACHIEVEMENT_PROOF,
  experiences: DOCUMENT_TYPES.EXPERIENCE_PROOF,
});

export const uploadEntryDocument = asyncHandler(async (req, res) => {
  const result = await uploadDocument({
    req,
    userId: req.user.id,
    documentType: SECTION_DOCUMENT_TYPES[req.params.section],
    entryId: req.params.entryId,
    apiPrefix: env.apiPrefix,
  });

  sendCreated(res, { message: 'Document uploaded.', data: result });
});

export const deleteEntryDocument = asyncHandler(async (req, res) => {
  const result = await removeDocument({
    userId: req.user.id,
    documentType: SECTION_DOCUMENT_TYPES[req.params.section],
    entryId: req.params.entryId,
  });

  sendSuccess(res, { message: 'Document removed.', data: result });
});

/**
 * GET /students/portfolio/documents/:fileName
 *
 * Sends the bytes, not the envelope — this is the one endpoint in the codebase
 * that does not return `{success, message, data}`, because the response body is a
 * file.
 *
 * WHY THIS ROUTE EXISTS AT ALL instead of `express.static('uploads')`: static
 * middleware would serve any file in the directory to anyone who knows or guesses
 * its name, with no authentication. Here the file must be referenced by the
 * caller's own profile or the answer is 404.
 *
 * `Content-Disposition: attachment` with a quoted, escaped filename, plus
 * `X-Content-Type-Options: nosniff`, keeps an uploaded HTML-ish file from being
 * rendered in the site's origin. A stored file is always a download, never a page.
 */
export const downloadDocument = asyncHandler(async (req, res) => {
  const { buffer, metadata } = await readOwnDocument({
    userId: req.user.id,
    fileName: req.params.fileName,
  });

  // Escape quotes and backslashes so a crafted display name cannot break out of
  // the quoted-string form and inject extra header parameters.
  const safeName = metadata.originalName.replace(/["\\]/g, '');

  res.setHeader('Content-Type', metadata.mimeType);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // A student's own document should not sit in a shared cache.
  res.setHeader('Cache-Control', 'private, no-store');

  res.status(200).send(buffer);
});

export default {
  getPortfolio,
  getCompletion,
  createProject,
  patchProject,
  deleteProject,
  createCertification,
  patchCertification,
  deleteCertification,
  createAchievement,
  patchAchievement,
  deleteAchievement,
  createExperience,
  patchExperience,
  deleteExperience,
  uploadResume,
  deleteResume,
  uploadEntryDocument,
  deleteEntryDocument,
  downloadDocument,
};
