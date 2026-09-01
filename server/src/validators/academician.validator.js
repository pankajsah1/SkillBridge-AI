/**
 * Academician profile, expertise and record validation.
 *
 * Same shape as every other validator here: pure functions returning
 * `{field, message}[]`, with thin Express adapters at the bottom, so the rules stay
 * unit-testable and the 400 envelope is byte-identical to Step 2's.
 *
 * BACKEND VALIDATION IS THE SECURITY BOUNDARY. The React forms check the same rules
 * to give instant feedback and none of that is trusted here. Note what this file
 * deliberately does NOT check: whether a `skillId` points at a real, active Skill.
 * That needs a database round-trip, so it lives in academician.service.js — which
 * throws the same 400 envelope with the same field name, so the client cannot tell
 * the two layers apart and does not need to.
 *
 * THE PRIMITIVE CHECKS ARE IMPORTED, NOT RETYPED. `checkRequiredString`,
 * `checkDate`, `checkEnum` and the rest come from portfolio.validator.js, where they
 * already existed and were made exported (and otherwise untouched) in Step 7. An
 * academician's education record needs the same "a required name, at most N
 * characters" rule a student's certification does, and two copies of that rule is
 * two places for it to drift. The skill-level rules are re-exported from
 * studentProfile.validator.js for the same reason — see the note there.
 */

import AppError from '../utils/AppError.js';
import {
  ACADEMICIAN_DESIGNATIONS,
  ACADEMICIAN_DESIGNATION_VALUES,
  ACADEMICIAN_LIMITS,
  ACADEMIC_ACHIEVEMENT_TYPE_VALUES,
  ACADEMIC_EXPERIENCE_TYPE_VALUES,
} from '../constants/academicians.js';
import {
  checkBoolean,
  checkDate,
  checkEnum,
  checkOptionalString,
  checkOptionalUrl,
  checkRequiredString,
  checkStringArray,
} from './portfolio.validator.js';
import {
  validateAddSkillInput,
  validateUpdateSkillInput,
} from './studentProfile.validator.js';

/**
 * Adding and updating an expertise entry is validated by the student rules,
 * unchanged and unwrapped.
 *
 * The rule is "a well-formed skill id and a whole-number level from 0 to 100", and
 * that is the same sentence for a professor as for an undergraduate — the two
 * models even store the subdocument in the same shape on purpose, so that the
 * matching engine can read both. Re-exporting under the names the academician
 * routes use keeps a single definition while letting academician.routes.js import
 * everything it needs from one file.
 */
export const validateAddExpertiseInput = validateAddSkillInput;
export const validateUpdateExpertiseInput = validateUpdateSkillInput;

const isDefined = (value) => value !== undefined && value !== null;

/**
 * Validates an optional year, e.g. the year a degree was awarded.
 *
 * A year rather than a full date, matching the model: nobody remembers the day
 * their PhD was conferred, and asking for one invents precision. `null` and `''`
 * clear the field, which is how a client removes a year it set by mistake.
 */
const checkOptionalYear = (value, { field, label }, errors) => {
  if (value === undefined || value === null || value === '') return;

  const numeric = Number(value);

  if (!Number.isInteger(numeric)) {
    errors.push({ field, message: `${label} must be a whole year, like 2019.` });
    return;
  }

  if (numeric < 1900 || numeric > 2100) {
    errors.push({ field, message: `${label} must be between 1900 and 2100.` });
  }
};

/* ------------------------------------------------------------------ profile */

/**
 * The fields an academician may write on their own profile.
 *
 * THIS LIST IS THE WRITE WHITELIST — academician.service.js builds its update from
 * it, so a field cannot become writable by accident. Everything absent is either
 * owned by the server (`userId`, `profileCompletion`, `institutionId`) or has its
 * own endpoint (`skills`, `education`, `experiences`, `achievements`), exactly the
 * split studentProfile.validator.js uses.
 */
export const EDITABLE_ACADEMICIAN_FIELDS = Object.freeze([
  'headline',
  'bio',
  'institutionName',
  'department',
  'designation',
  'designationOther',
  'location',
  'expertiseAreas',
  'researchInterests',
  'isOpenToCollaboration',
]);

/**
 * Fields a caller might reasonably expect to send here but which are managed
 * elsewhere.
 *
 * A 400 rather than a silent ignore, for the reason studentProfile.validator.js
 * gives: an academician who PATCHes a list of publications, gets 200 back and finds
 * nothing saved has been misled, and that is a worse failure than a clear error
 * naming the endpoint to use instead.
 */
