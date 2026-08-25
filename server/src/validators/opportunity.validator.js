/**
 * Opportunity request validation.
 *
 * Same shape as auth.validator.js and studentProfile.validator.js: pure
 * functions returning `{ field, message }[]`, with thin Express adapters at the
 * bottom, so the rules stay unit-testable and the 400 envelope is byte-identical
 * to Step 2's and Step 3's.
 *
 * BACKEND VALIDATION IS THE SECURITY BOUNDARY. The React form checks the same
 * rules for instant feedback and none of that is trusted here.
 *
 * Three things this file deliberately does NOT check, because each needs a
 * database round-trip and therefore belongs in the service — which throws the
 * same 400 envelope with the same field names:
 *
 *   - whether a referenced skill id actually exists
 *   - whether the caller owns the opportunity being edited
 *   - whether a requested status change is a legal transition from the current
 *     status, which cannot be known without reading the current document
 */

import AppError from '../utils/AppError.js';
import {
  CREATABLE_OPPORTUNITY_STATUSES,
  OPPORTUNITY_LIMITS,
  OPPORTUNITY_PAGE,
  OPPORTUNITY_STATUS_VALUES,
  OPPORTUNITY_TYPE_VALUES,
  WORK_MODE_VALUES,
  isValidOpportunityStatus,
  isValidOpportunityType,
  isValidWorkMode,
} from '../constants/opportunities.js';
import { SKILL_LEVEL_MAX, SKILL_LEVEL_MIN, isValidSkillLevel } from '../constants/skills.js';

/**
 * Reuses Step 3's id check rather than redeclaring the pattern — RULES.md
 * section 6 forbids duplicate utilities, and two copies of a regex are exactly
 * the kind of thing that drifts.
 */
import { isObjectIdLike } from './studentProfile.validator.js';

const isDefined = (value) => value !== undefined && value !== null;

/** A required free-text field: present, a string, non-blank, within length. */
const checkRequiredString = (value, { field, max, min = 1, label }, errors) => {
  if (!isDefined(value) || (typeof value === 'string' && value.trim().length === 0)) {
    errors.push({ field, message: `${label} is required.` });
    return;
  }

  if (typeof value !== 'string') {
    errors.push({ field, message: `${label} must be text.` });
    return;
  }

  const length = value.trim().length;

  if (length < min) {
    errors.push({ field, message: `${label} must be at least ${min} characters.` });
    return;
  }

  if (length > max) {
    errors.push({ field, message: `${label} cannot exceed ${max} characters.` });
  }
};

/** An optional free-text field. An empty string is allowed: it clears the field. */
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
 * An optional whole number in a range.
 *
 * `null` and `''` both pass through as "clear this field" — an HTML number input
 * submits `''` when emptied, and treating that as an error would make "I removed
 * the duration" fail.
 */
const checkOptionalInteger = (value, { field, min, max, label }, errors) => {
  if (value === undefined || value === null || value === '') return;

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    errors.push({ field, message: `${label} must be a number.` });
    return;
  }

  if (!Number.isInteger(numeric)) {
    errors.push({ field, message: `${label} must be a whole number.` });
    return;
  }

  if (numeric < min || numeric > max) {
    errors.push({ field, message: `${label} must be between ${min} and ${max}.` });
  }
};

/** An enum field, required. */
const checkEnum = (value, { field, label, isValid, allowed, required = true }, errors) => {
  if (!isDefined(value) || value === '') {
    if (required) errors.push({ field, message: `${label} is required.` });
    return;
  }

  if (!isValid(value)) {
    errors.push({ field, message: `${label} must be one of: ${allowed.join(', ')}.` });
  }
};

/**
 * One skill requirement entry.
 *
 * Accepts either a bare id string or `{ skillId, requiredLevel, importanceWeight }`.
 * The bare form is what a plain checkbox list produces; the object form is what
 * lets an employer say "React, Advanced". Normalising both here keeps the service
 * free of shape-guessing.
 */
