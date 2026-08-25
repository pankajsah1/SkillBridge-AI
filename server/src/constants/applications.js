/**
 * Application vocabulary — the one place the six statuses are defined.
 *
 * THE STATUS LIST IS A PROMISE TO THE STUDENT, so it lives here rather than as
 * strings scattered through the service and the model. TRD section 17 names five
 * values; the brief adds `interview` between shortlisting and the decision,
 * because "we want to talk to you" is a real state a candidate can sit in for a
 * week and deserves its own line on the timeline. Six is a superset of five, so
 * nothing the TRD specifies is broken by adding it.
 *
 * ORDER MATTERS IN THIS FILE. APPLICATION_PIPELINE is the sequence the UI draws
 * as a timeline, so it is a list rather than an object — object key order is a
 * language detail and a candidate's progress is not something to leave to it.
 *
 * TRANSITIONS ARE A WHITELIST, NOT A SUGGESTION. A recruiter cannot walk a
 * rejection backwards into an interview, because a student who has been told
 * "no" and then sees "interview" would have been told two contradictory things
 * by the same system. `selected` and `rejected` are terminal for that reason.
 */

/** The six states an application can be in. Values are lowercase, as stored. */
export const APPLICATION_STATUSES = Object.freeze({
  APPLIED: 'applied',
  UNDER_REVIEW: 'under_review',
  SHORTLISTED: 'shortlisted',
  INTERVIEW: 'interview',
  SELECTED: 'selected',
  REJECTED: 'rejected',
});

export const APPLICATION_STATUS_VALUES = Object.freeze(Object.values(APPLICATION_STATUSES));

/** Every application starts here. Nothing else may be passed in on create. */
export const DEFAULT_APPLICATION_STATUS = APPLICATION_STATUSES.APPLIED;

/**
 * The happy path, in order, for the timeline UI.
 *
 * `rejected` is deliberately absent: it is an outcome that can arrive at any
 * point, not a step everyone passes through, and drawing it as stage 6 of 6
 * would imply every application ends there.
 */
export const APPLICATION_PIPELINE = Object.freeze([
  APPLICATION_STATUSES.APPLIED,
  APPLICATION_STATUSES.UNDER_REVIEW,
  APPLICATION_STATUSES.SHORTLISTED,
  APPLICATION_STATUSES.INTERVIEW,
  APPLICATION_STATUSES.SELECTED,
]);

/** Once here, an application is finished — no further transition is allowed. */
export const TERMINAL_APPLICATION_STATUSES = Object.freeze([
  APPLICATION_STATUSES.SELECTED,
  APPLICATION_STATUSES.REJECTED,
]);

export const isTerminalStatus = (status) => TERMINAL_APPLICATION_STATUSES.includes(status);

/**
 * Who may move an application where.
 *
 * Skipping forward is allowed where it is realistic — a recruiter who has
 * already read a CV should not have to click through `under_review` to
 * shortlist — but moving backwards never is.
 */
export const APPLICATION_STATUS_TRANSITIONS = Object.freeze({
  [APPLICATION_STATUSES.APPLIED]: Object.freeze([
    APPLICATION_STATUSES.UNDER_REVIEW,
    APPLICATION_STATUSES.SHORTLISTED,
    APPLICATION_STATUSES.REJECTED,
  ]),
  [APPLICATION_STATUSES.UNDER_REVIEW]: Object.freeze([
    APPLICATION_STATUSES.SHORTLISTED,
    APPLICATION_STATUSES.REJECTED,
  ]),
  [APPLICATION_STATUSES.SHORTLISTED]: Object.freeze([
    APPLICATION_STATUSES.INTERVIEW,
    APPLICATION_STATUSES.SELECTED,
    APPLICATION_STATUSES.REJECTED,
  ]),
  [APPLICATION_STATUSES.INTERVIEW]: Object.freeze([
    APPLICATION_STATUSES.SELECTED,
    APPLICATION_STATUSES.REJECTED,
  ]),
  [APPLICATION_STATUSES.SELECTED]: Object.freeze([]),
  [APPLICATION_STATUSES.REJECTED]: Object.freeze([]),
});

export const isValidApplicationStatus = (status) => APPLICATION_STATUS_VALUES.includes(status);

/**
 * True when `from -> to` is allowed.
 *
 * Same-state returns true so that re-saving the current status is a no-op rather
 * than a 400 — a double-click on "Shortlist" is not an error worth showing.
 */
export const canTransition = (from, to) => {
  if (from === to) return true;
  return (APPLICATION_STATUS_TRANSITIONS[from] ?? []).includes(to);
};

/** The statuses a recruiter may move an application to right now. */
export const nextStatusesFor = (status) => APPLICATION_STATUS_TRANSITIONS[status] ?? [];

/** How each status reads. Sentence-cased for prose, never raw enum values. */
export const APPLICATION_STATUS_LABELS = Object.freeze({
  [APPLICATION_STATUSES.APPLIED]: 'Applied',
  [APPLICATION_STATUSES.UNDER_REVIEW]: 'Under review',
  [APPLICATION_STATUSES.SHORTLISTED]: 'Shortlisted',
  [APPLICATION_STATUSES.INTERVIEW]: 'Interview',
  [APPLICATION_STATUSES.SELECTED]: 'Selected',
  [APPLICATION_STATUSES.REJECTED]: 'Not selected',
});

export const statusLabel = (status) => APPLICATION_STATUS_LABELS[status] ?? 'Applied';

export const APPLICATION_LIMITS = Object.freeze({
  coverNoteMax: 1500,
  statusNoteMax: 500,
});

export const APPLICATION_PAGE = Object.freeze({
  defaultLimit: 10,
  maxLimit: 50,
});

export default APPLICATION_STATUSES;
