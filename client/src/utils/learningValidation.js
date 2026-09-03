/**
 * Learning programme form rules, payload building and patch diffing.
 *
 * A UX convenience only, exactly as utils/validation.js says of itself: it catches
 * obvious mistakes before a round trip and puts each message beside its field.
 * server/src/validators/learning.validator.js re-checks every rule, and its
 * messages win when they disagree — that is why `useLearningProgramEditor` feeds
 * server field errors into the same keyed object this produces.
 *
 * The rules are deliberately the server's rules, read off LEARNING_LIMITS. If you
 * change one, change both.
 *
 * `toDateInputValue` is imported rather than rewritten: the reasoning behind it —
 * local calendar parts, never `toISOString().slice(0, 10)` — is subtle enough that a
 * second copy would eventually drift from the first and reintroduce the off-by-one
 * day it exists to prevent.
 */

import {
  CREATABLE_LEARNING_PROGRAM_STATUSES,
  LEARNING_LIMITS,
  LEARNING_PROGRAM_STATUSES,
} from '../constants/learning.js';
import { isValid, toDateInputValue } from './opportunityValidation.js';

export { isValid, toDateInputValue };

/** A blank programme. `status` is left empty so the form can offer publish or draft. */
export const emptyLearningProgramForm = () => ({
  title: '',
  provider: '',
  description: '',
  type: '',
  level: '',
  deliveryMode: '',
  /** `[{ skillId }]`, the shape SkillRequirementPicker emits with `withLevel` off. */
  targetSkills: [],
  prerequisites: [],
  instructor: '',
  durationHours: '',
  startDate: '',
  endDate: '',
  externalUrl: '',
  status: '',
});

const trimmed = (value) => String(value ?? '').trim();

const checkRequiredText = (value, { min = 1, max, label }) => {
  const text = trimmed(value);

  if (!text) return `${label} is required.`;
  if (text.length < min) return `${label} must be at least ${min} characters.`;
  if (text.length > max) return `${label} cannot exceed ${max} characters.`;

  return null;
};

/** `''` is "not provided", not "invalid" — clearing an optional field is allowed. */
const checkOptionalInteger = (value, { min, max, label }) => {
  if (value === '' || value === null || value === undefined) return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `${label} must be a number.`;
  if (!Number.isInteger(numeric)) return `${label} must be a whole number.`;
  if (numeric < min || numeric > max) return `${label} must be between ${min} and ${max}.`;

  return null;
};

/** Parses `yyyy-mm-dd` into a LOCAL midnight date, for the same reason as the opportunity form. */
const parseDateInput = (value) => {
  if (typeof value !== 'string') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(date.getTime()) ? null : date;
};

const todayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Optional URL, matching the server: a full link on http or https. */
const checkOptionalUrl = (value, label) => {
  const text = trimmed(value);
  if (!text) return null;

  if (text.length > LEARNING_LIMITS.externalUrlMax) {
    return `${label} cannot exceed ${LEARNING_LIMITS.externalUrlMax} characters.`;
  }

  let parsed;

  try {
    parsed = new URL(text);
  } catch {
    return `${label} must be a full link, starting with https://.`;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `${label} must start with http:// or https://.`;
  }

  return null;
};

/**
 * A date within ten years either way, optionally refusing the past.
 *
 * `allowPast` is false for the end date only, and that asymmetry is the server's: a
 * programme that has already started is ordinary, while one that has already ended
 * cannot be enrolled in, so publishing it would put an unreachable row on the hub.
 */
const checkOptionalDate = (value, { label, allowPast = true }) => {
  const text = trimmed(value);
  if (!text) return null;

  const parsed = parseDateInput(text);
  if (!parsed) return `${label} is not a valid date.`;

  if (!allowPast && parsed.getTime() < todayStart().getTime()) {
    return `${label} cannot be in the past.`;
  }

  const years = LEARNING_LIMITS.dateMaxYearsAhead;
  const now = new Date();
  const ceiling = new Date(now);
  ceiling.setFullYear(ceiling.getFullYear() + years);
  const floor = new Date(now);
  floor.setFullYear(floor.getFullYear() - years);

  if (parsed.getTime() > ceiling.getTime() || parsed.getTime() < floor.getTime()) {
    return `${label} must be within ${years} years of today.`;
  }

  return null;
};

/** The skills the programme teaches. At least one, from the catalogue, no repeats. */
const checkTargetSkills = (entries, errors) => {
  const list = Array.isArray(entries) ? entries : [];

  if (list.length === 0) {
    errors.targetSkills = 'Please choose at least one skill this program teaches.';
    return;
  }

  if (list.length > LEARNING_LIMITS.maxSkills) {
    errors.targetSkills = `Please choose at most ${LEARNING_LIMITS.maxSkills} skills.`;
    return;
  }

  const seen = new Set();

  list.forEach((entry, index) => {
    const id = trimmed(typeof entry === 'string' ? entry : entry?.skillId);

    if (!id) {
      errors[`targetSkills[${index}]`] = 'Please choose a skill from the catalogue.';
      return;
    }

    if (seen.has(id)) errors.targetSkills = 'The same skill was listed twice.';
    seen.add(id);
  });
};

