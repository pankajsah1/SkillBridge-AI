/**
 * Student profile, career goal and skill request validation.
 *
 * Same shape as auth.validator.js: pure functions returning `{ field, message }[]`
 * with thin Express adapters at the bottom, so the rules stay unit-testable and
 * the 400 envelope stays identical to Step 2's.
 *
 * BACKEND VALIDATION IS THE SECURITY BOUNDARY. The React forms check the same
 * rules to give instant feedback, and none of that is trusted here. Note what
 * this file deliberately does NOT check: whether a skill id or role id actually
 * exists. That needs a database round-trip, so it belongs in the service, which
 * throws the same 400 envelope with the same field names.
 */

import AppError from '../utils/AppError.js';
import {
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
  isValidSkillLevel,
} from '../constants/skills.js';

/**
 * A 24-character hex string.
 *
 * Deliberately not `mongoose.Types.ObjectId.isValid()`, which returns true for
 * any 12-character string — "abcdefghijkl" passes it and then casts to a
 * meaningless id. A caller sending that has made a mistake and deserves a 400
 * naming the field, not a confusing 404 later.
 */
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export const isObjectIdLike = (value) =>
  typeof value === 'string' && OBJECT_ID_PATTERN.test(value.trim());

const MAX_INTERESTS = 20;
const MAX_INTEREST_LENGTH = 60;
const MAX_CAREER_GOALS = 5;

const isDefined = (value) => value !== undefined && value !== null;

/**
 * Validates one optional free-text field.
 *
 * Absent is always fine — every one of these is optional, because PHASES.md
 * PHASE 2 wants a student to save partial progress and come back. An empty
 * string is also fine: it is how a student clears a field they filled before.
 */
const checkOptionalString = (value, { field, max, label }, errors) => {
  if (!isDefined(value)) return;

  if (typeof value !== 'string') {
    errors.push({ field, message: `${label} must be text.` });
    return;
  }

  if (value.trim().length > max) {
    errors.push({ field, message: `${label} cannot exceed ${max} characters.` });
  }
};

/**
 * Validates an optional number within a range.
 *
 * `null` is meaningful here and allowed through: it is how a student clears
 * graduationYear or cgpa. An empty string is treated as null for the same
 * reason — HTML number inputs submit '' when cleared, and rejecting that would
 * make "I removed my CGPA" an error.
 */
const checkOptionalNumber = (value, { field, min, max, label, integer = false }, errors) => {
  if (value === undefined || value === null || value === '') return;

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    errors.push({ field, message: `${label} must be a number.` });
    return;
  }

  if (integer && !Number.isInteger(numeric)) {
    errors.push({ field, message: `${label} must be a whole number.` });
    return;
  }

  if (numeric < min || numeric > max) {
    errors.push({ field, message: `${label} must be between ${min} and ${max}.` });
  }
};

/** Validates the interests array: strings, bounded in count and length, no blanks. */
const checkInterests = (interests, errors) => {
  if (!isDefined(interests)) return;

  if (!Array.isArray(interests)) {
    errors.push({ field: 'interests', message: 'Interests must be a list.' });
    return;
  }

  if (interests.length > MAX_INTERESTS) {
    errors.push({
      field: 'interests',
      message: `Please list at most ${MAX_INTERESTS} interests.`,
    });
    return;
  }

  const nonString = interests.some((item) => typeof item !== 'string');
  if (nonString) {
    errors.push({ field: 'interests', message: 'Each interest must be text.' });
    return;
  }

  const trimmed = interests.map((item) => item.trim());

  if (trimmed.some((item) => item.length === 0)) {
    errors.push({ field: 'interests', message: 'Interests cannot be blank.' });
    return;
  }

  if (trimmed.some((item) => item.length > MAX_INTEREST_LENGTH)) {
    errors.push({
      field: 'interests',
      message: `Each interest must be ${MAX_INTEREST_LENGTH} characters or fewer.`,
    });
    return;
  }

  // Case-insensitive, because "React" and "react" as two interests is a mistake.
  const seen = new Set(trimmed.map((item) => item.toLowerCase()));
  if (seen.size !== trimmed.length) {
    errors.push({ field: 'interests', message: 'Please remove duplicate interests.' });
  }
};

/**
 * The fields a student may write on their own profile.
 *
 * This list IS the write whitelist — the service builds its update from it, so a
 * field cannot become writable by accident. Everything absent from it is either
 * owned by the server (userId, profileCompletion, readinessScore) or has its own
 * endpoint (skills, targetRoles).
 */
export const EDITABLE_PROFILE_FIELDS = Object.freeze([
  'headline',
  'bio',
  'institutionName',
  'degree',
  'branch',
  'graduationYear',
  'currentYear',
  'cgpa',
  'location',
  'interests',
]);