const REDIRECTED_FIELDS = Object.freeze({
  skills: 'Use the expertise endpoints to manage skills.',
  education: 'Use the education endpoints to manage qualifications.',
  experiences: 'Use the experience endpoints to manage positions held.',
  achievements: 'Use the achievement endpoints to manage publications and awards.',
});

const checkRedirectedFields = (body, errors) => {
  Object.entries(REDIRECTED_FIELDS).forEach(([field, message]) => {
    if (field in body) errors.push({ field, message });
  });
};

/**
 * `designationOther` is only meaningful alongside `designation: 'other'`.
 *
 * Checked rather than silently dropped, because the two together are a single
 * statement and a mismatch means the client sent something it did not mean. The
 * model's `normaliseProfile` hook also clears a stale value on save, so the stored
 * document is correct either way — this exists to tell the caller, not to protect
 * the database.
 *
 * Only enforced when `designation` is actually present in the body: a PATCH that
 * changes only `designationOther` on a profile already set to `other` is a normal
 * edit, and the value it pairs with is not in front of us to check.
 */
const checkDesignationPair = (body, errors) => {
  if (!('designation' in body)) return;
  if (!isDefined(body.designationOther) || String(body.designationOther).trim() === '') return;

  if (body.designation !== ACADEMICIAN_DESIGNATIONS.OTHER) {
    errors.push({
      field: 'designationOther',
      message: 'Only fill this in when your designation is "Other".',
    });
  }
};

const checkProfileBody = (body, errors) => {
  checkOptionalString(
    body.headline,
    { field: 'headline', max: ACADEMICIAN_LIMITS.maxHeadlineLength, label: 'Headline' },
    errors,
  );
  checkOptionalString(
    body.bio,
    { field: 'bio', max: ACADEMICIAN_LIMITS.maxBioLength, label: 'Profile summary' },
    errors,
  );
  checkOptionalString(
    body.institutionName,
    {
      field: 'institutionName',
      max: ACADEMICIAN_LIMITS.maxInstitutionLength,
      label: 'Institution name',
    },
    errors,
  );
  checkOptionalString(
    body.department,
    { field: 'department', max: ACADEMICIAN_LIMITS.maxDepartmentLength, label: 'Department' },
    errors,
  );
  checkOptionalString(
    body.designationOther,
    {
      field: 'designationOther',
      max: ACADEMICIAN_LIMITS.maxDesignationOtherLength,
      label: 'Designation',
    },
    errors,
  );
  checkOptionalString(
    body.location,
    { field: 'location', max: ACADEMICIAN_LIMITS.maxLocationLength, label: 'Location' },
    errors,
  );

  /**
   * `null` clears the designation, so it is allowed through — the model's enum
   * accepts null for exactly this reason. `checkEnum` already treats null and ''
   * as absent, so only a present, non-null, non-member value is an error.
   */
  checkEnum(
    body.designation,
    { field: 'designation', label: 'Designation', values: ACADEMICIAN_DESIGNATION_VALUES },
    errors,
  );

  checkStringArray(
    body.expertiseAreas,
    {
      field: 'expertiseAreas',
      label: 'Areas of expertise',
      maxItems: ACADEMICIAN_LIMITS.maxExpertiseAreas,
      maxLength: ACADEMICIAN_LIMITS.maxExpertiseAreaLength,
    },
    errors,
  );
  checkStringArray(
    body.researchInterests,
    {
      field: 'researchInterests',
      label: 'Research interests',
      maxItems: ACADEMICIAN_LIMITS.maxResearchInterests,
      maxLength: ACADEMICIAN_LIMITS.maxResearchInterestLength,
    },
    errors,
  );

  checkBoolean(
    body.isOpenToCollaboration,
    { field: 'isOpenToCollaboration', label: 'Open to collaboration' },
    errors,
  );

  checkDesignationPair(body, errors);
  checkRedirectedFields(body, errors);
};

/**
 * POST /academicians/profile
 *
 * Every field is optional, deliberately and for the same reason the student
 * profile's are: the completion percentage exists to nudge a profile forward over
 * several visits, and demanding a complete profile at creation would make that
 * mechanism pointless. A first-login profile with nothing but a `userId` is valid.
 */
export const validateCreateAcademicianProfileInput = (body = {}) => {
  const errors = [];
  checkProfileBody(body, errors);
  return errors;
};

/**
 * PATCH /academicians/profile
 *
 * Same field rules plus one: an empty patch is rejected. It is almost always a
 * client bug, and answering 200 "updated" to a request that changed nothing hides
 * it. A body containing only a redirected field skips this and reports the
 * redirect instead, which is the more useful of the two errors.
 */
