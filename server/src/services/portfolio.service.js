/**
 * Portfolio service — projects, certifications, achievements, experience,
 * resume, documents and the completion score.
 *
 * OWNERSHIP IS STRUCTURAL, NOT CHECKED. Exactly as in
 * `studentProfile.service.js`: every function takes a `userId` the caller read
 * from `req.user.id`, and every query filters on it. There is no function here
 * that accepts a student id from a request, so "read someone else's portfolio"
 * is not an operation this module can perform. That is why you will not find an
 * `if (record.userId !== userId) throw` anywhere below — the check would be dead
 * code, and dead security code is how people convince themselves a system is
 * safe.
 *
 * A missing subdocument and someone else's subdocument are indistinguishable
 * from the client's side: both are 404 "not found in your portfolio". So ids
 * cannot be probed for existence.
 *
 * THE FILE-ORPHANING PROBLEM. Metadata lives in Mongo, bytes live on disk, and
 * there is no transaction spanning both. The order of operations is chosen so the
 * failure mode is a harmless orphaned file rather than a broken link:
 *   - on upload:  write the file, then save the metadata. If the save fails the
 *                 file is deleted immediately; if the delete also fails, an
 *                 unreferenced file sits on disk and nothing is broken.
 *   - on delete:  remove the metadata first, then the file. If the unlink fails
 *                 the student still sees the record gone, which is what they
 *                 asked for.
 * A link that points at nothing would be worse than a file nobody references.
 */

import StudentProfile from '../models/StudentProfile.js';
import AppError from '../utils/AppError.js';
import { DOCUMENT_TYPES, PORTFOLIO_LIMITS } from '../constants/portfolio.js';
import {
  deleteStoredDocument,
  readLimitedBody,
  readStoredDocument,
  storeDocument,
} from './document.service.js';

/** Same populate set the profile service uses, so skills arrive with names. */
const POPULATE_REFS = [
  { path: 'skills.skillId', select: 'name slug category tags' },
  { path: 'targetRoles.roleId', select: 'title slug category' },
];

/**
 * The caller's profile, or a 404 that says what to do about it.
 *
 * Not populated: callers that mutate need a plain document to save, and
 * re-reading with populate afterwards is cheaper than populating twice.
 */
const requireOwnProfile = async (userId) => {
  const profile = await StudentProfile.findOne({ userId });

  if (!profile) {
    throw AppError.notFound(
      'You do not have a profile yet. Create your profile before building your portfolio.',
    );
  }

  return profile;
};

/**
 * Saves, then re-reads with refs populated.
 *
 * `recomputeCompletion()` is called because it is a plain method that does not
 * fire on save — the stored `profileCompletion` would otherwise drift every time
 * a portfolio section changed. The *portfolio* completion score is derived on
 * read instead and needs no such call.
 */
const persist = async (profile) => {
  profile.recomputeCompletion();
  await profile.save();

  // save() leaves subdocument refs as bare ids, so the response would be missing
  // skill names without this second read.
  return StudentProfile.findOne({ userId: profile.userId }).populate(POPULATE_REFS);
};

/**
 * Locates one subdocument in one of the portfolio arrays.
 *
 * `profile` was already fetched by owner, so anything found here belongs to the
 * caller by construction. The 404 message deliberately says "in your portfolio":
 * it is true whether the id does not exist or belongs to another student, and it
 * leaks nothing either way.
 */
const requireEntry = (profile, arrayName, entryId, label) => {
  const entry = profile[arrayName].id(entryId);

  if (!entry) {
    throw AppError.notFound(`That ${label} is not in your portfolio.`);
  }

  return entry;
};

/**
 * Copies whitelisted fields from a request body onto a subdocument.
 *
 * The whitelist is the security boundary. `verificationStatus` is not in any
 * caller's field list, so no request can set it — and the validator additionally
 * rejects the attempt loudly rather than dropping it silently.
 *
 * `''` becomes `null` for date fields so a student can clear a date they set by
 * mistake; an empty string would otherwise become `Invalid Date`.
 */
const applyFields = (entry, body, fields, dateFields = []) => {
  for (const field of fields) {
    if (body[field] === undefined) continue;

    const value = body[field];

    if (dateFields.includes(field)) {
      entry[field] = value === '' || value === null ? null : new Date(value);
      continue;
    }

    if (typeof value === 'string') {
      entry[field] = value.trim();
      continue;
    }

    if (Array.isArray(value)) {
      entry[field] = value.map((item) => (typeof item === 'string' ? item.trim() : item));
      continue;
    }

    entry[field] = value;
  }
};

