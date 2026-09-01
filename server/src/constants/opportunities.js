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

import { ROLES } from './roles.js';

/**
 * Who a posting is aimed at (Step 7).
 *
 * WHY THIS FIELD EXISTS AND WHY IT DEFAULTS TO STUDENT. Before Step 7 every
 * opportunity was implicitly student-targeted — the model carried no audience
 * field at all, and `eligibility` is student-shaped (branches, graduation years).
 * Adding an explicit audience with `student` as the default means every document
 * already in the database is correct as it stands: no migration, no backfill, and
 * a posting created by code that predates this field still lands in exactly the
 * same place. That property is the whole reason the default is not null.
 *
 * ONE FIELD, NOT A LIST OF ELIGIBLE ROLES. The Step 7 brief offers
 * `targetAudience`, `eligibleRoles` or an equivalent. A single value was chosen
 * because the two audiences want genuinely different postings — a Faculty
 * Development Programme is not an internship a student could also take — and a
 * multi-role array would invite postings claiming both while stating student
 * eligibility rules that mean nothing to a professor. If a genuinely
 * cross-audience posting is ever needed, adding a third `both` value here is a
 * one-line change that every existing query already reads.
 *
 * THE THREE PLACES THAT MUST FILTER ON THIS, or student surfaces start showing
 * faculty programmes: `buildDiscoveryFilter` in `opportunity.service.js`,
 * `liveFilter` in `matching.service.js`, and the two demand queries in
 * `recommendation.service.js` and `analytics.service.js`. All of them do, and all
 * of them go through `audienceQuery` below.
 */
export const AUDIENCES = Object.freeze({
  STUDENT: 'student',
  ACADEMICIAN: 'academician',
});

export const AUDIENCE_VALUES = Object.freeze(Object.values(AUDIENCES));

/** Existing documents predate the field, so the default must be what they were. */
export const DEFAULT_AUDIENCE = AUDIENCES.STUDENT;

export const isValidAudience = (value) => AUDIENCE_VALUES.includes(value);

/**
 * The `audience` clause to put in a query — NOT the bare value.
 *
 * THIS FUNCTION IS THE "NO MIGRATION" CLAIM ABOVE, and without it that claim
 * would be false in the one direction that matters. Mongoose applies a schema
 * default when it *hydrates* a document, so reading a pre-Step-7 posting gives
 * back `audience: 'student'` — but it does not rewrite *queries*. A filter of
 * `{ audience: 'student' }` is sent to MongoDB verbatim and matches only
 * documents that actually store that key, so every posting created before this
 * field existed would silently vanish from the student browse page, the student's
 * ranked matches and the institution's demand figures. That is a far worse
 * regression than the leak the audience filter was added to prevent, and it is
 * invisible in testing against a freshly seeded database, where every document
 * has the field.
 *
 * `{ $in: ['student', null] }` is the fix: in MongoDB a `null` in `$in` matches
 * documents whose field is null *and* documents missing the field entirely. So a
 * legacy posting reads as a student posting in a query exactly as it already does
 * in memory, and the two layers finally agree.
 *
 * The academician branch needs no such tolerance — no document can predate a value
 * that has never existed before now — and stays an equality match so it can use
 * the `{ audience, status, deadline }` index most directly.
 *
 * @param {string} [audience] One of AUDIENCE_VALUES.
 * @returns {object|string} A value to assign to the `audience` key of a filter.
 */
export const audienceQuery = (audience = DEFAULT_AUDIENCE) =>
  audience === DEFAULT_AUDIENCE ? { $in: [DEFAULT_AUDIENCE, null] } : audience;

/**
 * Which audience's postings a given role browses.
 *
 * WHY THIS LIVES IN THE CONSTANTS AND NOT IN THE CONTROLLER. `GET /opportunities`
 * serves both audiences from one handler, and the audience has to come from the
 * authenticated role rather than from a query parameter — otherwise a student
 * could pass `?audience=academician`, browse faculty programmes and apply to one.
 * Putting the mapping here makes it one named, testable function instead of an
 * inline ternary that a second call site would quietly copy and get wrong.
 *
 * EVERY OTHER ROLE FALLS BACK TO STUDENT, which is exactly what industry and
 * institution readers saw before Step 7 — the endpoint's behaviour for them is
 * unchanged, which is what makes this extension rather than a rewrite.
 *
 * @param {string} role A value from constants/roles.js.
 * @returns {'student'|'academician'}
 */