/**
 * Fields a caller might reasonably *expect* to be able to send here, but which
 * are managed elsewhere. Sending one is a 400 rather than a silent ignore: a
 * student who submits a skill list and gets 200 back with nothing saved has been
 * misled, and that is a worse failure than a clear error.
 */
const REDIRECTED_FIELDS = Object.freeze({
  skills: 'Use the skills endpoints to manage skills.',
  targetRoles: 'Use the career-goals endpoint to manage career goals.',
  careerGoals: 'Use the career-goals endpoint to manage career goals.',
});

/**
 * Rejects fields that belong to a different endpoint (see REDIRECTED_FIELDS).
 *
 * Fields the server owns outright — userId, profileCompletion, readinessScore,
 * projects, certifications — are handled differently: they are simply absent
 * from EDITABLE_PROFILE_FIELDS, so the service never reads them. Silent ignore
 * is right for those, because clients commonly PATCH a whole object back and
 * erroring on an unchanged server-owned field would be needlessly strict.
 */
const checkRedirectedFields = (body, errors) => {
  Object.entries(REDIRECTED_FIELDS).forEach(([field, message]) => {
    if (field in body) errors.push({ field, message });
  });
};

const checkProfileBody = (body, errors) => {
  checkOptionalString(body.headline, { field: 'headline', max: 120, label: 'Headline' }, errors);
  checkOptionalString(body.bio, { field: 'bio', max: 1000, label: 'Bio' }, errors);
  checkOptionalString(
    body.institutionName,
    { field: 'institutionName', max: 150, label: 'Institution name' },
    errors,
  );
  checkOptionalString(body.degree, { field: 'degree', max: 100, label: 'Degree' }, errors);
  checkOptionalString(body.branch, { field: 'branch', max: 100, label: 'Branch' }, errors);
  checkOptionalString(body.location, { field: 'location', max: 120, label: 'Location' }, errors);

  checkOptionalNumber(
    body.graduationYear,
    { field: 'graduationYear', min: 1950, max: 2100, label: 'Graduation year', integer: true },
    errors,
  );
  checkOptionalNumber(
    body.currentYear,
    { field: 'currentYear', min: 1, max: 6, label: 'Year of study', integer: true },
    errors,
  );
  checkOptionalNumber(body.cgpa, { field: 'cgpa', min: 0, max: 10, label: 'CGPA' }, errors);

  checkInterests(body.interests, errors);
  checkRedirectedFields(body, errors);
};

/**
 * POST /students/profile — creating a profile.
 *
 * Every field is optional, which is intentional: DESIGN.md section 15.2 and
 * PHASES.md PHASE 2 both assume a profile exists first and gets completed
 * gradually, and the completion percentage is the mechanism that nudges the
 * student onward. Demanding a full profile up front would make that meaningless.
 */
export const validateCreateProfileInput = (body = {}) => {
  const errors = [];
  checkProfileBody(body, errors);
  return errors;
};

/**
 * PATCH /students/profile — updating a profile.
 *
 * Same field rules, plus one extra: an empty patch is rejected. It is almost
 * always a client bug (a form submitting nothing), and returning 200 "updated"
 * for a request that changed nothing hides it.
 */
export const validateUpdateProfileInput = (body = {}) => {
  const errors = [];

  const touched = EDITABLE_PROFILE_FIELDS.filter((field) => field in body);
  if (touched.length === 0 && Object.keys(REDIRECTED_FIELDS).every((f) => !(f in body))) {
    errors.push({
      field: 'body',
      message: 'No editable fields were provided.',
    });
    return errors;
  }

  checkProfileBody(body, errors);
  return errors;
};

/**
 * PUT /students/profile/career-goals — replacing the whole selection.
 *
 * Replace rather than append, because "these are my career goals" is a set the
 * student edits as a whole in the UI. An empty array is valid: it means "I have
 * not decided yet", and a student must be able to undo a choice.
 *
 * Accepts either `["id", "id"]` or `[{ roleId, priority }]`. The array form is
 * what a checkbox list naturally produces; the object form is what lets a
 * student rank goals. Normalising both here keeps the service simple.
 */