const assertRoom = (profile, arrayName, max, label) => {
  if (profile[arrayName].length >= max) {
    throw AppError.badRequest(
      `You already have ${max} ${label}. Remove one before adding another.`,
    );
  }
};

// --- reading ---------------------------------------------------------------

/**
 * The whole portfolio in one read.
 *
 * Returns `{profile, completion}` where `completion` is derived, never stored.
 * Returns `profile: null` rather than throwing when there is no profile yet — a
 * brand-new student is a normal state, and the UI shows a "create your profile
 * first" prompt instead of an error.
 *
 * @param {{userId: string}} params
 */
export const getOwnPortfolio = async ({ userId }) => {
  const profile = await StudentProfile.findOne({ userId }).populate(POPULATE_REFS);

  if (!profile) return { profile: null, completion: null };

  return {
    profile: profile.toProfileObject(),
    completion: profile.computePortfolioCompletion(),
  };
};

/**
 * Just the completion score.
 *
 * A separate endpoint because the completion panel refreshes after every edit and
 * does not need the entire portfolio payload to do it.
 *
 * @param {{userId: string}} params
 */
export const getOwnCompletion = async ({ userId }) => {
  const profile = await StudentProfile.findOne({ userId });

  if (!profile) {
    // Honest zero: no profile really is 0% complete, and the missing sections are
    // exactly the advice a first-time student needs.
    const empty = new StudentProfile({ userId });
    return empty.computePortfolioCompletion();
  }

  return profile.computePortfolioCompletion();
};

// --- projects --------------------------------------------------------------

const PROJECT_FIELDS = [
  'title',
  'description',
  'technologies',
  'role',
  'githubUrl',
  'liveUrl',
  'startDate',
  'endDate',
  'isOngoing',
];

