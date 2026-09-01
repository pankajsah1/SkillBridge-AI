/**
 * Client-side validation for the opportunity form.
 *
 * Same standing as utils/profileValidation.js: a UX convenience that catches
 * obvious mistakes before a round trip and puts the message beside the field. It
 * is NOT a security control. Every rule here is re-checked by
 * server/src/validators/opportunity.validator.js, which is what actually enforces
 * them — anyone can skip this file by calling the API directly.
 *
 * WHY THE ERROR KEYS LOOK LIKE `eligibility.branches` AND `requiredSkills[0]`.
 * They are the exact field paths the server puts in its 400 response. Keeping
 * them identical means a server error and a client error land on the same input
 * with no translation layer between them — and a translation layer is precisely
 * where "the message appeared on the wrong field" bugs live.
 *
 * Limits come from constants/opportunities.js, which mirrors the server's
 * OPPORTUNITY_LIMITS. Change one, change both.
 */

import {
  CREATABLE_OPPORTUNITY_STATUSES,
  DEFAULT_AUDIENCE,
  hasMeaningfulDuration,
  isTypeAllowedForAudience,
  isValidAudience,
  OPPORTUNITY_LIMITS,
  OPPORTUNITY_TYPE_LABELS,
  OPPORTUNITY_TYPE_VALUES,
  TYPES_BY_AUDIENCE,
  WORK_MODE_VALUES,
} from '../constants/opportunities.js';
import { SKILL_LEVEL_MAX, SKILL_LEVEL_MIN } from '../constants/skills.js';

/** The form's shape, and the starting point for a new posting. */
export const emptyOpportunityForm = () => ({
  title: '',
  type: '',
  // Students unless the employer says otherwise, matching the server's
  // DEFAULT_AUDIENCE. Pre-filled rather than blank because the overwhelming
  // majority of postings are student-facing and an empty required field on load is
  // one more thing between an employer and a published opportunity.
  audience: DEFAULT_AUDIENCE,
  description: '',
  location: '',
  workMode: '',
  requiredSkills: [],
  preferredSkills: [],
  eligibility: {
    branches: [],
    minGraduationYear: '',
    maxGraduationYear: '',
    notes: '',
  },
  durationMonths: '',
  openings: '',
  deadline: '',
  status: '',
});

/**
 * Formats a date for `<input type="date">` using LOCAL calendar parts.
 *
 * Not `toISOString().slice(0, 10)`: the server stores a deadline at 23:59:59.999
 * local time, and in a timezone ahead of UTC that instant's ISO string can fall on
 * the *next* day. An employer opening the edit form would then see a date one day
 * later than the one they saved. Local parts in, local parts out.
 */