const checkSkillEntry = (entry, { field, index, requireLevel }, errors) => {
  const path = `${field}[${index}]`;
  const id = typeof entry === 'string' ? entry : entry?.skillId;

  if (!isObjectIdLike(id)) {
    errors.push({ field: path, message: 'Please choose a skill from the catalogue.' });
    return;
  }

  const isObject = typeof entry === 'object' && entry !== null;
  const level = isObject ? entry.requiredLevel : undefined;

  if (isDefined(level) && level !== '') {
    if (!isValidSkillLevel(Number(level))) {
      errors.push({
        field: `${path}.requiredLevel`,
        message: `Required level must be a whole number between ${SKILL_LEVEL_MIN} and ${SKILL_LEVEL_MAX}.`,
      });
    }
  } else if (requireLevel) {
    /**
     * A must-have skill with no stated level says nothing an employer can be held
     * to and nothing the later matching step can measure a gap against, so it is
     * rejected rather than silently defaulted. A *preferred* skill is different —
     * "React would be nice" is a complete thought — so the model's default fills
     * in there instead.
     */
    errors.push({
      field: `${path}.requiredLevel`,
      message: 'Please choose the level you expect for this skill.',
    });
  }

  if (isObject && isDefined(entry.importanceWeight) && entry.importanceWeight !== '') {
    const weight = Number(entry.importanceWeight);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      errors.push({
        field: `${path}.importanceWeight`,
        message: 'Importance must be a number between 0 and 100.',
      });
    }
  }
};

/**
 * A whole skill array.
 *
 * @param {object} options
 * @param {boolean} options.required      Whether an empty list is an error.
 * @param {boolean} options.requireLevel  Whether each entry must state a level.
 */
const checkSkillList = (value, { field, label, max, required, requireLevel }, errors) => {
  if (!isDefined(value)) {
    if (required) errors.push({ field, message: `Please choose at least one ${label}.` });
    return [];
  }

  if (!Array.isArray(value)) {
    errors.push({ field, message: `${label}s must be a list.` });
    return [];
  }

  if (required && value.length === 0) {
    errors.push({ field, message: `Please choose at least one ${label}.` });
    return [];
  }

  if (value.length > max) {
    errors.push({ field, message: `Please list at most ${max} ${label}s.` });
    return [];
  }

  value.forEach((entry, index) => checkSkillEntry(entry, { field, index, requireLevel }, errors));

  const ids = value
    .map((entry) => (typeof entry === 'string' ? entry : entry?.skillId))
    .filter((id) => isObjectIdLike(id))
    .map((id) => id.trim().toLowerCase());

  if (new Set(ids).size !== ids.length) {
    errors.push({ field, message: `The same ${label} was listed twice.` });
  }

  return ids;
};

/**
 * The deadline.
 *
 * SERVER-SIDE AND ABSOLUTE. Parsed and compared here, never taken on trust from
 * the browser, because a client with a wrong clock (or a deliberately wrong one)
 * must not be able to post something that is already expired or dated in 2099.
 *
 * `todayStart` rather than "now": a deadline of "today" is submitted as midnight,
 * which is technically in the past by the time it arrives, and rejecting "today"
 * as a past date would be baffling to an employer posting a same-day cutoff.
 */
const checkDeadline = (value, { required }, errors) => {
  if (!isDefined(value) || value === '') {
    if (required) errors.push({ field: 'deadline', message: 'An application deadline is required.' });
    return;
  }

  if (typeof value !== 'string' && !(value instanceof Date) && typeof value !== 'number') {
    errors.push({ field: 'deadline', message: 'Deadline must be a date.' });
    return;
  }

  const deadline = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(deadline.getTime())) {
    errors.push({ field: 'deadline', message: 'That is not a valid date.' });
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (deadline.getTime() < todayStart.getTime()) {
    errors.push({ field: 'deadline', message: 'The deadline cannot be in the past.' });
    return;
  }

  const ceiling = new Date(now);
  ceiling.setFullYear(ceiling.getFullYear() + OPPORTUNITY_LIMITS.deadlineMaxYearsAhead);

  if (deadline.getTime() > ceiling.getTime()) {
    errors.push({
      field: 'deadline',
      message: `The deadline cannot be more than ${OPPORTUNITY_LIMITS.deadlineMaxYearsAhead} years away.`,
    });
  }
};