export const addProject = async ({ userId, data }) => {
  const profile = await requireOwnProfile(userId);
  assertRoom(profile, 'projects', PORTFOLIO_LIMITS.maxProjects, 'projects');

  // push({}) then apply, so the whitelist is the only path onto the subdocument
  // and a stray body field cannot ride along in an object spread. Pushing an
  // EMPTY object matters: seeding it with placeholder text would mean a field the
  // validator somehow let through gets stored as the literal word "placeholder"
  // instead of failing loudly at save.
  profile.projects.push({});
  const entry = profile.projects[profile.projects.length - 1];
  applyFields(entry, data, PROJECT_FIELDS, ['startDate', 'endDate']);

  const saved = await persist(profile);
  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

export const updateProject = async ({ userId, projectId, data }) => {
  const profile = await requireOwnProfile(userId);
  const entry = requireEntry(profile, 'projects', projectId, 'project');

  applyFields(entry, data, PROJECT_FIELDS, ['startDate', 'endDate']);

  const saved = await persist(profile);
  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

export const removeProject = async ({ userId, projectId }) => {
  const profile = await requireOwnProfile(userId);
  const entry = requireEntry(profile, 'projects', projectId, 'project');

  const attachedFile = entry.document?.fileName ?? null;
  entry.deleteOne();

  const saved = await persist(profile);
  // Metadata first, bytes second — see the header note on orphaning.
  if (attachedFile) await deleteStoredDocument(attachedFile);

  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

// --- certifications --------------------------------------------------------

const CERTIFICATION_FIELDS = [
  'title',
  'issuingOrganization',
  'issueDate',
  'expiryDate',
  'credentialId',
  'credentialUrl',
];

export const addCertification = async ({ userId, data }) => {
  const profile = await requireOwnProfile(userId);
  assertRoom(profile, 'certifications', PORTFOLIO_LIMITS.maxCertifications, 'certifications');

  profile.certifications.push({});
  const entry = profile.certifications[profile.certifications.length - 1];
  applyFields(entry, data, CERTIFICATION_FIELDS, ['issueDate', 'expiryDate']);

  const saved = await persist(profile);
  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

export const updateCertification = async ({ userId, certificationId, data }) => {
  const profile = await requireOwnProfile(userId);
  const entry = requireEntry(profile, 'certifications', certificationId, 'certification');

  applyFields(entry, data, CERTIFICATION_FIELDS, ['issueDate', 'expiryDate']);

  const saved = await persist(profile);
  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

export const removeCertification = async ({ userId, certificationId }) => {
  const profile = await requireOwnProfile(userId);
  const entry = requireEntry(profile, 'certifications', certificationId, 'certification');

  const attachedFile = entry.document?.fileName ?? null;
  entry.deleteOne();

  const saved = await persist(profile);
  if (attachedFile) await deleteStoredDocument(attachedFile);

  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

// --- achievements ----------------------------------------------------------

const ACHIEVEMENT_FIELDS = [
  'title',
  'description',
  'achievementType',
  'date',
  'issuingOrganization',
];

export const addAchievement = async ({ userId, data }) => {
  const profile = await requireOwnProfile(userId);
  assertRoom(profile, 'achievements', PORTFOLIO_LIMITS.maxAchievements, 'achievements');

  profile.achievements.push({});
  const entry = profile.achievements[profile.achievements.length - 1];
  applyFields(entry, data, ACHIEVEMENT_FIELDS, ['date']);

  const saved = await persist(profile);
  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

export const updateAchievement = async ({ userId, achievementId, data }) => {
  const profile = await requireOwnProfile(userId);
  const entry = requireEntry(profile, 'achievements', achievementId, 'achievement');

  applyFields(entry, data, ACHIEVEMENT_FIELDS, ['date']);

  const saved = await persist(profile);
  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

export const removeAchievement = async ({ userId, achievementId }) => {
  const profile = await requireOwnProfile(userId);
  const entry = requireEntry(profile, 'achievements', achievementId, 'achievement');

  const attachedFile = entry.document?.fileName ?? null;
  entry.deleteOne();

  const saved = await persist(profile);
  if (attachedFile) await deleteStoredDocument(attachedFile);

  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

// --- experience ------------------------------------------------------------

const EXPERIENCE_FIELDS = [
  'organization',
  'role',
  'experienceType',
  'startDate',
  'endDate',
  'isCurrent',
  'description',
  'skillsUsed',
];

export const addExperience = async ({ userId, data }) => {
  const profile = await requireOwnProfile(userId);
  assertRoom(profile, 'experiences', PORTFOLIO_LIMITS.maxExperiences, 'experience records');

  profile.experiences.push({});
  const entry = profile.experiences[profile.experiences.length - 1];
  applyFields(entry, data, EXPERIENCE_FIELDS, ['startDate', 'endDate']);

  const saved = await persist(profile);
  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

export const updateExperience = async ({ userId, experienceId, data }) => {
  const profile = await requireOwnProfile(userId);
  const entry = requireEntry(profile, 'experiences', experienceId, 'experience record');

  applyFields(entry, data, EXPERIENCE_FIELDS, ['startDate', 'endDate']);

  const saved = await persist(profile);
  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

export const removeExperience = async ({ userId, experienceId }) => {
  const profile = await requireOwnProfile(userId);
  const entry = requireEntry(profile, 'experiences', experienceId, 'experience record');

  const attachedFile = entry.document?.fileName ?? null;
  entry.deleteOne();

  const saved = await persist(profile);
  if (attachedFile) await deleteStoredDocument(attachedFile);

  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

// --- documents -------------------------------------------------------------

/**
 * Where an uploaded document may be attached.
 *
 * Keyed by document type, because the *type* determines the *destination* — that
 * is what stops this being a general file store. A `certificate` can only ever
 * land on a certification subdocument; there is no way to upload a file that
 * belongs nowhere.
 */
const ATTACHMENT_TARGETS = Object.freeze({
  [DOCUMENT_TYPES.CERTIFICATE]: { arrayName: 'certifications', label: 'certification' },
  [DOCUMENT_TYPES.ACHIEVEMENT_PROOF]: { arrayName: 'achievements', label: 'achievement' },
  [DOCUMENT_TYPES.EXPERIENCE_PROOF]: { arrayName: 'experiences', label: 'experience record' },
  [DOCUMENT_TYPES.PROJECT_ATTACHMENT]: { arrayName: 'projects', label: 'project' },
});

/**
 * Stores an uploaded file and attaches its metadata to the right place.
 *
 * The `req` is passed in rather than a buffer because the body must be read with
 * a hard byte cap; handing this function an already-buffered request would mean
 * the cap had already been bypassed. Reading the profile FIRST also matters — an
 * upload aimed at a record that is not yours is rejected before a single byte is
 * accepted, so a hostile client cannot use the upload path to consume disk.
 *
 * @param {{req: import('express').Request, userId: string, documentType: string,
 *          entryId?: string, apiPrefix: string}} params
 */
export const uploadDocument = async ({ req, userId, documentType, entryId, apiPrefix }) => {
  const profile = await requireOwnProfile(userId);

  const target = ATTACHMENT_TARGETS[documentType];

  // Resolve the destination before touching the network stream.
  let entry = null;
  if (target) {
    if (!entryId) {
      throw AppError.badRequest(`Choose which ${target.label} this file belongs to.`);
    }
    entry = requireEntry(profile, target.arrayName, entryId, target.label);
  } else if (documentType !== DOCUMENT_TYPES.RESUME) {
    throw AppError.badRequest('That document type is not recognised.');
  }

  const buffer = await readLimitedBody(req);

  const metadata = await storeDocument({
    buffer,
    mimeType: req.uploadMeta.mimeType,
    originalName: req.uploadMeta.originalName,
    documentType,
    ownerId: userId,
    apiPrefix,
  });

  // The file being replaced, captured before the pointer is overwritten.
  const previousFile = entry ? entry.document?.fileName : profile.resume?.fileName;

  if (entry) entry.document = metadata;
  else profile.resume = metadata;

  let saved;
  try {
    saved = await persist(profile);
  } catch (error) {
    // The metadata never landed, so the bytes are unreferenced. Remove them
    // rather than leaving a file nothing points at.
    await deleteStoredDocument(metadata.fileName).catch(() => {});
    throw error;
  }

  // Only now is the old file unreachable, so only now is it safe to delete.
  if (previousFile && previousFile !== metadata.fileName) {
    await deleteStoredDocument(previousFile);
  }

  return {
    profile: saved.toProfileObject(),
    completion: saved.computePortfolioCompletion(),
    document: metadata,
  };
};

/**
 * Detaches a document and deletes its bytes.
 *
 * @param {{userId: string, documentType: string, entryId?: string}} params
 */
export const removeDocument = async ({ userId, documentType, entryId }) => {
  const profile = await requireOwnProfile(userId);
  const target = ATTACHMENT_TARGETS[documentType];

  let fileName = null;

  if (target) {
    if (!entryId) throw AppError.badRequest(`Say which ${target.label} to remove the file from.`);
    const entry = requireEntry(profile, target.arrayName, entryId, target.label);

    if (!entry.document) throw AppError.notFound('There is no file attached to that record.');
    fileName = entry.document.fileName;
    entry.document = null;
  } else if (documentType === DOCUMENT_TYPES.RESUME) {
    if (!profile.resume) throw AppError.notFound('You do not have a resume on file.');
    fileName = profile.resume.fileName;
    profile.resume = null;
  } else {
    throw AppError.badRequest('That document type is not recognised.');
  }

  const saved = await persist(profile);
  await deleteStoredDocument(fileName);

  return { profile: saved.toProfileObject(), completion: saved.computePortfolioCompletion() };
};

/**
 * Reads a document for download, but only if it is referenced by the caller's own
 * profile.
 *
 * THIS IS THE ACCESS CONTROL for downloads, and it is a lookup rather than a
 * comparison. The requested name is searched for among the file names recorded in
 * *this* profile; if it is not there, the answer is 404 — no filesystem access is
 * attempted at all. Another student's file therefore behaves exactly like a file
 * that does not exist, which is both secure and non-revealing.
 *
 * @param {{userId: string, fileName: string}} params
 * @returns {Promise<{buffer: Buffer, metadata: object}>}
 */
export const readOwnDocument = async ({ userId, fileName }) => {
  const profile = await requireOwnProfile(userId);

  const candidates = [
    profile.resume,
    ...profile.projects.map((project) => project.document),
    ...profile.certifications.map((certification) => certification.document),
    ...profile.achievements.map((achievement) => achievement.document),
    ...profile.experiences.map((experience) => experience.document),
  ].filter(Boolean);

  const metadata = candidates.find((document) => document.fileName === fileName);

  if (!metadata) throw AppError.notFound('Document not found.');

  const buffer = await readStoredDocument(metadata.fileName);

  if (!buffer) {
    // The record exists but the bytes are gone — say so plainly instead of
    // sending a zero-length file that looks like a corrupt download.
    throw AppError.notFound(
      'That file is no longer on the server. Please upload it again.',
    );
  }

  return { buffer, metadata };
};

export default {
  getOwnPortfolio,
  getOwnCompletion,
  addProject,
  updateProject,
  removeProject,
  addCertification,
  updateCertification,
  removeCertification,
  addAchievement,
  updateAchievement,
  removeAchievement,
  addExperience,
  updateExperience,
  removeExperience,
  uploadDocument,
  removeDocument,
  readOwnDocument,
};
