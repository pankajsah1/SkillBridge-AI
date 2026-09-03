/**
 * Learning request validation.
 *
 * Same shape as auth.validator.js, studentProfile.validator.js and
 * opportunity.validator.js: pure functions returning `{ field, message }[]`, with
 * thin Express adapters at the bottom, so the rules stay unit-testable offline and
 * the 400 envelope is byte-identical to every earlier step's.
 *
 * BACKEND VALIDATION IS THE SECURITY BOUNDARY. The React forms check the same
 * rules for instant feedback and none of that is trusted here — the brief's
 * "do not rely only on the frontend" applies to every field below.
 *
 * The small field helpers are declared locally rather than imported from
 * opportunity.validator.js because that file does not export them, and exporting
 * them now would change a shipped module's public surface for a cosmetic gain.
 * Only `isObjectIdLike` is shared, which is the one piece that would genuinely
 * drift if copied.
 *
 * Four things this file deliberately does NOT check, because each needs a database
 * round-trip and therefore belongs in the service — which throws the same 400
 * envelope with the same field names:
 *
 *   - whether a referenced skill id points at a real, active catalogue entry
 *   - whether the caller owns the programme being edited
 *   - whether a requested status change is legal from the current status
 *   - whether an enrolment already exists for this learner and programme
 */

import AppError from '../utils/AppError.js';
import {
  CREATABLE_LEARNING_PROGRAM_STATUSES,
  DELIVERY_MODE_VALUES,
  ENROLLMENT_STATUS_VALUES,
  LEARNING_LIMITS,
  LEARNING_PAGE,
  LEARNING_PROGRAM_STATUS_VALUES,
  LEARNING_PROGRAM_TYPE_VALUES,
  PROGRAM_LEVEL_VALUES,
  PROGRESS_MAX,
  PROGRESS_MIN,
  isValidDeliveryMode,
  isValidEnrollmentStatus,
  isValidLearningProgramStatus,
  isValidLearningProgramType,
  isValidProgramLevel,
} from '../constants/learning.js';

/** Reuses Step 3's id check rather than redeclaring the pattern — RULES.md
 * section 6 forbids duplicate utilities, and two copies of a regex drift. */
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
 * `null` and `''` both pass as "clear this field" — an HTML number input submits
 * `''` when emptied, and treating that as an error would make "I removed the
 * duration" fail.
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

/** An enum field. `required` toggles the presence check. */
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
 * Parses a date input, reading a date-only string as LOCAL midnight.
 *
 * WHY NOT PLAIN `new Date(value)`. "2026-09-02" is parsed by the spec as UTC
 * midnight. For a timezone behind UTC that instant is the previous evening in local
 * terms, so comparing it against local midnight today rejects a date the user
 * picked as today. `checkDeadline` in opportunity.validator.js has exactly that
 * quirk; it is harmless where this project runs (IST is ahead of UTC) and changing
 * shipped behaviour is out of scope for Step 8, so this file does not touch it — it
 * simply does not repeat it.
 *
 * Returns `null` for anything unparseable, so callers test one thing.
 */
