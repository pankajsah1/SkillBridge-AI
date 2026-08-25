/**
 * Opportunity vocabulary — the single source of truth for how an opportunity's
 * type, work mode and lifecycle state are represented anywhere in the system.
 *
 * The type, workMode and status value sets are verbatim from TRD.md section 16,
 * which is the authoritative schema for this collection. They are lowercase
 * there, so they are lowercase here — deliberately unlike constants/roles.js,
 * whose uppercase values came from an explicit build instruction. Matching each
 * document where it actually speaks beats making the codebase internally
 * symmetrical at the cost of being wrong.
 *
 * WHY A STATE MACHINE AND NOT JUST AN ENUM. `status` alone cannot express "this
 * opportunity was published, then closed". The three values are the states; the
 * interesting rules are the edges between them, and those live in
 * STATUS_TRANSITIONS below so that "can this change happen?" has exactly one
 * answer in the codebase rather than one per call site.
 */

/**
 * Opportunity types, verbatim from TRD.md section 16.
 *
 * PHASES.md PHASE 3 lists six kinds (Internship, Entry-Level Job,
 * Apprenticeship, Live Project, Workshop, Training Program) and adds "Additional
 * types can be added later." TRD.md section 16 collapses those to four values
 * and is the primary technical authority, so these four are what the enum
 * accepts. Workshops and training programmes are Learning Programs in PHASES.md
 * PHASE 7.2 — a different collection, not a fifth value here.
 */
export const OPPORTUNITY_TYPES = Object.freeze({
  INTERNSHIP: 'internship',
  JOB: 'job',
  APPRENTICESHIP: 'apprenticeship',
  PROJECT: 'project',
});

export const OPPORTUNITY_TYPE_VALUES = Object.freeze(Object.values(OPPORTUNITY_TYPES));

/** Work modes, verbatim from TRD.md section 16. */
export const WORK_MODES = Object.freeze({
  REMOTE: 'remote',
  ONSITE: 'onsite',
  HYBRID: 'hybrid',
});

export const WORK_MODE_VALUES = Object.freeze(Object.values(WORK_MODES));

/**
 * Lifecycle states, verbatim from TRD.md section 16.
 *
 * Note what is NOT here: "expired". A deadline in the past is a fact about the
 * clock, not a state someone transitioned into, so storing it would mean every
 * document needed a nightly job to stay honest and would be wrong in between
 * runs. Expiry is derived from `deadline` on read — see the Opportunity model's
 * `availability` virtual.
 */
export const OPPORTUNITY_STATUSES = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  CLOSED: 'closed',
});

export const OPPORTUNITY_STATUS_VALUES = Object.freeze(Object.values(OPPORTUNITY_STATUSES));

/**
 * The status an opportunity gets when created without one.
 *
 * ACTIVE rather than DRAFT: the overwhelmingly common intent behind filling in
 * the whole form and pressing Publish is to publish. A draft is the deliberate,
 * explicitly-requested case.
 */
export const DEFAULT_OPPORTUNITY_STATUS = OPPORTUNITY_STATUSES.ACTIVE;

/**
 * Statuses an owner may choose at creation time.
 *
 * CLOSED is absent because closing something that was never open is
 * meaningless — there is nothing to close.
 */
export const CREATABLE_OPPORTUNITY_STATUSES = Object.freeze([
  OPPORTUNITY_STATUSES.DRAFT,
  OPPORTUNITY_STATUSES.ACTIVE,
]);

/**
 * The allowed status changes, as `from -> [to]`.
 *
 * TRD.md section 16 names the three states but defines no edges, so these are
 * chosen and documented here rather than left implicit:
 *
 *   draft  -> active   publish a draft
 *   active -> closed   stop accepting candidates
 *   closed -> active   reopen (the service additionally requires a future
 *                      deadline, because reopening something already past its
 *                      deadline would advertise a lie)
 *
 * Two edges are deliberately absent:
 *
 *   active -> draft    un-publishing something students have already seen makes
 *                      it silently vanish. Closing it says the same thing
 *                      honestly, and is reversible.
 *   draft  -> closed   a draft was never open. Deleting it is the honest
 *                      action, and DELETE already exists.
 *
 * Same-state "changes" are not transitions and are handled before this map is
 * consulted; PATCHing the status you already have is a no-op, not an error.
 */
export const STATUS_TRANSITIONS = Object.freeze({
  [OPPORTUNITY_STATUSES.DRAFT]: Object.freeze([OPPORTUNITY_STATUSES.ACTIVE]),
  [OPPORTUNITY_STATUSES.ACTIVE]: Object.freeze([OPPORTUNITY_STATUSES.CLOSED]),
  [OPPORTUNITY_STATUSES.CLOSED]: Object.freeze([OPPORTUNITY_STATUSES.ACTIVE]),
});