export const audienceForRole = (role) =>
  role === ROLES.ACADEMICIAN ? AUDIENCES.ACADEMICIAN : AUDIENCES.STUDENT;

/**
 * Opportunity types.
 *
 * The first four are verbatim from TRD.md section 16. PHASES.md PHASE 3 lists six
 * kinds (Internship, Entry-Level Job, Apprenticeship, Live Project, Workshop,
 * Training Program) and adds "Additional types can be added later." TRD.md
 * section 16 collapsed those to four, and those four remain exactly what a
 * student-facing posting may be.
 *
 * STEP 7 ADDS EIGHT ACADEMICIAN-FACING TYPES to the same enum rather than
 * creating a parallel collection. The reasoning, since an earlier comment here
 * argued the other way for workshops:
 *
 *   A Faculty Development Programme has an owner, a title, a description, a
 *   location, a work mode, required skills, a deadline, a number of places and a
 *   draft/active/closed lifecycle. That is this schema, field for field. A second
 *   collection would duplicate all of it, then need its own service, controller,
 *   validator, application model and matching path — and the Step 7 brief
 *   explicitly forbids exactly that: "Do not blindly add all of these as separate
 *   models. Prefer extending the existing opportunity model."
 *
 *   The earlier note reserved workshops for a separate Learning Programs
 *   collection (PHASES.md PHASE 7.2). That collection was never built, and
 *   PHASE 7.2's learning programmes are a *student* concept — courses a student
 *   takes to close a skill gap. A workshop an industry partner runs *for faculty*
 *   is a different thing that happens to share a word. Nothing is being
 *   contradicted; the Learning Program collection remains available for its own
 *   purpose if a later step builds it.
 *
 * WHICH TYPES ARE LEGAL FOR WHICH AUDIENCE is enforced by `TYPES_BY_AUDIENCE`
 * below and by a model hook, so "an internship for academicians" cannot be
 * created even though both values exist in one enum.
 */
export const OPPORTUNITY_TYPES = Object.freeze({
  /* Student-facing — TRD.md section 16. */
  INTERNSHIP: 'internship',
  JOB: 'job',
  APPRENTICESHIP: 'apprenticeship',
  PROJECT: 'project',

  /* Academician-facing — Step 7. */
  FACULTY_INTERNSHIP: 'faculty_internship',
  INDUSTRIAL_TRAINING: 'industrial_training',
  FDP: 'fdp',
  WORKSHOP: 'workshop',
  MENTORSHIP: 'mentorship',
  RESEARCH_COLLABORATION: 'research_collaboration',
  CONSULTANCY: 'consultancy',
  GUEST_LECTURE: 'guest_lecture',
});

export const OPPORTUNITY_TYPE_VALUES = Object.freeze(Object.values(OPPORTUNITY_TYPES));

/**
 * Which types each audience may be offered.
 *
 * THIS IS WHAT KEEPS ONE ENUM FROM BECOMING A MESS. The model validates a
 * posting's `type` against its `audience` through this table, so the four
 * original values stay exactly as available to students as they were, and none of
 * the eight new ones can appear on a student's browse page even if someone posts
 * one by hand.
 *
 * The student list is unchanged from what the enum contained before Step 7 —
 * asserted by the Step 7 verification script, because silently widening what a
 * student can be shown would be a regression dressed as a feature.
 */
export const TYPES_BY_AUDIENCE = Object.freeze({
  [AUDIENCES.STUDENT]: Object.freeze([
    OPPORTUNITY_TYPES.INTERNSHIP,
    OPPORTUNITY_TYPES.JOB,
    OPPORTUNITY_TYPES.APPRENTICESHIP,
    OPPORTUNITY_TYPES.PROJECT,
  ]),
  [AUDIENCES.ACADEMICIAN]: Object.freeze([
    OPPORTUNITY_TYPES.FACULTY_INTERNSHIP,
    OPPORTUNITY_TYPES.INDUSTRIAL_TRAINING,
    OPPORTUNITY_TYPES.FDP,
    OPPORTUNITY_TYPES.WORKSHOP,
    OPPORTUNITY_TYPES.MENTORSHIP,
    OPPORTUNITY_TYPES.RESEARCH_COLLABORATION,
    OPPORTUNITY_TYPES.CONSULTANCY,
    OPPORTUNITY_TYPES.GUEST_LECTURE,
  ]),
});