export const parseDateInput = (value) => {
  if (!isDefined(value) || value === '') return null;

  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  if (typeof value !== 'string') return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const local = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(local.getTime()) ? null : local;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * An optional date field.
 *
 * `null` and `''` clear it, which is what "this course is self-paced, it has no end
 * date" looks like arriving from a form.
 *
 * `allowPast: false` refuses a date that has already gone, using the START of today
 * so that picking today is never treated as the past. It is used for `endDate`
 * only: writing an end date that is already behind us produces a programme every
 * reader sees as `ended` and nobody can enrol in, which is a mistyped year far more
 * often than an intention. This is a rule about *writing* a stale date — a
 * programme already in the collection is expected to age past its end date, and
 * that is exactly what `ended` means.
 */
const checkOptionalDate = (value, { field, label, allowPast = true }, errors) => {
  if (!isDefined(value) || value === '') return;

  const parsed = parseDateInput(value);

  if (!parsed) {
    errors.push({ field, message: `${label} is not a valid date.` });
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!allowPast && parsed.getTime() < todayStart.getTime()) {
    errors.push({ field, message: `${label} cannot be in the past.` });
    return;
  }

  const years = LEARNING_LIMITS.dateMaxYearsAhead;
  const ceiling = new Date(now);
  ceiling.setFullYear(ceiling.getFullYear() + years);
  const floor = new Date(now);
  floor.setFullYear(floor.getFullYear() - years);

  if (parsed.getTime() > ceiling.getTime() || parsed.getTime() < floor.getTime()) {
    errors.push({ field, message: `${label} must be within ${years} years of today.` });
  }
};

/**
 * The link to the actual learning material.
 *
 * PARSED, NOT REGEX-MATCHED, and restricted to http(s). `javascript:` and `data:`
 * URLs are the reason: this value is rendered as an anchor's href on the programme
 * detail page, so anything the browser would execute has to be refused at the
 * write boundary rather than escaped at every read. An empty string clears it.
 */
const checkOptionalUrl = (value, { field, label }, errors) => {
  if (!isDefined(value) || value === '') return;

  if (typeof value !== 'string') {
    errors.push({ field, message: `${label} must be text.` });
    return;
  }

  if (value.trim().length > LEARNING_LIMITS.externalUrlMax) {
    errors.push({
      field,
      message: `${label} cannot exceed ${LEARNING_LIMITS.externalUrlMax} characters.`,
    });
    return;
  }

  let parsed;

  try {
    parsed = new URL(value.trim());
  } catch {
    errors.push({ field, message: `${label} must be a full link, starting with https://.` });
    return;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    errors.push({ field, message: `${label} must start with http:// or https://.` });
  }
};

/**
 * The prerequisites list — free text, one line each.
 *
 * Free text on purpose (the model says why): a real prerequisite is often not a
 * catalogue skill at all. An empty array is legitimate and means "none", so this
 * never requires an entry.
 */
const checkPrerequisites = (value, errors) => {
  const field = 'prerequisites';

  if (!isDefined(value)) return;

  if (!Array.isArray(value)) {
    errors.push({ field, message: 'Prerequisites must be a list.' });
    return;
  }

  if (value.length > LEARNING_LIMITS.maxPrerequisites) {
    errors.push({
      field,
      message: `Please list at most ${LEARNING_LIMITS.maxPrerequisites} prerequisites.`,
    });
    return;
  }

  value.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      errors.push({ field: `${field}[${index}]`, message: 'Each prerequisite must be text.' });
      return;
    }

    const trimmed = entry.trim();

    if (trimmed.length === 0) {
      errors.push({ field: `${field}[${index}]`, message: 'A prerequisite cannot be blank.' });
      return;
    }

    if (trimmed.length > LEARNING_LIMITS.prerequisiteMax) {
      errors.push({
        field: `${field}[${index}]`,
        message: `Each prerequisite must be ${LEARNING_LIMITS.prerequisiteMax} characters or fewer.`,
      });
    }
  });

  // Case-insensitive: "Basic Python" twice with different capitals is a mistake.
  const seen = value
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (new Set(seen).size !== seen.length) {
    errors.push({ field, message: 'Please remove duplicate prerequisites.' });
  }
};

/**
 * The skills this programme teaches.
 *
 * BARE IDS, NOT SUBDOCUMENTS — the shape TRD.md section 18 defines and the model
 * stores. A `{ skillId }` object is accepted as well, because a checkbox list built
 * from the same component the opportunity form uses serialises that way, and
 * refusing it would push shape-guessing into the client for no gain.
 *
 * AT LEAST ONE IS REQUIRED. A programme that teaches no catalogue skill can never
 * be recommended, because there is nothing to join it to a student's gaps by; the
 * model repeats this as a hook so the rule also holds for the demo seed.
 *
 * Returns the normalised, lowercased ids so the caller can check for duplicates
 * against another list without re-deriving them.
 */
const checkTargetSkills = (value, { required }, errors) => {
  const field = 'targetSkills';

  if (!isDefined(value)) {
    if (required) errors.push({ field, message: 'Please choose at least one skill.' });
    return [];
  }

  if (!Array.isArray(value)) {
    errors.push({ field, message: 'Skills must be a list.' });
    return [];
  }

  if (value.length === 0) {
    errors.push({ field, message: 'Please choose at least one skill.' });
    return [];
  }

  if (value.length > LEARNING_LIMITS.maxSkills) {
    errors.push({ field, message: `Please choose at most ${LEARNING_LIMITS.maxSkills} skills.` });
    return [];
  }

  value.forEach((entry, index) => {
    const id = typeof entry === 'string' ? entry : entry?.skillId;

    if (!isObjectIdLike(id)) {
      errors.push({
        field: `${field}[${index}]`,
        message: 'Please choose a skill from the catalogue.',
      });
    }
  });

  const ids = value
    .map((entry) => (typeof entry === 'string' ? entry : entry?.skillId))
    .filter((id) => isObjectIdLike(id))
    .map((id) => String(id).trim().toLowerCase());

  if (new Set(ids).size !== ids.length) {
    errors.push({ field, message: 'The same skill was listed twice.' });
  }

  return ids;
};