/** The eligibility block: branches, a graduation-year window, free-text notes. */
const checkEligibility = (value, errors) => {
  if (!isDefined(value)) return;

  if (typeof value !== 'object' || Array.isArray(value)) {
    errors.push({ field: 'eligibility', message: 'Eligibility must be an object.' });
    return;
  }

  const { branches, minGraduationYear, maxGraduationYear, notes } = value;

  if (isDefined(branches)) {
    if (!Array.isArray(branches)) {
      errors.push({ field: 'eligibility.branches', message: 'Branches must be a list.' });
    } else if (branches.length > OPPORTUNITY_LIMITS.maxBranches) {
      errors.push({
        field: 'eligibility.branches',
        message: `Please list at most ${OPPORTUNITY_LIMITS.maxBranches} branches.`,
      });
    } else if (branches.some((branch) => typeof branch !== 'string')) {
      errors.push({ field: 'eligibility.branches', message: 'Each branch must be text.' });
    } else if (branches.some((branch) => branch.trim().length === 0)) {
      errors.push({ field: 'eligibility.branches', message: 'Branches cannot be blank.' });
    } else if (
      branches.some((branch) => branch.trim().length > OPPORTUNITY_LIMITS.branchMax)
    ) {
      errors.push({
        field: 'eligibility.branches',
        message: `Each branch must be ${OPPORTUNITY_LIMITS.branchMax} characters or fewer.`,
      });
    } else {
      // Case-insensitive: "CSE" and "cse" as two branches is a mistake, not a rule.
      const seen = new Set(branches.map((branch) => branch.trim().toLowerCase()));
      if (seen.size !== branches.length) {
        errors.push({ field: 'eligibility.branches', message: 'Please remove duplicate branches.' });
      }
    }
  }

  checkOptionalInteger(
    minGraduationYear,
    {
      field: 'eligibility.minGraduationYear',
      min: OPPORTUNITY_LIMITS.graduationYearMin,
      max: OPPORTUNITY_LIMITS.graduationYearMax,
      label: 'Earliest graduation year',
    },
    errors,
  );

  checkOptionalInteger(
    maxGraduationYear,
    {
      field: 'eligibility.maxGraduationYear',
      min: OPPORTUNITY_LIMITS.graduationYearMin,
      max: OPPORTUNITY_LIMITS.graduationYearMax,
      label: 'Latest graduation year',
    },
    errors,
  );

  const min = Number(minGraduationYear);
  const max = Number(maxGraduationYear);
  if (Number.isInteger(min) && Number.isInteger(max) && min > max) {
    errors.push({
      field: 'eligibility.maxGraduationYear',
      message: 'The latest graduation year must not be before the earliest.',
    });
  }

  checkOptionalString(
    notes,
    {
      field: 'eligibility.notes',
      max: OPPORTUNITY_LIMITS.eligibilityNotesMax,
      label: 'Eligibility notes',
    },
    errors,
  );
};

/**
 * Fields an owner may write.
 *
 * This list IS the write whitelist — the service builds its update from it, so a
 * field cannot become writable by accident. `industryId` is absent by design and
 * that absence is the enforcement: ownership comes from `req.user._id`, so
 * "create this as someone else" is not expressible, per his section 3.
 */
export const EDITABLE_OPPORTUNITY_FIELDS = Object.freeze([
  'title',
  'type',
  'description',
  'location',
  'workMode',
  'requiredSkills',
  'preferredSkills',
  'eligibility',
  'durationMonths',
  'deadline',
  'openings',
  'status',
]);

/**
 * Fields a client might plausibly send that the server owns outright.
 *
 * Rejected loudly rather than ignored: an employer who posts `industryId` and
 * gets 200 back has been told their input was honoured when it was discarded.
 * Naming it is the honest response, and it also makes an attempted ownership
 * override visible instead of silent.
 */