const checkPrerequisites = (entries, errors) => {
  const list = Array.isArray(entries) ? entries : [];

  if (list.length > LEARNING_LIMITS.maxPrerequisites) {
    errors.prerequisites = `Please list at most ${LEARNING_LIMITS.maxPrerequisites} prerequisites.`;
    return;
  }

  const seen = new Set();

  list.forEach((entry, index) => {
    const text = trimmed(entry);

    if (!text) {
      errors[`prerequisites[${index}]`] = 'A prerequisite cannot be blank.';
      return;
    }

    if (text.length > LEARNING_LIMITS.prerequisiteMax) {
      errors[`prerequisites[${index}]`] =
        `Each prerequisite must be ${LEARNING_LIMITS.prerequisiteMax} characters or fewer.`;
      return;
    }

    // Case-insensitive: "Basic Python" twice with different capitals is a mistake.
    const key = text.toLowerCase();
    if (seen.has(key)) errors.prerequisites = 'Please remove duplicate prerequisites.';
    seen.add(key);
  });
};

/** One prerequisite, checked as it is typed — for ChipListField's `validate` prop. */
export const validateNewPrerequisite = (value, existing = []) => {
  const text = trimmed(value);

  if (!text) return 'Type a prerequisite first.';
  if (text.length > LEARNING_LIMITS.prerequisiteMax) {
    return `Keep it to ${LEARNING_LIMITS.prerequisiteMax} characters or fewer.`;
  }

  if (existing.some((entry) => trimmed(entry).toLowerCase() === text.toLowerCase())) {
    return 'That prerequisite is already listed.';
  }

  return null;
};

/**
 * Validates the whole form into `{ field: message }`, keyed by the API's field
 * paths so a server error and a client error can occupy the same slot.
 */
export const validateLearningProgramForm = (form = {}) => {
  const errors = {};

  const title = checkRequiredText(form.title, {
    max: LEARNING_LIMITS.titleMax,
    label: 'Title',
  });
  if (title) errors.title = title;

  const provider = checkRequiredText(form.provider, {
    max: LEARNING_LIMITS.providerMax,
    label: 'Provider',
  });
  if (provider) errors.provider = provider;

  const description = checkRequiredText(form.description, {
    min: LEARNING_LIMITS.descriptionMin,
    max: LEARNING_LIMITS.descriptionMax,
    label: 'Description',
  });
  if (description) errors.description = description;

  if (!form.type) errors.type = 'Please choose a program type.';
  if (!form.level) errors.level = 'Please choose a level.';
  if (!form.deliveryMode) errors.deliveryMode = 'Please choose how it is delivered.';

  checkTargetSkills(form.targetSkills, errors);
  checkPrerequisites(form.prerequisites, errors);

  const instructor = trimmed(form.instructor);
  if (instructor.length > LEARNING_LIMITS.instructorMax) {
    errors.instructor = `Instructor or mentor cannot exceed ${LEARNING_LIMITS.instructorMax} characters.`;
  }

  const duration = checkOptionalInteger(form.durationHours, {
    min: LEARNING_LIMITS.durationHoursMin,
    max: LEARNING_LIMITS.durationHoursMax,
    label: 'Duration in hours',
  });
  if (duration) errors.durationHours = duration;

  const startDate = checkOptionalDate(form.startDate, { label: 'Start date' });
  if (startDate) errors.startDate = startDate;

  const endDate = checkOptionalDate(form.endDate, { label: 'End date', allowPast: false });
  if (endDate) errors.endDate = endDate;

  const start = parseDateInput(trimmed(form.startDate));
  const end = parseDateInput(trimmed(form.endDate));

  if (!errors.endDate && start && end && start.getTime() > end.getTime()) {
    errors.endDate = 'The end date cannot be before the start date.';
  }

  const url = checkOptionalUrl(form.externalUrl, 'Program link');
  if (url) errors.externalUrl = url;

  if (form.status && !CREATABLE_LEARNING_PROGRAM_STATUSES.includes(form.status)) {
    // Reachable only from an edit, where `archived` is a legitimate stored value
    // that this form does not offer as a save target — the status buttons do that.
    if (form.status !== LEARNING_PROGRAM_STATUSES.ARCHIVED) {
      errors.status = 'Choose whether to save this as a draft or publish it.';
    }
  }

  return errors;
};

/** Fills the form from a stored programme, for the edit route. */
export const formFromLearningProgram = (program = {}) => ({
  title: program.title ?? '',
  provider: program.provider ?? '',
  description: program.description ?? '',
  type: program.type ?? '',
  level: program.level ?? '',
  deliveryMode: program.deliveryMode ?? '',
  targetSkills: (program.targetSkills ?? []).map((skill) => ({
    skillId: String(skill?.skillId ?? skill),
  })),
  prerequisites: [...(program.prerequisites ?? [])],
  instructor: program.instructor ?? '',
  /** `null` means "no fixed duration"; an empty number input is how that is typed. */
  durationHours: program.durationHours ?? '',
  startDate: toDateInputValue(program.startDate),
  endDate: toDateInputValue(program.endDate),
  externalUrl: program.externalUrl ?? '',
  status: program.status ?? '',
});