/** Flattens a validated skill list to the bare id array the model wants. */
export const normaliseSkillIds = (entries = []) =>
  entries.map((entry) => String(typeof entry === 'string' ? entry : entry.skillId).trim());

/** Trims and drops blanks from a validated prerequisites list. */
export const normalisePrerequisites = (entries = []) =>
  entries.map((entry) => String(entry).trim()).filter(Boolean);

/**
 * Fields a publisher may write.
 *
 * THIS LIST IS THE WRITE WHITELIST — learning.service.js builds its update from it,
 * so a field cannot become writable because someone added it to the schema.
 * `publisherId` is absent by design and that absence is the enforcement: ownership
 * comes from `req.user.id`, so "publish this as someone else" is not expressible.
 */
export const EDITABLE_LEARNING_PROGRAM_FIELDS = Object.freeze([
  'title',
  'provider',
  'description',
  'type',
  'level',
  'deliveryMode',
  'targetSkills',
  'prerequisites',
  'instructor',
  'durationHours',
  'startDate',
  'endDate',
  'externalUrl',
  'status',
]);

/**
 * Fields a client might plausibly send that the server owns outright.
 *
 * Rejected loudly rather than ignored: a publisher who posts `publisherId` and gets
 * 200 back has been told their input was honoured when it was discarded. Naming it
 * also makes an attempted ownership override visible instead of silent.
 */
const REJECTED_PROGRAM_FIELDS = Object.freeze({
  publisherId: 'The publisher is taken from your account and cannot be set directly.',
  publisher: 'The publisher is taken from your account and cannot be set directly.',
  owner: 'The publisher is taken from your account and cannot be set directly.',
  ownerId: 'The publisher is taken from your account and cannot be set directly.',
  availability: 'Availability is derived from the status and the end date.',
});

/**
 * The same idea for an enrolment, where the list is longer because almost every
 * field is server-owned. `learnerId` is the important one: it is the answer to "do
 * not allow a student to modify another student's enrollment", and the only way to
 * set it is to be the authenticated caller.
 */
const REJECTED_ENROLLMENT_FIELDS = Object.freeze({
  learnerId: 'Your enrollment is linked to your own account and cannot be set directly.',
  studentId: 'Your enrollment is linked to your own account and cannot be set directly.',
  student: 'Your enrollment is linked to your own account and cannot be set directly.',
  learnerRole: 'Your role is taken from your account and cannot be set directly.',
  enrolledAt: 'Enrollment dates are recorded by the server.',
  startedAt: 'Enrollment dates are recorded by the server.',
  completedAt: 'The completion date is recorded by the server when you finish.',
});

const checkRejectedFields = (body, rejected, errors) => {
  Object.entries(rejected).forEach(([field, message]) => {
    if (field in body) errors.push({ field, message });
  });
};