const REJECTED_FIELDS = Object.freeze({
  industryId: 'The owner is taken from your account and cannot be set directly.',
  owner: 'The owner is taken from your account and cannot be set directly.',
  ownerId: 'The owner is taken from your account and cannot be set directly.',
  availability: 'Availability is derived from the status and deadline.',
});

const checkRejectedFields = (body, errors) => {
  Object.entries(REJECTED_FIELDS).forEach(([field, message]) => {
    if (field in body) errors.push({ field, message });
  });
};

/**
 * Cross-field check: the same skill cannot be both required and preferred.
 *
 * "Must have React" and "React would be nice" cannot both be true, and the
 * matching phase would have to pick one to honour. Rejecting it makes the
 * employer decide, which is the only place the decision belongs. The model has
 * the same rule as a backstop; this version can name the field.
 */
const checkNoSkillOverlap = (requiredIds, preferredIds, errors) => {
  const overlap = preferredIds.filter((id) => requiredIds.includes(id));

  if (overlap.length > 0) {
    errors.push({
      field: 'preferredSkills',
      message: 'A skill cannot be both required and preferred. Please choose one.',
    });
  }
};

/** Shared field rules for create and update. `required` toggles presence checks. */
const checkOpportunityBody = (body, errors, { required }) => {
  if (required) {
    checkRequiredString(
      body.title,
      { field: 'title', max: OPPORTUNITY_LIMITS.titleMax, label: 'Title' },
      errors,
    );
    checkRequiredString(
      body.description,
      {
        field: 'description',
        min: OPPORTUNITY_LIMITS.descriptionMin,
        max: OPPORTUNITY_LIMITS.descriptionMax,
        label: 'Description',
      },
      errors,
    );
    checkRequiredString(
      body.location,
      { field: 'location', max: OPPORTUNITY_LIMITS.locationMax, label: 'Location' },
      errors,
    );
  } else {
    // On a PATCH an absent field means "leave it alone", but a *present* one must
    // still be valid — including not being blanked out, since none of these three
    // has a meaningful empty value.
    if ('title' in body) {
      checkRequiredString(
        body.title,
        { field: 'title', max: OPPORTUNITY_LIMITS.titleMax, label: 'Title' },
        errors,
      );
    }
    if ('description' in body) {
      checkRequiredString(
        body.description,
        {
          field: 'description',
          min: OPPORTUNITY_LIMITS.descriptionMin,
          max: OPPORTUNITY_LIMITS.descriptionMax,
          label: 'Description',
        },
        errors,
      );
    }
    if ('location' in body) {
      checkRequiredString(
        body.location,
        { field: 'location', max: OPPORTUNITY_LIMITS.locationMax, label: 'Location' },
        errors,
      );
    }
  }

  checkEnum(
    body.type,
    {
      field: 'type',
      label: 'Opportunity type',
      isValid: isValidOpportunityType,
      allowed: OPPORTUNITY_TYPE_VALUES,
      required: required || 'type' in body,
    },
    errors,
  );

  checkEnum(
    body.workMode,
    {
      field: 'workMode',
      label: 'Work mode',
      isValid: isValidWorkMode,
      allowed: WORK_MODE_VALUES,
      required: required || 'workMode' in body,
    },
    errors,
  );

  const requiredIds =
    required || 'requiredSkills' in body
      ? checkSkillList(
          body.requiredSkills,
          {
            field: 'requiredSkills',
            label: 'required skill',
            max: OPPORTUNITY_LIMITS.maxRequiredSkills,
            required: true,
            requireLevel: true,
          },
          errors,
        )
      : [];

  const preferredIds =
    'preferredSkills' in body
      ? checkSkillList(
          body.preferredSkills,
          {
            field: 'preferredSkills',
            label: 'preferred skill',
            max: OPPORTUNITY_LIMITS.maxPreferredSkills,
            required: false,
            requireLevel: false,
          },
          errors,
        )
      : [];

  /**
   * Only checkable when both lists are in the same request. A PATCH that sends
   * only `preferredSkills` could still collide with the stored `requiredSkills`,
   * so the service repeats this check against the merged document — and the model
   * repeats it again. Three layers sounds excessive; it is what makes the rule
   * true rather than usually true.
   */
  if (requiredIds.length > 0 && preferredIds.length > 0) {
    checkNoSkillOverlap(requiredIds, preferredIds, errors);
  }

  checkEligibility(body.eligibility, errors);

  checkOptionalInteger(
    body.durationMonths,
    {
      field: 'durationMonths',
      min: OPPORTUNITY_LIMITS.durationMonthsMin,
      max: OPPORTUNITY_LIMITS.durationMonthsMax,
      label: 'Duration in months',
    },
    errors,
  );

  checkOptionalInteger(
    body.openings,
    {
      field: 'openings',
      min: OPPORTUNITY_LIMITS.openingsMin,
      max: OPPORTUNITY_LIMITS.openingsMax,
      label: 'Number of openings',
    },
    errors,
  );

  checkDeadline(body.deadline, { required }, errors);
  checkRejectedFields(body, errors);
};