/** True when this type may be offered to this audience. */
export const isTypeAllowedForAudience = (type, audience) =>
  (TYPES_BY_AUDIENCE[audience] ?? []).includes(type);

/**
 * Academician-facing types split by what the person is actually being asked to
 * do, because the dashboard asks two different questions.
 *
 * COLLABORATION is a two-way working relationship with a company: joint research,
 * paid consultancy, mentoring their people, going in to lecture. The academician
 * brings expertise and the company brings a problem.
 *
 * PROGRAMME is something the academician attends to learn: an FDP, a workshop, a
 * stint inside a company, industrial training. The company brings the expertise.
 *
 * The distinction is the difference between "Collaboration Opportunities" and
 * "Upcoming Programs" on the Step 7 dashboard, and between "what can I offer?"
 * and "what can I gain?" for the person reading it. Every academician type
 * belongs to exactly one of the two — asserted by the verification script, so a
 * ninth type added later cannot quietly fall through both cards.
 */
export const COLLABORATION_TYPES = Object.freeze([
  OPPORTUNITY_TYPES.MENTORSHIP,
  OPPORTUNITY_TYPES.RESEARCH_COLLABORATION,
  OPPORTUNITY_TYPES.CONSULTANCY,
  OPPORTUNITY_TYPES.GUEST_LECTURE,
]);

export const PROGRAMME_TYPES = Object.freeze([
  OPPORTUNITY_TYPES.FACULTY_INTERNSHIP,
  OPPORTUNITY_TYPES.INDUSTRIAL_TRAINING,
  OPPORTUNITY_TYPES.FDP,
  OPPORTUNITY_TYPES.WORKSHOP,
]);

export const isCollaborationType = (type) => COLLABORATION_TYPES.includes(type);
export const isProgrammeType = (type) => PROGRAMME_TYPES.includes(type);

/**
 * Human labels for every type.
 *
 * Server-side because error messages use them ("a research collaboration cannot
 * be offered to students"). The client keeps its own copy for rendering, the same
 * split every other constants pair in this project uses.
 */
export const OPPORTUNITY_TYPE_LABELS = Object.freeze({
  [OPPORTUNITY_TYPES.INTERNSHIP]: 'Internship',
  [OPPORTUNITY_TYPES.JOB]: 'Job',
  [OPPORTUNITY_TYPES.APPRENTICESHIP]: 'Apprenticeship',
  [OPPORTUNITY_TYPES.PROJECT]: 'Live project',
  [OPPORTUNITY_TYPES.FACULTY_INTERNSHIP]: 'Faculty internship',
  [OPPORTUNITY_TYPES.INDUSTRIAL_TRAINING]: 'Industrial training',
  [OPPORTUNITY_TYPES.FDP]: 'Faculty Development Programme',
  [OPPORTUNITY_TYPES.WORKSHOP]: 'Workshop',
  [OPPORTUNITY_TYPES.MENTORSHIP]: 'Mentorship',
  [OPPORTUNITY_TYPES.RESEARCH_COLLABORATION]: 'Research collaboration',
  [OPPORTUNITY_TYPES.CONSULTANCY]: 'Consultancy',
  [OPPORTUNITY_TYPES.GUEST_LECTURE]: 'Guest lecture',
});

export const typeLabel = (type) => OPPORTUNITY_TYPE_LABELS[type] ?? type;

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
 *
 * The Step 7 additions follow the same test: a faculty internship, an industrial
 * training stint, a research collaboration and a consultancy all run for a
 * period. An FDP, a workshop and a guest lecture are events with a date, and
 * mentorship is open-ended, so none of those four appear here.
 */
export const DURATION_RELEVANT_TYPES = Object.freeze([
  OPPORTUNITY_TYPES.INTERNSHIP,
  OPPORTUNITY_TYPES.APPRENTICESHIP,
  OPPORTUNITY_TYPES.PROJECT,
  OPPORTUNITY_TYPES.FACULTY_INTERNSHIP,
  OPPORTUNITY_TYPES.INDUSTRIAL_TRAINING,
  OPPORTUNITY_TYPES.RESEARCH_COLLABORATION,
  OPPORTUNITY_TYPES.CONSULTANCY,
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