/** Shared field rules for create and update. `required` toggles presence checks. */
const checkLearningProgramBody = (body, errors, { required }) => {
  const text = [
    { field: 'title', label: 'Title', max: LEARNING_LIMITS.titleMax },
    { field: 'provider', label: 'Provider', max: LEARNING_LIMITS.providerMax },
    {
      field: 'description',
      label: 'Description',
      min: LEARNING_LIMITS.descriptionMin,
      max: LEARNING_LIMITS.descriptionMax,
    },
  ];

  /**
   * On a PATCH an absent field means "leave it alone", but a *present* one must
   * still be valid — including not being blanked out, since none of these three has
   * a meaningful empty value.
   */
  text
    .filter((rule) => required || rule.field in body)
    .forEach((rule) => checkRequiredString(body[rule.field], rule, errors));

  checkEnum(
    body.type,
    {
      field: 'type',
      label: 'Program type',
      isValid: isValidLearningProgramType,
      allowed: LEARNING_PROGRAM_TYPE_VALUES,
      required: required || 'type' in body,
    },
    errors,
  );

  checkEnum(
    body.level,
    {
      field: 'level',
      label: 'Level',
      isValid: isValidProgramLevel,
      allowed: PROGRAM_LEVEL_VALUES,
      required: required || 'level' in body,
    },
    errors,
  );

  checkEnum(
    body.deliveryMode,
    {
      field: 'deliveryMode',
      label: 'Delivery mode',
      isValid: isValidDeliveryMode,
      allowed: DELIVERY_MODE_VALUES,
      required: required || 'deliveryMode' in body,
    },
    errors,
  );

  if (required || 'targetSkills' in body) {
    checkTargetSkills(body.targetSkills, { required: true }, errors);
  }

  checkPrerequisites(body.prerequisites, errors);

  checkOptionalString(
    body.instructor,
    { field: 'instructor', max: LEARNING_LIMITS.instructorMax, label: 'Instructor or mentor' },
    errors,
  );

  checkOptionalInteger(
    body.durationHours,
    {
      field: 'durationHours',
      min: LEARNING_LIMITS.durationHoursMin,
      max: LEARNING_LIMITS.durationHoursMax,
      label: 'Duration in hours',
    },
    errors,
  );

  checkOptionalDate(body.startDate, { field: 'startDate', label: 'Start date' }, errors);
  checkOptionalDate(
    body.endDate,
    { field: 'endDate', label: 'End date', allowPast: false },
    errors,
  );

  /**
   * Only checkable when both dates arrive together. A PATCH sending only
   * `startDate` could still cross the stored `endDate`, so the model repeats this
   * against the merged document — this copy exists because it can name the field.
   */
  const start = parseDateInput(body.startDate);
  const end = parseDateInput(body.endDate);

  if (start && end && start.getTime() > end.getTime()) {
    errors.push({ field: 'endDate', message: 'The end date cannot be before the start date.' });
  }

  checkOptionalUrl(body.externalUrl, { field: 'externalUrl', label: 'Program link' }, errors);
  checkRejectedFields(body, REJECTED_PROGRAM_FIELDS, errors);
};

/**
 * POST /learning/programs
 *
 * `status` may be omitted (defaults to published, because a publisher filling in
 * this form is normally publishing) or `draft` to save without publishing.
 * `archived` is rejected here: archiving something that was never published is
 * meaningless, and it would create a programme no one could ever see.
 */
export const validateCreateLearningProgramInput = (body = {}) => {
  const errors = [];

  checkLearningProgramBody(body, errors, { required: true });

  if (isDefined(body.status) && body.status !== '') {
    if (!CREATABLE_LEARNING_PROGRAM_STATUSES.includes(body.status)) {
      errors.push({
        field: 'status',
        message: `A new program must be ${CREATABLE_LEARNING_PROGRAM_STATUSES.join(' or ')}.`,
      });
    }
  }

  return errors;
};

/**
 * PATCH /learning/programs/:id
 *
 * Every field optional, but an empty patch is rejected: it is almost always a client
 * bug, and answering 200 "updated" for a request that changed nothing hides it.
 * Whether a status *change* is legal is decided in the service, which is the only
 * layer that knows the current status.
 */
export const validateUpdateLearningProgramInput = (body = {}) => {
  const errors = [];

  const touched = EDITABLE_LEARNING_PROGRAM_FIELDS.filter((field) => field in body);

  if (touched.length === 0) {
    // Still surface a rejected field if that is all they sent, so the response
    // explains the real problem rather than "no fields provided".
    checkRejectedFields(body, REJECTED_PROGRAM_FIELDS, errors);

    if (errors.length === 0) {
      errors.push({ field: 'body', message: 'No editable fields were provided.' });
    }

    return errors;
  }

  checkLearningProgramBody(body, errors, { required: false });

  if ('status' in body && !isValidLearningProgramStatus(body.status)) {
    errors.push({
      field: 'status',
      message: `Status must be one of: ${LEARNING_PROGRAM_STATUS_VALUES.join(', ')}.`,
    });
  }

  return errors;
};

/**
 * Query parameters for both programme lists — the student browse and the
 * publisher's own management list.
 *
 * ONE VALIDATOR FOR BOTH, the way `validateOpportunityQueryInput` serves browse and
 * the industry list. `status` is accepted because the management list legitimately
 * filters drafts and archives; the browse service ignores it entirely and hardcodes
 * `published`, so a student cannot ask for someone's drafts by adding a parameter.
 *
 * An invalid enum is a 400 rather than an empty result for the reason
 * opportunity.validator.js sets out at length: these values come from a fixed set of
 * controls, so a value outside the set is a bug, and an empty list would read as
 * "there are no courses" instead of "your request was malformed".
 */