/**
 * POST /opportunities
 *
 * `status` may be omitted (defaults to active), `draft` to save without
 * publishing, or `active` to publish. `closed` is rejected here because closing
 * something that was never open is meaningless.
 */
export const validateCreateOpportunityInput = (body = {}) => {
  const errors = [];

  checkOpportunityBody(body, errors, { required: true });

  if (isDefined(body.status) && body.status !== '') {
    if (!CREATABLE_OPPORTUNITY_STATUSES.includes(body.status)) {
      errors.push({
        field: 'status',
        message: `A new opportunity must be ${CREATABLE_OPPORTUNITY_STATUSES.join(' or ')}.`,
      });
    }
  }

  return errors;
};

/**
 * PATCH /opportunities/:id
 *
 * Every field optional, but an empty patch is rejected: it is almost always a
 * client bug, and answering 200 "updated" for a request that changed nothing
 * hides it. Whether a status *change* is legal is decided in the service, which
 * is the only layer that knows the current status.
 */
export const validateUpdateOpportunityInput = (body = {}) => {
  const errors = [];

  const touched = EDITABLE_OPPORTUNITY_FIELDS.filter((field) => field in body);

  if (touched.length === 0) {
    // Still surface a rejected field if that is all they sent, so the response
    // explains the real problem rather than "no fields provided".
    checkRejectedFields(body, errors);
    if (errors.length === 0) {
      errors.push({ field: 'body', message: 'No editable fields were provided.' });
    }
    return errors;
  }

  checkOpportunityBody(body, errors, { required: false });

  if ('status' in body) {
    if (!isValidOpportunityStatus(body.status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${OPPORTUNITY_STATUS_VALUES.join(', ')}.`,
      });
    }
  }

  return errors;
};

/**
 * Query parameters for the two list endpoints.
 *
 * WHY AN INVALID ENUM IS A 400 HERE, when catalogue.controller.js deliberately
 * lets an unrecognised `?category=` match nothing: these values come from a fixed
 * set of radio buttons, so a value outside the set is definitively a bug, and an
 * empty result would read to a student as "there are no internships" rather than
 * "your request was malformed". The catalogue's free-text `tag` filter has no such
 * fixed set, so silence is the honest answer there.
 *
 * `skills` arrives as a comma-separated id list — `?skills=<id>,<id>` — which is
 * the shape a checkbox filter naturally serialises to. Malformed entries must be
 * rejected rather than passed through: an unparseable id reaching a Mongo query
 * would surface as a confusing CastError about a field the student never saw.
 */
export const validateOpportunityQueryInput = (query = {}) => {
  const errors = [];

  checkEnum(
    query.type,
    {
      field: 'type',
      label: 'Opportunity type',
      isValid: isValidOpportunityType,
      allowed: OPPORTUNITY_TYPE_VALUES,
      required: false,
    },
    errors,
  );

  checkEnum(
    query.workMode,
    {
      field: 'workMode',
      label: 'Work mode',
      isValid: isValidWorkMode,
      allowed: WORK_MODE_VALUES,
      required: false,
    },
    errors,
  );

  checkEnum(
    query.status,
    {
      field: 'status',
      label: 'Status',
      isValid: isValidOpportunityStatus,
      allowed: OPPORTUNITY_STATUS_VALUES,
      required: false,
    },
    errors,
  );

  if (isDefined(query.skills) && query.skills !== '') {
    if (typeof query.skills !== 'string') {
      errors.push({ field: 'skills', message: 'Skill filter must be a comma-separated list of ids.' });
    } else {
      const ids = query.skills.split(',').map((id) => id.trim()).filter(Boolean);

      if (ids.length === 0) {
        errors.push({ field: 'skills', message: 'Skill filter must contain at least one skill.' });
      } else if (ids.length > OPPORTUNITY_LIMITS.maxRequiredSkills) {
        errors.push({
          field: 'skills',
          message: `Please filter by at most ${OPPORTUNITY_LIMITS.maxRequiredSkills} skills.`,
        });
      } else if (ids.some((id) => !isObjectIdLike(id))) {
        errors.push({ field: 'skills', message: 'Skill filter contains an invalid skill id.' });
      }
    }
  }

  checkOptionalString(
    query.search,
    { field: 'search', max: 100, label: 'Search text' },
    errors,
  );

  checkOptionalString(
    query.location,
    { field: 'location', max: OPPORTUNITY_LIMITS.locationMax, label: 'Location filter' },
    errors,
  );

  checkOptionalInteger(query.page, { field: 'page', min: 1, max: 100000, label: 'Page' }, errors);

  checkOptionalInteger(
    query.limit,
    { field: 'limit', min: 1, max: OPPORTUNITY_PAGE.maxLimit, label: 'Page size' },
    errors,
  );

  return errors;
};

/**
 * Normalises a validated skill list into the subdocument shape the model wants.
 *
 * `requiredLevel` falls back to 50 — the middle of the scale — for a preferred
 * skill submitted as a bare id. That is not a guess dressed as data: the model
 * requires the field, "would be nice to have" carries no level, and the neutral
 * midpoint is the only value that adds no bias when the matching phase reads it.
 */
export const normaliseSkillList = (entries = [], { defaultLevel = 50 } = {}) =>
  entries.map((entry) => {
    if (typeof entry === 'string') {
      return { skillId: entry.trim(), requiredLevel: defaultLevel };
    }

    const normalised = { skillId: String(entry.skillId).trim() };

    normalised.requiredLevel =
      isDefined(entry.requiredLevel) && entry.requiredLevel !== ''
        ? Number(entry.requiredLevel)
        : defaultLevel;

    if (isDefined(entry.importanceWeight) && entry.importanceWeight !== '') {
      normalised.importanceWeight = Number(entry.importanceWeight);
    }

    return normalised;
  });

/** Identical adapters to Step 2 and Step 3, so the 400 shape cannot drift. */
const toMiddleware = (validator) => (req, _res, next) => {
  const errors = validator(req.body);

  if (errors.length > 0) {
    return next(AppError.badRequest('Validation failed', errors));
  }

  return next();
};

/** Query-parameter variant — reads req.query rather than req.body. */
const toQueryMiddleware = (validator) => (req, _res, next) => {
  const errors = validator(req.query);

  if (errors.length > 0) {
    return next(AppError.badRequest('Validation failed', errors));
  }

  return next();
};

export const validateCreateOpportunity = toMiddleware(validateCreateOpportunityInput);
export const validateUpdateOpportunity = toMiddleware(validateUpdateOpportunityInput);
export const validateOpportunityQuery = toQueryMiddleware(validateOpportunityQueryInput);

export default {
  validateCreateOpportunity,
  validateUpdateOpportunity,
  validateOpportunityQuery,
};
