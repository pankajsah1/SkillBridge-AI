/**
 * Application vocabulary for the browser.
 *
 * A MIRROR OF server/src/constants/applications.js, NOT A SECOND SOURCE OF
 * TRUTH. The server decides what status an application is in and whether a
 * transition is legal; this file only decides how those values are spelled and
 * coloured on screen. Nothing here may invent a status the API cannot return —
 * if the two lists ever disagree, the server wins and this file is the bug.
 *
 * The two constants deliberately duplicated are the status values and the
 * pipeline order, because the client cannot import from server/ (two separate
 * npm projects, no shared package) and hardcoding `'under_review'` inline in
 * three components would be the worse duplication.
 */

export const APPLICATION_STATUSES = Object.freeze({
  APPLIED: 'applied',
  UNDER_REVIEW: 'under_review',
  SHORTLISTED: 'shortlisted',
  INTERVIEW: 'interview',
  SELECTED: 'selected',
  REJECTED: 'rejected',
});

export const APPLICATION_STATUS_VALUES = Object.freeze(Object.values(APPLICATION_STATUSES));

/** The ordered happy path the timeline draws. `rejected` is an outcome, not a step. */
export const APPLICATION_PIPELINE = Object.freeze([
  APPLICATION_STATUSES.APPLIED,
  APPLICATION_STATUSES.UNDER_REVIEW,
  APPLICATION_STATUSES.SHORTLISTED,
  APPLICATION_STATUSES.INTERVIEW,
  APPLICATION_STATUSES.SELECTED,
]);

export const TERMINAL_APPLICATION_STATUSES = Object.freeze([
  APPLICATION_STATUSES.SELECTED,
  APPLICATION_STATUSES.REJECTED,
]);

export const isTerminalStatus = (status) => TERMINAL_APPLICATION_STATUSES.includes(status);

/**
 * The same bounds the server validates against.
 *
 * Duplicated so the textarea's counter can warn before a submit rather than
 * after a 400. The server is still the authority — this only stops the round
 * trip that would tell the student the same thing more slowly.
 */
export const APPLICATION_LIMITS = Object.freeze({
  coverNoteMax: 1500,
  statusNoteMax: 500,
});

/**
 * Label, badge variant and the sentence shown to the student.
 *
 * The `meaning` line is the point of this table. "Shortlisted" tells a student
 * a word; "You are on the shortlist — the company is deciding who to interview"
 * tells them where they stand, which is what they came to the page for.
 */
export const APPLICATION_STATUS_META = Object.freeze({
  [APPLICATION_STATUSES.APPLIED]: {
    label: 'Applied',
    variant: 'primary',
    meaning: 'Your application has been received. The company has not reviewed it yet.',
  },
  [APPLICATION_STATUSES.UNDER_REVIEW]: {
    label: 'Under review',
    variant: 'primary',
    meaning: 'Someone at the company is reading your application.',
  },
  [APPLICATION_STATUSES.SHORTLISTED]: {
    label: 'Shortlisted',
    variant: 'success',
    meaning: 'You are on the shortlist — the company is deciding who to interview.',
  },
  [APPLICATION_STATUSES.INTERVIEW]: {
    label: 'Interview',
    variant: 'success',
    meaning: 'The company wants to interview you. Expect to hear from them directly.',
  },
  [APPLICATION_STATUSES.SELECTED]: {
    label: 'Selected',
    variant: 'success',
    meaning: 'You have been selected for this role.',
  },
  [APPLICATION_STATUSES.REJECTED]: {
    label: 'Not selected',
    variant: 'neutral',
    meaning: 'The company is not moving forward with this application.',
  },
});

const FALLBACK_META = APPLICATION_STATUS_META[APPLICATION_STATUSES.APPLIED];

export const statusMeta = (status) => APPLICATION_STATUS_META[status] ?? FALLBACK_META;

export const statusLabel = (status) => statusMeta(status).label;

export const statusVariant = (status) => statusMeta(status).variant;

export const statusMeaning = (status) => statusMeta(status).meaning;

/**
 * How far along the pipeline a status sits, as a step number.
 *
 * `rejected` returns the step it was rejected *at* being unknowable from the
 * status alone, so it returns 0 and the timeline renders it as an outcome
 * instead of trying to place it.
 */
export const pipelineIndex = (status) => APPLICATION_PIPELINE.indexOf(status);

/** "12 August 2026" — the same long form the opportunity pages use. */
export const formatApplicationDate = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** "Applied 3 days ago" — relative, for list rows where the date is noise. */
export const relativeDays = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const days = Math.floor((Date.now() - date.getTime()) / 86400000);

  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
};

export default APPLICATION_STATUSES;