/**
 * Derived availability, which is what a reader actually cares about.
 *
 * `status` answers "what did the owner decide?"; this answers "can a student act
 * on it right now?". They differ in exactly one case — an active opportunity
 * whose deadline has passed — and that case is the whole reason this exists.
 */
export const AVAILABILITY = Object.freeze({
  DRAFT: 'draft',
  OPEN: 'open',
  EXPIRED: 'expired',
  CLOSED: 'closed',
});

export const AVAILABILITY_VALUES = Object.freeze(Object.values(AVAILABILITY));

/**
 * Resolves the availability of a status/deadline pair.
 *
 * Kept as a pure function of its two inputs — no `new Date()` inside unless the
 * caller omits `now` — so tests can ask what happens the instant before and
 * after a deadline without waiting for the clock.
 *
 * @param {{status: string, deadline: Date|string|number}} opportunity
 * @param {Date} [now]
 * @returns {'draft'|'open'|'expired'|'closed'}
 */
export const availabilityFor = ({ status, deadline } = {}, now = new Date()) => {
  if (status === OPPORTUNITY_STATUSES.DRAFT) return AVAILABILITY.DRAFT;
  if (status === OPPORTUNITY_STATUSES.CLOSED) return AVAILABILITY.CLOSED;

  const deadlineTime = deadline instanceof Date ? deadline.getTime() : new Date(deadline).getTime();

  // An unreadable deadline should not silently read as "open". Treating it as
  // expired fails closed, which is the safer direction for an availability check.
  if (!Number.isFinite(deadlineTime)) return AVAILABILITY.EXPIRED;

  return deadlineTime >= now.getTime() ? AVAILABILITY.OPEN : AVAILABILITY.EXPIRED;
};

/** True only when a student could act on this today. */
export const isOpen = (opportunity, now = new Date()) =>
  availabilityFor(opportunity, now) === AVAILABILITY.OPEN;

export const isValidOpportunityType = (value) => OPPORTUNITY_TYPE_VALUES.includes(value);
export const isValidWorkMode = (value) => WORK_MODE_VALUES.includes(value);
export const isValidOpportunityStatus = (value) => OPPORTUNITY_STATUS_VALUES.includes(value);

/**
 * Whether `to` is reachable from `from`.
 *
 * A no-op change returns true: PATCHing `status: "active"` onto an already
 * active opportunity is a client sending the whole object back unchanged, which
 * is normal and should not be an error.
 */
export const canTransition = (from, to) => {
  if (from === to) return true;
  return (STATUS_TRANSITIONS[from] ?? []).includes(to);
};

/**
 * Types where a duration is meaningful.
 *
 * An internship, apprenticeship or project runs for a stated length; an
 * entry-level job does not, and asking for one would invite a meaningless
 * answer. The field stays optional for every type — this list drives the form
 * and the "when appropriate" wording in the build brief, not a hard rejection,
 * because a fixed-term job is a real thing.
 */
export const DURATION_RELEVANT_TYPES = Object.freeze([
  OPPORTUNITY_TYPES.INTERNSHIP,
  OPPORTUNITY_TYPES.APPRENTICESHIP,
  OPPORTUNITY_TYPES.PROJECT,
]);

export const hasMeaningfulDuration = (type) => DURATION_RELEVANT_TYPES.includes(type);

/**
 * Field bounds, in one place so the model, the validator and the React form
 * cannot disagree about them.
 *
 * TRD.md section 16 types these fields but gives no lengths, so the numbers are
 * chosen for the shape of real postings: a title is a job title not a paragraph,
 * a description holds an overview plus responsibilities plus requirements, and a
 * skill list past a couple of dozen entries has stopped being a requirement and
 * become a wish list.
 */
export const OPPORTUNITY_LIMITS = Object.freeze({
  titleMax: 150,
  descriptionMin: 30,
  descriptionMax: 5000,
  locationMax: 120,
  maxRequiredSkills: 20,
  maxPreferredSkills: 20,
  maxBranches: 20,
  branchMax: 100,
  eligibilityNotesMax: 1000,
  openingsMin: 1,
  openingsMax: 10000,
  durationMonthsMin: 1,
  durationMonthsMax: 60,
  graduationYearMin: 1950,
  graduationYearMax: 2100,
  /**
   * How far ahead a deadline may be set. Ten years is not a real posting; it is
   * a mistyped year, and catching it at the boundary is kinder than letting it
   * sit in the database forever.
   */
  deadlineMaxYearsAhead: 10,
});

/** Pagination bounds for the browse and my-opportunities lists. */
export const OPPORTUNITY_PAGE = Object.freeze({
  defaultLimit: 10,
  maxLimit: 50,
});

export default OPPORTUNITY_TYPES;