export const validateCareerGoalsInput = (body = {}) => {
  const errors = [];
  const { roleIds } = body;

  if (!isDefined(roleIds)) {
    errors.push({ field: 'roleIds', message: 'Please provide your selected career goals.' });
    return errors;
  }

  if (!Array.isArray(roleIds)) {
    errors.push({ field: 'roleIds', message: 'Career goals must be a list.' });
    return errors;
  }

  if (roleIds.length > MAX_CAREER_GOALS) {
    errors.push({
      field: 'roleIds',
      message: `Please select at most ${MAX_CAREER_GOALS} career goals.`,
    });
    return errors;
  }

  const ids = [];

  roleIds.forEach((entry, index) => {
    const id = typeof entry === 'string' ? entry : entry?.roleId;

    if (!isObjectIdLike(id)) {
      errors.push({
        field: `roleIds[${index}]`,
        message: 'Career goal reference is not a valid id.',
      });
      return;
    }

    if (typeof entry === 'object' && entry !== null && isDefined(entry.priority)) {
      const priority = Number(entry.priority);
      if (!Number.isInteger(priority) || priority < 1) {
        errors.push({
          field: `roleIds[${index}].priority`,
          message: 'Priority must be a whole number of 1 or more.',
        });
      }
    }

    ids.push(id.trim().toLowerCase());
  });

  if (new Set(ids).size !== ids.length) {
    errors.push({ field: 'roleIds', message: 'The same career goal was selected twice.' });
  }

  return errors;
};

/**
 * Normalises a validated career-goals payload into `[{ roleId, priority }]`.
 *
 * Priority defaults to array position, so an unranked checkbox list still gets a
 * stable, meaningful order instead of every goal claiming priority 1.
 */
export const normaliseCareerGoals = (roleIds = []) =>
  roleIds.map((entry, index) => ({
    roleId: (typeof entry === 'string' ? entry : entry.roleId).trim(),
    priority:
      typeof entry === 'object' && entry !== null && isDefined(entry.priority)
        ? Number(entry.priority)
        : index + 1,
  }));

/** Shared level check for adding and updating a skill. */
const checkLevel = (level, errors) => {
  if (!isDefined(level)) {
    errors.push({ field: 'level', message: 'Please choose a proficiency level.' });
    return;
  }

  const numeric = Number(level);

  if (!Number.isFinite(numeric)) {
    errors.push({ field: 'level', message: 'Proficiency level must be a number.' });
    return;
  }

  /**
   * Integers only. The stored value is compared against a career role's
   * requiredLevel later, and 67.4 versus 67 is a distinction without a
   * difference that would only make the numbers look falsely precise.
   */
  if (!isValidSkillLevel(numeric)) {
    errors.push({
      field: 'level',
      message: `Proficiency level must be a whole number between ${SKILL_LEVEL_MIN} and ${SKILL_LEVEL_MAX}.`,
    });
  }
};

/** POST /students/profile/skills */
export const validateAddSkillInput = (body = {}) => {
  const errors = [];

  if (!isObjectIdLike(body.skillId)) {
    errors.push({ field: 'skillId', message: 'Please choose a skill from the list.' });
  }

  checkLevel(body.level, errors);

  return errors;
};

/** PATCH /students/profile/skills/:skillId */
export const validateUpdateSkillInput = (body = {}) => {
  const errors = [];
  checkLevel(body.level, errors);
  return errors;
};

/**
 * Validates an `:id`-style route parameter.
 *
 * Params, not the body — so it needs its own adapter rather than toMiddleware.
 */
export const validateObjectIdParam = (paramName) => (req, _res, next) => {
  const value = req.params[paramName];

  if (!isObjectIdLike(value)) {
    return next(
      AppError.badRequest('Validation failed', [
        { field: paramName, message: 'That is not a valid id.' },
      ]),
    );
  }

  return next();
};

/**
 * Validates an optional `?name=` query parameter that should be an id.
 *
 * Absent is fine and means "use my primary career goal", so only a present-but-
 * malformed value is an error. Without this a typo in the query string would
 * reach Mongoose and come back as a cast error, which reads like a server fault
 * rather than a bad request.
 */
export const validateOptionalObjectIdQuery = (queryName) => (req, _res, next) => {
  const value = req.query[queryName];

  if (value === undefined || value === '') return next();

  if (!isObjectIdLike(value)) {
    return next(
      AppError.badRequest('Validation failed', [
        { field: queryName, message: 'That is not a valid id.' },
      ]),
    );
  }

  return next();
};

/** Identical adapter to auth.validator.js, so the 400 shape cannot drift. */
const toMiddleware = (validator) => (req, _res, next) => {
  const errors = validator(req.body);

  if (errors.length > 0) {
    return next(AppError.badRequest('Validation failed', errors));
  }

  return next();
};

export const validateCreateProfile = toMiddleware(validateCreateProfileInput);
export const validateUpdateProfile = toMiddleware(validateUpdateProfileInput);
export const validateCareerGoals = toMiddleware(validateCareerGoalsInput);
export const validateAddSkill = toMiddleware(validateAddSkillInput);
export const validateUpdateSkill = toMiddleware(validateUpdateSkillInput);

export const PROFILE_LIMITS = Object.freeze({
  maxInterests: MAX_INTERESTS,
  maxInterestLength: MAX_INTEREST_LENGTH,
  maxCareerGoals: MAX_CAREER_GOALS,
});