/**
 * The POST body.
 *
 * Blank optional fields are omitted rather than sent as `''` — a create request
 * saying `instructor: ''` is claiming to have set something. Skills go out as bare
 * ids, which is what the server's `normaliseSkillIds` reduces them to anyway.
 *
 * NO PUBLISHER FIELD. Ownership comes from the token, and the server rejects
 * `publisherId`, `publisher`, `owner` and `ownerId` by name.
 */
export const buildLearningProgramPayload = (form = {}) => {
  const payload = {
    title: trimmed(form.title),
    provider: trimmed(form.provider),
    description: trimmed(form.description),
    type: form.type,
    level: form.level,
    deliveryMode: form.deliveryMode,
    targetSkills: (form.targetSkills ?? []).map((entry) =>
      trimmed(typeof entry === 'string' ? entry : entry?.skillId),
    ),
    prerequisites: (form.prerequisites ?? []).map((entry) => trimmed(entry)).filter(Boolean),
  };

  if (trimmed(form.instructor)) payload.instructor = trimmed(form.instructor);
  if (form.durationHours !== '' && form.durationHours !== null) {
    payload.durationHours = Number(form.durationHours);
  }
  if (trimmed(form.startDate)) payload.startDate = trimmed(form.startDate);
  if (trimmed(form.endDate)) payload.endDate = trimmed(form.endDate);
  if (trimmed(form.externalUrl)) payload.externalUrl = trimmed(form.externalUrl);
  if (form.status) payload.status = form.status;

  return payload;
};

/** A stable string for one skill list, so two lists can be compared by value. */
const skillIdFingerprint = (entries = []) =>
  entries
    .map((entry) => trimmed(typeof entry === 'string' ? entry : entry?.skillId))
    .sort()
    .join('|');

/**
 * Builds the PATCH body, sending only what actually changed.
 *
 * The same three reasons `buildOpportunityPatch` gives. The API rejects an empty
 * patch with "No editable fields were provided", so a Save press with no edits has
 * to be caught here. `status` in the body is read as a status *transition*, so
 * resending an unchanged one would make every title edit look like a publish. And
 * an untouched field sent back would overwrite whatever is stored now with a stale
 * copy of it.
 *
 * Clearing is `''`, not omission: the server reads an empty string on `instructor`,
 * `durationHours`, `startDate`, `endDate` and `externalUrl` as "clear this field",
 * which is exactly what emptying the input means. Omitting it would mean "leave it".
 *
 * Whether a status change is *legal* is not decided here — the service owns that,
 * and `programStatusActionsFor` is what stops the UI offering an illegal one.
 *
 * @returns {object} the patch body; `{}` means nothing changed
 */
export const buildLearningProgramPatch = (form = {}, original = {}) => {
  const next = buildLearningProgramPayload(form);
  const patch = {};

  const textFields = ['title', 'provider', 'description', 'type', 'level', 'deliveryMode'];
  for (const field of textFields) {
    if (next[field] !== trimmed(original[field])) patch[field] = next[field];
  }

  if (skillIdFingerprint(next.targetSkills) !== skillIdFingerprint(original.targetSkills)) {
    patch.targetSkills = next.targetSkills;
  }

  // Compared in order: reordering the prerequisites a learner reads is a real edit.
  const prerequisiteKey = (entries = []) => entries.map((entry) => trimmed(entry)).join('|');
  if (prerequisiteKey(next.prerequisites) !== prerequisiteKey(original.prerequisites)) {
    patch.prerequisites = next.prerequisites;
  }

  for (const field of ['instructor', 'externalUrl']) {
    const nextValue = next[field] ?? '';
    if (nextValue !== trimmed(original[field])) patch[field] = nextValue;
  }

  // `undefined` on both sides means "still not set", which is not a change.
  const nextDuration = next.durationHours ?? null;
  const storedDuration =
    original.durationHours === null || original.durationHours === undefined
      ? null
      : Number(original.durationHours);
  if (nextDuration !== storedDuration) patch.durationHours = next.durationHours ?? '';

  for (const field of ['startDate', 'endDate']) {
    if (toDateInputValue(original[field]) !== trimmed(form[field])) {
      patch[field] = trimmed(form[field]);
    }
  }

  if (form.status && form.status !== original.status) patch.status = form.status;

  return patch;
};

export default {
  emptyLearningProgramForm,
  validateNewPrerequisite,
  validateLearningProgramForm,
  formFromLearningProgram,
  buildLearningProgramPayload,
  buildLearningProgramPatch,
  isValid,
  toDateInputValue,
};