export const validateLearningProgramQueryInput = (query = {}) => {
  const errors = [];

  checkEnum(
    query.type,
    {
      field: 'type',
      label: 'Program type',
      isValid: isValidLearningProgramType,
      allowed: LEARNING_PROGRAM_TYPE_VALUES,
      required: false,
    },
    errors,
  );

  checkEnum(
    query.level,
    {
      field: 'level',
      label: 'Level',
      isValid: isValidProgramLevel,
      allowed: PROGRAM_LEVEL_VALUES,
      required: false,
    },
    errors,
  );

  checkEnum(
    query.deliveryMode,
    {
      field: 'deliveryMode',
      label: 'Delivery mode',
      isValid: isValidDeliveryMode,
      allowed: DELIVERY_MODE_VALUES,
      required: false,
    },
    errors,
  );

  checkEnum(
    query.status,
    {
      field: 'status',
      label: 'Status',
      isValid: isValidLearningProgramStatus,
      allowed: LEARNING_PROGRAM_STATUS_VALUES,
      required: false,
    },
    errors,
  );

  /**
   * `skills` arrives comma-separated — `?skills=<id>,<id>` — which is what a
   * checkbox filter serialises to. Malformed entries are rejected rather than passed
   * through: an unparseable id reaching a Mongo query surfaces as a confusing
   * CastError about a field the student never saw.
   */
  if (isDefined(query.skills) && query.skills !== '') {
    if (typeof query.skills !== 'string') {
      errors.push({
        field: 'skills',
        message: 'Skill filter must be a comma-separated list of ids.',
      });
    } else {
      const ids = query.skills.split(',').map((id) => id.trim()).filter(Boolean);

      if (ids.length === 0) {
        errors.push({ field: 'skills', message: 'Skill filter must contain at least one skill.' });
      } else if (ids.length > LEARNING_LIMITS.maxSkills) {
        errors.push({
          field: 'skills',
          message: `Please filter by at most ${LEARNING_LIMITS.maxSkills} skills.`,
        });
      } else if (ids.some((id) => !isObjectIdLike(id))) {
        errors.push({ field: 'skills', message: 'Skill filter contains an invalid skill id.' });
      }
    }
  }

  checkOptionalString(query.search, { field: 'search', max: 100, label: 'Search text' }, errors);
  checkOptionalInteger(query.page, { field: 'page', min: 1, max: 100000, label: 'Page' }, errors);
  checkOptionalInteger(
    query.limit,
    { field: 'limit', min: 1, max: LEARNING_PAGE.maxLimit, label: 'Page size' },
    errors,
  );

  return errors;
};

/**
 * POST /learning/enrollments
 *
 * ONE FIELD: which programme. Everything else about an enrolment is the server's to
 * decide — who you are, what state you start in, when that happened.
 *
 * `progress` AND `status` ARE REJECTED HERE, NOT DEFAULTED. A request that enrols
 * and claims 100% in the same breath is asking to record a completion that never
 * happened, which is the exact thing this feature must not permit: completion is
 * evidence, and evidence you can mint at enrolment time is worthless. Rejecting by
 * name says so instead of silently discarding it.
 */
export const validateEnrollInput = (body = {}) => {
  const errors = [];

  if (!isDefined(body.programId) || body.programId === '') {
    errors.push({ field: 'programId', message: 'Please choose a program to enroll in.' });
  } else if (!isObjectIdLike(body.programId)) {
    errors.push({ field: 'programId', message: 'That is not a valid program id.' });
  }

  if ('progress' in body) {
    errors.push({
      field: 'progress',
      message: 'A new enrollment starts at 0%. Update your progress once you begin.',
    });
  }

  if ('status' in body) {
    errors.push({
      field: 'status',
      message: 'A new enrollment starts as enrolled. Update it as you make progress.',
    });
  }

  checkRejectedFields(body, REJECTED_ENROLLMENT_FIELDS, errors);

  return errors;
};

/**
 * PATCH /learning/enrollments/:id
 *
 * `{ progress }`, `{ status }`, or both. There is no separate `/complete` route:
 * completing is `progress: 100`, or `status: 'completed'`, and the service derives
 * the other half — a fourth endpoint that means the same as a PATCH would be the
 * duplicate API the standing rules forbid.
 *
 * WHETHER THE TRANSITION IS LEGAL IS NOT DECIDED HERE. Both "is this a legal move
 * from the current state" and "does this lower a progress figure" need the stored
 * document, so learningEnrollment.service.js owns them; this layer proves the values
 * are well-formed and in range.
 *
 * `programId` is rejected rather than ignored because moving an enrolment to another
 * programme would silently rewrite what a learner is recorded as having studied.
 * Enrol in the other programme instead — that is what the message says.
 */