export const validateUpdateAcademicianProfileInput = (body = {}) => {
  const errors = [];

  const touched = EDITABLE_ACADEMICIAN_FIELDS.filter((field) => field in body);
  const redirected = Object.keys(REDIRECTED_FIELDS).some((field) => field in body);

  if (touched.length === 0 && !redirected) {
    errors.push({ field: 'body', message: 'No editable fields were provided.' });
    return errors;
  }

  checkProfileBody(body, errors);
  return errors;
};

/* ---------------------------------------------------------------- education */

/** The writable fields of one qualification. Also the service's whitelist. */
export const EDUCATION_FIELDS = Object.freeze([
  'degree',
  'institution',
  'fieldOfStudy',
  'year',
]);

const checkEducationBody = (body, { isCreate }, errors) => {
  const checkName = isCreate ? checkRequiredString : checkOptionalString;

  checkName(
    body.degree,
    { field: 'degree', max: ACADEMICIAN_LIMITS.maxTitleLength, label: 'Degree' },
    errors,
  );
  checkName(
    body.institution,
    { field: 'institution', max: ACADEMICIAN_LIMITS.maxInstitutionLength, label: 'Institution' },
    errors,
  );
  checkOptionalString(
    body.fieldOfStudy,
    { field: 'fieldOfStudy', max: 120, label: 'Field of study' },
    errors,
  );
  checkOptionalYear(body.year, { field: 'year', label: 'Year' }, errors);
};

export const validateCreateEducationInput = (body = {}) => {
  const errors = [];
  checkEducationBody(body, { isCreate: true }, errors);
  return errors;
};

export const validateUpdateEducationInput = (body = {}) => {
  const errors = [];

  if (EDUCATION_FIELDS.every((field) => body[field] === undefined)) {
    errors.push({
      field: 'body',
      message: `Send at least one field to update: ${EDUCATION_FIELDS.join(', ')}.`,
    });
    return errors;
  }

  checkEducationBody(body, { isCreate: false }, errors);
  return errors;
};

/* --------------------------------------------------------------- experience */

/**
 * The writable fields of one position held.
 *
 * `experienceType` is in the list and is what makes this one array serve both
 * "professional experience" and "industry experience" — see the note in
 * constants/academicians.js on why that is one field rather than two arrays.
 */
export const EXPERIENCE_FIELDS = Object.freeze([
  'organization',
  'role',
  'experienceType',
  'startDate',
  'endDate',
  'isCurrent',
  'description',
]);

const checkExperienceBody = (body, { isCreate }, errors) => {
  const checkName = isCreate ? checkRequiredString : checkOptionalString;

  checkName(
    body.organization,
    { field: 'organization', max: ACADEMICIAN_LIMITS.maxOrganizationLength, label: 'Organisation' },
    errors,
  );
  checkName(
    body.role,
    { field: 'role', max: ACADEMICIAN_LIMITS.maxRoleLength, label: 'Role' },
    errors,
  );

  checkEnum(
    body.experienceType,
    {
      field: 'experienceType',
      label: 'Experience type',
      values: ACADEMIC_EXPERIENCE_TYPE_VALUES,
      required: isCreate,
    },
    errors,
  );

  /**
   * The imported `checkDate` also rejects dates more than a day in the future,
   * which is inherited deliberately rather than worked around: a profile records
   * positions held, and `isCurrent` is how an ongoing appointment is expressed. A
   * visiting post that ends next year is `isCurrent: true` with no end date, the
   * same way a student's ongoing internship is. Divergence here would mean an
   * academician's dates followed a different rule from a student's for no reason a
   * reader could find.
   */
  checkDate(
    body.startDate,
    { field: 'startDate', label: 'Start date', required: isCreate },
    errors,
  );
  checkDate(body.endDate, { field: 'endDate', label: 'End date' }, errors);
  checkBoolean(body.isCurrent, { field: 'isCurrent', label: 'Currently in this role' }, errors);

  checkOptionalString(
    body.description,
    { field: 'description', max: ACADEMICIAN_LIMITS.maxDescriptionLength, label: 'Description' },
    errors,
  );

  /**
   * Ordering is checked here as well as in the model's `checkDateOrder` hook,
   * because only this layer can name the field in a 400 the form can highlight.
   * Both directions are needed: the hook guarantees the invariant however the
   * document was built (including from the seed), and this gives the human a
   * usable message. Only checked when both dates are in the same request — a PATCH
   * that sends one date is compared against the stored other one by the hook.
   */
  if (isDefined(body.startDate) && isDefined(body.endDate) && body.endDate !== '') {
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
      errors.push({ field: 'endDate', message: 'The end date cannot be before the start date.' });
    }
  }
};

