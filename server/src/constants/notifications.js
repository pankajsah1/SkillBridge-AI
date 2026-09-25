/**
 * Notification vocabulary — the single source of truth for notification kinds,
 * limits and paging, in the same spirit as constants/applications.js.
 *
 * TYPES ARE DERIVED FROM REAL EVENTS, NOT INVENTED (Step 10 §7). Each value below
 * corresponds to a state the platform can actually prove from stored data: an
 * application's status history, a completed enrolment, an application arriving on a
 * posting, or a priority action the institution intelligence layer already computes.
 * Nothing here is a cosmetic badge — every type maps to a row a user can act on.
 */

/** Canonical notification types. */
export const NOTIFICATION_TYPES = Object.freeze({
  APPLICATION_STATUS: 'application_status',
  APPLICATION_RECEIVED: 'application_received',
  LEARNING_COMPLETED: 'learning_completed',
  REASSESSMENT_DUE: 'reassessment_due',
  INSTITUTION_ACTION: 'institution_action',
});

export const NOTIFICATION_TYPE_VALUES = Object.freeze(Object.values(NOTIFICATION_TYPES));

export const isValidNotificationType = (type) => NOTIFICATION_TYPE_VALUES.includes(type);

/** Field length ceilings, so a derived title/body can never grow unbounded. */
export const NOTIFICATION_LIMITS = Object.freeze({
  titleMax: 160,
  bodyMax: 500,
  linkMax: 300,
  dedupeKeyMax: 200,
});

/** Paging window for the notifications list, matching the learning/application feel. */
export const NOTIFICATION_PAGE = Object.freeze({
  defaultLimit: 20,
  maxLimit: 50,
});

export default NOTIFICATION_TYPES;