export const validateEnrollmentUpdateInput = (body = {}) => {
  const errors = [];

  if ('programId' in body) {
    errors.push({
      field: 'programId',
      message: 'An enrollment cannot be moved to a different program. Enroll in that one instead.',
    });
  }

  const touched = ['progress', 'status'].filter((field) => field in body);

  if (touched.length === 0) {
    checkRejectedFields(body, REJECTED_ENROLLMENT_FIELDS, errors);

    if (errors.length === 0) {
      errors.push({ field: 'body', message: 'Send progress, status, or both.' });
    }

    return errors;
  }

  /**
   * Progress is checked here rather than through `checkOptionalInteger` because an
   * empty value is not "clear this field" for a number that always has a value —
   * `progress: ''` is a broken client, and defaulting it to 0 would silently reset a
   * learner's bar to the start.
   */
  if ('progress' in body) {
    const { progress } = body;

    if (progress === null || progress === '') {
      errors.push({ field: 'progress', message: 'Please give a progress percentage.' });
    } else {
      const numeric = Number(progress);

      if (!Number.isFinite(numeric)) {
        errors.push({ field: 'progress', message: 'Progress must be a number.' });
      } else if (!Number.isInteger(numeric)) {
        errors.push({
          field: 'progress',
          message: 'Progress must be a whole number of percent.',
        });
      } else if (numeric < PROGRESS_MIN || numeric > PROGRESS_MAX) {
        errors.push({
          field: 'progress',
          message: `Progress must be between ${PROGRESS_MIN} and ${PROGRESS_MAX}.`,
        });
      }
    }
  }

  checkEnum(
    body.status,
    {
      field: 'status',
      label: 'Status',
      isValid: isValidEnrollmentStatus,
      allowed: ENROLLMENT_STATUS_VALUES,
      required: 'status' in body,
    },
    errors,
  );

  checkRejectedFields(body, REJECTED_ENROLLMENT_FIELDS, errors);

  return errors;
};

/** Query parameters for GET /learning/enrollments — the learner's own list. */
export const validateEnrollmentQueryInput = (query = {}) => {
  const errors = [];

  checkEnum(
    query.status,
    {
      field: 'status',
      label: 'Status',
      isValid: isValidEnrollmentStatus,
      allowed: ENROLLMENT_STATUS_VALUES,
      required: false,
    },
    errors,
  );

  checkOptionalInteger(query.page, { field: 'page', min: 1, max: 100000, label: 'Page' }, errors);
  checkOptionalInteger(
    query.limit,
    { field: 'limit', min: 1, max: LEARNING_PAGE.maxLimit, label: 'Page size' },
    errors,
  );

  return errors;
};

/**
 * Query parameters for GET /learning/recommendations.
 *
 * `careerRoleId` is optional and overrides the student's stored target role, exactly
 * as it does on the existing readiness and recommendation endpoints — a student
 * comparing two roles should not have to change their profile to see the answer.
 */
export const validateRecommendationQueryInput = (query = {}) => {
  const errors = [];

  if (isDefined(query.careerRoleId) && query.careerRoleId !== '') {
    if (!isObjectIdLike(query.careerRoleId)) {
      errors.push({ field: 'careerRoleId', message: 'That is not a valid career role id.' });
    }
  }

  checkOptionalInteger(
    query.limit,
    { field: 'limit', min: 1, max: LEARNING_PAGE.maxLimit, label: 'Limit' },
    errors,
  );

  return errors;
};

/** Identical adapters to every earlier step, so the 400 shape cannot drift. */
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

export const validateCreateLearningProgram = toMiddleware(validateCreateLearningProgramInput);
export const validateUpdateLearningProgram = toMiddleware(validateUpdateLearningProgramInput);
export const validateLearningProgramQuery = toQueryMiddleware(validateLearningProgramQueryInput);
export const validateEnroll = toMiddleware(validateEnrollInput);
export const validateEnrollmentUpdate = toMiddleware(validateEnrollmentUpdateInput);
export const validateEnrollmentQuery = toQueryMiddleware(validateEnrollmentQueryInput);
export const validateRecommendationQuery = toQueryMiddleware(validateRecommendationQueryInput);

export default {
  validateCreateLearningProgram,
  validateUpdateLearningProgram,
  validateLearningProgramQuery,
  validateEnroll,
  validateEnrollmentUpdate,
  validateEnrollmentQuery,
  validateRecommendationQuery,
};