export const validateCreateExperienceInput = (body = {}) => {
  const errors = [];
  checkExperienceBody(body, { isCreate: true }, errors);
  return errors;
};

export const validateUpdateExperienceInput = (body = {}) => {
  const errors = [];

  if (EXPERIENCE_FIELDS.every((field) => body[field] === undefined)) {
    errors.push({
      field: 'body',
      message: `Send at least one field to update: ${EXPERIENCE_FIELDS.join(', ')}.`,
    });
    return errors;
  }

  checkExperienceBody(body, { isCreate: false }, errors);
  return errors;
};

/* -------------------------------------------------------------- achievement */

/** The writable fields of one publication, patent, grant or award. */
export const ACHIEVEMENT_FIELDS = Object.freeze([
  'title',
  'achievementType',
  'description',
  'issuingOrganization',
  'year',
  'url',
]);

const checkAchievementBody = (body, { isCreate }, errors) => {
  const checkName = isCreate ? checkRequiredString : checkOptionalString;

  checkName(
    body.title,
    { field: 'title', max: ACADEMICIAN_LIMITS.maxTitleLength, label: 'Title' },
    errors,
  );

  checkEnum(
    body.achievementType,
    {
      field: 'achievementType',
      label: 'Achievement type',
      values: ACADEMIC_ACHIEVEMENT_TYPE_VALUES,
      required: isCreate,
    },
    errors,
  );

  checkOptionalString(
    body.description,
    { field: 'description', max: ACADEMICIAN_LIMITS.maxDescriptionLength, label: 'Description' },
    errors,
  );
  checkOptionalString(
    body.issuingOrganization,
    {
      field: 'issuingOrganization',
      max: ACADEMICIAN_LIMITS.maxOrganizationLength,
      label: 'Issuing organisation',
    },
    errors,
  );

  checkOptionalYear(body.year, { field: 'year', label: 'Year' }, errors);

  /**
   * http/https only, enforced by the imported check. A DOI field that accepted
   * `javascript:` would be stored XSS the moment the profile page renders it as a
   * link, and an academician profile is read by industry partners.
   */
  checkOptionalUrl(body.url, { field: 'url', label: 'Link' }, errors);
};

export const validateCreateAchievementInput = (body = {}) => {
  const errors = [];
  checkAchievementBody(body, { isCreate: true }, errors);
  return errors;
};

export const validateUpdateAchievementInput = (body = {}) => {
  const errors = [];

  if (ACHIEVEMENT_FIELDS.every((field) => body[field] === undefined)) {
    errors.push({
      field: 'body',
      message: `Send at least one field to update: ${ACHIEVEMENT_FIELDS.join(', ')}.`,
    });
    return errors;
  }

  checkAchievementBody(body, { isCreate: false }, errors);
  return errors;
};

/* ---------------------------------------------------------------- adapters */

/** Identical adapter to every other validator here, so the 400 shape cannot drift. */
const toMiddleware = (validator) => (req, _res, next) => {
  const errors = validator(req.body ?? {});

  if (errors.length > 0) {
    return next(AppError.badRequest('Validation failed', errors));
  }

  return next();
};

export const validateCreateAcademicianProfile = toMiddleware(
  validateCreateAcademicianProfileInput,
);
export const validateUpdateAcademicianProfile = toMiddleware(
  validateUpdateAcademicianProfileInput,
);
export const validateAddExpertise = toMiddleware(validateAddExpertiseInput);
export const validateUpdateExpertise = toMiddleware(validateUpdateExpertiseInput);
export const validateCreateEducation = toMiddleware(validateCreateEducationInput);
export const validateUpdateEducation = toMiddleware(validateUpdateEducationInput);
export const validateCreateExperience = toMiddleware(validateCreateExperienceInput);
export const validateUpdateExperience = toMiddleware(validateUpdateExperienceInput);
export const validateCreateAchievement = toMiddleware(validateCreateAchievementInput);
export const validateUpdateAchievement = toMiddleware(validateUpdateAchievementInput);

export default {
  EDITABLE_ACADEMICIAN_FIELDS,
  EDUCATION_FIELDS,
  EXPERIENCE_FIELDS,
  ACHIEVEMENT_FIELDS,
  validateCreateAcademicianProfileInput,
  validateUpdateAcademicianProfileInput,
  validateAddExpertiseInput,
  validateUpdateExpertiseInput,
  validateCreateEducationInput,
  validateUpdateEducationInput,
  validateCreateExperienceInput,
  validateUpdateExperienceInput,
  validateCreateAchievementInput,
  validateUpdateAchievementInput,
};