export const toDateInputValue = (value) => {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * Parses a `yyyy-mm-dd` input value into a local midnight Date.
 *
 * `new Date('2026-08-25')` is UTC midnight, which is the previous evening in the
 * Americas and 5:30am in India. Both would make "is this deadline today?" answer
 * differently depending on where the browser is. Splitting the parts and building
 * a local date keeps the comparison in the same calendar the employer is looking
 * at.
 */
const parseDateInput = (value) => {
  if (typeof value !== 'string') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(date.getTime()) ? null : date;
};

/** Today at local midnight — the earliest deadline the server will accept. */
const todayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const trimmed = (value) => String(value ?? '').trim();

const checkRequiredText = (value, { max, min = 1, label }) => {
  const text = trimmed(value);

  if (!text) return `${label} is required.`;
  if (text.length < min) return `${label} must be at least ${min} characters.`;
  if (text.length > max) return `${label} cannot exceed ${max} characters.`;

  return null;
};

/**
 * An optional whole number. `''` is "not provided", not "invalid".
 *
 * Clearing the openings box is a legitimate action, and an empty number input
 * submits `''` — treating that as an error would make "I removed the duration"
 * impossible.
 */
const checkOptionalInteger = (value, { min, max, label }) => {
  if (value === '' || value === null || value === undefined) return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `${label} must be a number.`;
  if (!Number.isInteger(numeric)) return `${label} must be a whole number.`;
  if (numeric < min || numeric > max) return `${label} must be between ${min} and ${max}.`;

  return null;
};

/**
 * Validates one skill list into the shared `errors` object.
 *
 * `requireLevel` is the difference between the two lists and it is not an
 * arbitrary asymmetry: the server rejects a must-have skill with no stated level,
 * because "we require React" without a bar says nothing an applicant can measure
 * themselves against. "React would be nice" is a complete thought on its own, so a
 * preferred skill needs no level.
 */
const checkSkillList = (entries, { field, label, max, required, requireLevel }, errors) => {
  const list = Array.isArray(entries) ? entries : [];

  if (required && list.length === 0) {
    errors[field] = `Please choose at least one ${label}.`;
    return;
  }

  if (list.length > max) {
    errors[field] = `Please list at most ${max} ${label}s.`;
    return;
  }

  const seen = new Set();

  list.forEach((entry, index) => {
    const id = trimmed(entry?.skillId);

    if (!id) {
      errors[`${field}[${index}]`] = 'Please choose a skill from the catalogue.';
      return;
    }

    if (seen.has(id)) errors[field] = `The same ${label} was listed twice.`;
    seen.add(id);

    if (!requireLevel) return;

    const level = entry?.requiredLevel;
    if (level === '' || level === null || level === undefined) {
      errors[`${field}[${index}].requiredLevel`] = 'Please choose the level you expect.';
      return;
    }

    const numeric = Number(level);
    if (!Number.isInteger(numeric) || numeric < SKILL_LEVEL_MIN || numeric > SKILL_LEVEL_MAX) {
      errors[`${field}[${index}].requiredLevel`] =
        `Level must be a whole number between ${SKILL_LEVEL_MIN} and ${SKILL_LEVEL_MAX}.`;
    }
  });
};

/** Branch chips: bounded, non-blank, and no two spellings of the same branch. */
const checkBranches = (branches) => {
  if (!Array.isArray(branches)) return 'Branches must be a list.';
  if (branches.length > OPPORTUNITY_LIMITS.maxBranches) {
    return `Please list at most ${OPPORTUNITY_LIMITS.maxBranches} branches.`;
  }

  const seen = new Set();

  for (const branch of branches) {
    const text = trimmed(branch);
    if (!text) return 'Branches cannot be blank.';
    if (text.length > OPPORTUNITY_LIMITS.branchMax) {
      return `Each branch must be ${OPPORTUNITY_LIMITS.branchMax} characters or fewer.`;
    }

    const key = text.toLowerCase();
    if (seen.has(key)) return `"${text}" is already listed.`;
    seen.add(key);
  }

  return null;
};

const checkEligibility = (eligibility = {}, errors) => {
  const branchError = checkBranches(eligibility.branches ?? []);
  if (branchError) errors['eligibility.branches'] = branchError;

  const minError = checkOptionalInteger(eligibility.minGraduationYear, {
    min: OPPORTUNITY_LIMITS.graduationYearMin,
    max: OPPORTUNITY_LIMITS.graduationYearMax,
    label: 'Earliest graduation year',
  });
  if (minError) errors['eligibility.minGraduationYear'] = minError;

  const maxError = checkOptionalInteger(eligibility.maxGraduationYear, {
    min: OPPORTUNITY_LIMITS.graduationYearMin,
    max: OPPORTUNITY_LIMITS.graduationYearMax,
    label: 'Latest graduation year',
  });
  if (maxError) errors['eligibility.maxGraduationYear'] = maxError;

  const min = Number(eligibility.minGraduationYear);
  const max = Number(eligibility.maxGraduationYear);
  if (!minError && !maxError && Number.isInteger(min) && Number.isInteger(max) && min > max) {
    errors['eligibility.maxGraduationYear'] =
      'The latest graduation year must not be before the earliest.';
  }

  const notesError =
    trimmed(eligibility.notes).length > OPPORTUNITY_LIMITS.eligibilityNotesMax
      ? `Eligibility notes cannot exceed ${OPPORTUNITY_LIMITS.eligibilityNotesMax} characters.`
      : null;
  if (notesError) errors['eligibility.notes'] = notesError;
};

/**
 * The deadline.
 *
 * Mirrors the server's rule exactly, including that *today* is allowed: a
 * same-day cutoff is a normal thing for an employer to post, and the server
 * pushes the stored instant to the end of that day so it stays open all day.
 */
const checkDeadline = (value) => {
  if (!trimmed(value)) return 'An application deadline is required.';

  const deadline = parseDateInput(value);
  if (!deadline) return 'That is not a valid date.';

  if (deadline.getTime() < todayStart().getTime()) return 'The deadline cannot be in the past.';

  const ceiling = new Date();
  ceiling.setFullYear(ceiling.getFullYear() + OPPORTUNITY_LIMITS.deadlineMaxYearsAhead);

  if (deadline.getTime() > ceiling.getTime()) {
    return `The deadline cannot be more than ${OPPORTUNITY_LIMITS.deadlineMaxYearsAhead} years away.`;
  }

  return null;
};

/**
 * Validates the whole form.
 *
 * @returns {Record<string, string>} field path -> message. Empty object = valid.
 */
export const validateOpportunityForm = (form = {}) => {
  const errors = {};

  const titleError = checkRequiredText(form.title, {
    max: OPPORTUNITY_LIMITS.titleMax,
    label: 'Title',
  });
  if (titleError) errors.title = titleError;

  const descriptionError = checkRequiredText(form.description, {
    min: OPPORTUNITY_LIMITS.descriptionMin,
    max: OPPORTUNITY_LIMITS.descriptionMax,
    label: 'Description',
  });
  if (descriptionError) errors.description = descriptionError;

  const locationError = checkRequiredText(form.location, {
    max: OPPORTUNITY_LIMITS.locationMax,
    label: 'Location',
  });
  if (locationError) errors.location = locationError;

  /**
   * Type, then the type/audience pair — in that order, and the order is the point.
   *
   * An unrecognised type gets the plain "choose a valid type" message rather than a
   * confusing complaint about audiences, exactly as the server's validator does. The
   * pair check only speaks once the type itself is real.
   */
  const audience = isValidAudience(form.audience) ? form.audience : DEFAULT_AUDIENCE;

  if (!trimmed(form.type)) errors.type = 'Opportunity type is required.';
  else if (!OPPORTUNITY_TYPE_VALUES.includes(form.type)) errors.type = 'Choose a valid type.';
  else if (!isTypeAllowedForAudience(form.type, audience)) {
    const allowed = TYPES_BY_AUDIENCE[audience]
      .map((type) => OPPORTUNITY_TYPE_LABELS[type])
      .join(', ');
    errors.type = `${OPPORTUNITY_TYPE_LABELS[form.type]} cannot be offered to this audience. Choose one of: ${allowed}.`;
  }

  if (!isValidAudience(form.audience)) errors.audience = 'Choose who this posting is for.';

  if (!trimmed(form.workMode)) errors.workMode = 'Work mode is required.';
  else if (!WORK_MODE_VALUES.includes(form.workMode)) errors.workMode = 'Choose a valid work mode.';

  checkSkillList(
    form.requiredSkills,
    {
      field: 'requiredSkills',
      label: 'required skill',
      max: OPPORTUNITY_LIMITS.maxRequiredSkills,
      required: true,
      requireLevel: true,
    },
    errors,
  );

  checkSkillList(
    form.preferredSkills,
    {
      field: 'preferredSkills',
      label: 'preferred skill',
      max: OPPORTUNITY_LIMITS.maxPreferredSkills,
      required: false,
      requireLevel: false,
    },
    errors,
  );

  // A skill cannot be both must-have and nice-to-have. The employer has to pick
  // one, because the later matching phase would otherwise have to guess which
  // intention to honour.
  const requiredIds = new Set(
    (form.requiredSkills ?? []).map((entry) => trimmed(entry?.skillId)).filter(Boolean),
  );
  const overlaps = (form.preferredSkills ?? []).some((entry) =>
    requiredIds.has(trimmed(entry?.skillId)),
  );
  if (overlaps) {
    errors.preferredSkills = 'A skill cannot be both required and preferred. Please choose one.';
  }

  checkEligibility(form.eligibility ?? {}, errors);

  const durationError = checkOptionalInteger(form.durationMonths, {
    min: OPPORTUNITY_LIMITS.durationMonthsMin,
    max: OPPORTUNITY_LIMITS.durationMonthsMax,
    label: 'Duration in months',
  });
  if (durationError) errors.durationMonths = durationError;

  const openingsError = checkOptionalInteger(form.openings, {
    min: OPPORTUNITY_LIMITS.openingsMin,
    max: OPPORTUNITY_LIMITS.openingsMax,
    label: 'Number of openings',
  });
  if (openingsError) errors.openings = openingsError;

  const deadlineError = checkDeadline(form.deadline);
  if (deadlineError) errors.deadline = deadlineError;

  if (form.status && !CREATABLE_OPPORTUNITY_STATUSES.includes(form.status)) {
    errors.status = `A new opportunity must be ${CREATABLE_OPPORTUNITY_STATUSES.join(' or ')}.`;
  }

  return errors;
};

/**
 * Fills the form from a stored opportunity, for the edit page.
 *
 * `status` is deliberately blanked. A posting's status is changed by the Publish,
 * Close and Reopen actions in the management list, never by this form — the server
 * reads `status` in a PATCH body as a *transition*, with its own rules about which
 * moves are legal and its own response message. Carrying the stored value in the
 * form would mean every title edit arrived as a status change, and editing a closed
 * posting would fail the "a new opportunity must be draft or active" check on a
 * field that has no input on screen.
 *
 * Numbers become strings because that is what an `<input>` holds; `null` becomes
 * `''` so a cleared field and a never-set field look the same to the diff.
 */
export const formFromOpportunity = (opportunity = {}) => ({
  title: opportunity.title ?? '',
  type: opportunity.type ?? '',
  // Read back so the type dropdown offers the right eight or four when editing.
  // A posting created before Step 7 has no stored audience at all, and `student`
  // is the correct reading of that absence — the same rule the server's
  // `audienceQuery` relies on.
  audience: isValidAudience(opportunity.audience) ? opportunity.audience : DEFAULT_AUDIENCE,
  description: opportunity.description ?? '',
  location: opportunity.location ?? '',
  workMode: opportunity.workMode ?? '',
  requiredSkills: (opportunity.requiredSkills ?? []).map((entry) => ({
    skillId: entry.skillId,
    requiredLevel: entry.requiredLevel,
  })),
  // No level: the stored one is the server's neutral default, which the employer
  // never chose and the preferred-skills picker never shows.
  preferredSkills: (opportunity.preferredSkills ?? []).map((entry) => ({
    skillId: entry.skillId,
  })),
  eligibility: {
    branches: opportunity.eligibility?.branches ?? [],
    minGraduationYear: opportunity.eligibility?.minGraduationYear ?? '',
    maxGraduationYear: opportunity.eligibility?.maxGraduationYear ?? '',
    notes: opportunity.eligibility?.notes ?? '',
  },
  durationMonths: opportunity.durationMonths ?? '',
  openings: opportunity.openings ?? '',
  deadline: toDateInputValue(opportunity.deadline),
  status: '',
});

/** Validates one branch before it becomes a chip. */
export const validateNewBranch = (value, existing = []) => {
  const text = trimmed(value);

  if (!text) return 'Type a branch first.';
  if (text.length > OPPORTUNITY_LIMITS.branchMax) {
    return `Keep it under ${OPPORTUNITY_LIMITS.branchMax} characters.`;
  }
  if (existing.length >= OPPORTUNITY_LIMITS.maxBranches) {
    return `You can list at most ${OPPORTUNITY_LIMITS.maxBranches} branches.`;
  }
  if (existing.some((item) => trimmed(item).toLowerCase() === text.toLowerCase())) {
    return 'That branch is already listed.';
  }

  return null;
};

/** The request body for POST /opportunities, built from the form. */
export const buildOpportunityPayload = (form = {}) => {
  const payload = {
    title: trimmed(form.title),
    type: form.type,
    // Always sent, never guessed. The server defaults a missing audience to
    // `student`, so omitting it would work — but it would also mean the one field
    // that decides who can ever see this posting travelled implicitly. Note that
    // `buildOpportunityPatch` below enumerates the fields it copies and `audience`
    // is not among them, which is what keeps this out of a PATCH body: the API
    // rejects an audience change outright, since a posting students have already
    // seen cannot quietly become a faculty programme.
    audience: isValidAudience(form.audience) ? form.audience : DEFAULT_AUDIENCE,
    description: trimmed(form.description),
    location: trimmed(form.location),
    workMode: form.workMode,
    requiredSkills: (form.requiredSkills ?? []).map((entry) => ({
      skillId: entry.skillId,
      requiredLevel: Number(entry.requiredLevel),
    })),
    // Bare ids: no level is sent, and the server fills in the neutral midpoint.
    // Inventing a level here would put a number the employer never chose in front
    // of the matching phase as though they had.
    preferredSkills: (form.preferredSkills ?? []).map((entry) => ({ skillId: entry.skillId })),
    eligibility: {
      branches: (form.eligibility?.branches ?? []).map(trimmed),
      notes: trimmed(form.eligibility?.notes),
    },
    deadline: form.deadline,
  };

  // A duration is only ever sent for the types that have one. The API answers a
  // duration alongside a type that has none with a 400 ("that opportunity type
  // does not have a duration"), so a number typed while the type was "internship"
  // must not survive a switch to "entry-level job". The form hides the field for
  // those types too; this is the belt to that braces, and it also means removing a
  // duration needs no explicit instruction — the server clears it when the type
  // changes to one without.
  const optionalNumbers = [
    ['durationMonths', hasMeaningfulDuration(form.type) ? form.durationMonths : ''],
    ['openings', form.openings],
  ];

  for (const [field, value] of optionalNumbers) {
    if (value !== '' && value !== null && value !== undefined) payload[field] = Number(value);
  }

  const years = [
    ['minGraduationYear', form.eligibility?.minGraduationYear],
    ['maxGraduationYear', form.eligibility?.maxGraduationYear],
  ];

  for (const [field, value] of years) {
    if (value !== '' && value !== null && value !== undefined) {
      payload.eligibility[field] = Number(value);
    }
  }

  if (form.status) payload.status = form.status;

  return payload;
};

/** A stable string for one skill list, so two lists can be compared by value. */
const skillsFingerprint = (entries = []) =>
  entries
    .map((entry) => `${trimmed(entry?.skillId)}:${entry?.requiredLevel ?? ''}`)
    .sort()
    .join('|');

/**
 * Builds the PATCH body, sending only what actually changed.
 *
 * Three reasons this is a diff rather than the whole form.
 *
 * The API rejects an empty patch with a 400, so a "Save" press with no edits has
 * to be caught here rather than surfaced as an error.
 *
 * `status` in the body is read by the server as a status *transition*, which
 * changes the response message and the audit meaning of the request. Sending an
 * unchanged status on every title edit would make every edit look like a
 * publish.
 *
 * And sending untouched fields would overwrite whatever is stored with a stale
 * copy of it if the posting was edited elsewhere in the meantime.
 *
 * @returns {object} the patch body; `{}` means nothing changed
 */
export const buildOpportunityPatch = (form = {}, original = {}) => {
  const next = buildOpportunityPayload(form);
  const patch = {};

  const textFields = ['title', 'type', 'description', 'location', 'workMode'];
  for (const field of textFields) {
    if (next[field] !== trimmed(original[field])) patch[field] = next[field];
  }

  if (skillsFingerprint(next.requiredSkills) !== skillsFingerprint(original.requiredSkills)) {
    patch.requiredSkills = next.requiredSkills;
  }

  // Compared on ids alone: the stored preferred skills carry the server's default
  // level, which the form never shows and the employer never chose, so a level
  // difference there is not an edit.
  const preferredIds = (entries = []) =>
    entries.map((entry) => trimmed(entry?.skillId)).sort().join('|');

  if (preferredIds(next.preferredSkills) !== preferredIds(original.preferredSkills)) {
    patch.preferredSkills = next.preferredSkills;
  }

  const originalEligibility = {
    branches: (original.eligibility?.branches ?? []).map(trimmed),
    notes: trimmed(original.eligibility?.notes),
  };
  if (original.eligibility?.minGraduationYear !== null &&
      original.eligibility?.minGraduationYear !== undefined) {
    originalEligibility.minGraduationYear = Number(original.eligibility.minGraduationYear);
  }
  if (original.eligibility?.maxGraduationYear !== null &&
      original.eligibility?.maxGraduationYear !== undefined) {
    originalEligibility.maxGraduationYear = Number(original.eligibility.maxGraduationYear);
  }

  if (JSON.stringify(next.eligibility) !== JSON.stringify(originalEligibility)) {
    patch.eligibility = next.eligibility;
  }

  for (const field of ['durationMonths', 'openings']) {
    // `undefined` on both sides means "still not set", which is not a change.
    const nextValue = next[field] ?? null;
    const previousValue =
      original[field] === null || original[field] === undefined ? null : Number(original[field]);

    if (nextValue !== previousValue) patch[field] = next[field] ?? '';
  }

  if (toDateInputValue(original.deadline) !== trimmed(form.deadline)) {
    patch.deadline = form.deadline;
  }

  return patch;
};

/** True when a validate* function returned no messages. */
export const isValid = (errors) => Object.keys(errors).length === 0;

export default {
  emptyOpportunityForm,
  formFromOpportunity,
  validateOpportunityForm,
  validateNewBranch,
  buildOpportunityPayload,
  buildOpportunityPatch,
  toDateInputValue,
  isValid,
};
