/**
 * Opportunity vocabulary for the UI.
 *
 * A deliberate parallel of server/src/constants/opportunities.js, exactly as
 * constants/skills.js parallels the server's proficiency bands. The duplication
 * is unavoidable across a process boundary: the browser cannot import from the
 * server package. If you change a value here, change it there too — the test
 * suite asserts the two agree.
 *
 * The wire values are lowercase because TRD.md section 16 defines them that way.
 * Everything human-facing lives in the *_LABELS maps below, so no component ever
 * has to decide how to spell "onsite" for a person.
 */

/**
 * Who a posting is addressed to. Matches the server's AUDIENCES.
 *
 * The API never asks the reader which audience they are — it derives that from
 * the authenticated role — so the client needs this only in two places: the
 * employer's create form, where the employer chooses who they are writing for,
 * and the academician pages, which label the two kinds of listing differently.
 */
export const AUDIENCES = Object.freeze({
  STUDENT: 'student',
  ACADEMICIAN: 'academician',
});

export const AUDIENCE_VALUES = Object.freeze(Object.values(AUDIENCES));

export const DEFAULT_AUDIENCE = AUDIENCES.STUDENT;

export const AUDIENCE_LABELS = Object.freeze({
  [AUDIENCES.STUDENT]: 'Students',
  [AUDIENCES.ACADEMICIAN]: 'Academicians / faculty',
});

export const isValidAudience = (value) => AUDIENCE_VALUES.includes(value);

export const audienceLabel = (audience) => AUDIENCE_LABELS[audience] ?? AUDIENCE_LABELS[DEFAULT_AUDIENCE];

/** Matches the server's OPPORTUNITY_TYPES. */
export const OPPORTUNITY_TYPES = Object.freeze({
  /* Student-facing. */
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
 * Display names for every type.
 *
 * "Entry-Level Job" rather than "Job" because that is what PHASES.md PHASE 3
 * calls it and it is the more honest label for a student audience — a fresher
 * scanning a list should not have to wonder whether "Job" includes senior roles.
 * The server's own labels differ slightly for the same reason in reverse: it uses
 * them inside error messages, where "Entry-Level Job" would read oddly. Labels
 * are the one thing the two copies are allowed to disagree about; wire values are
 * not.
 */
export const OPPORTUNITY_TYPE_LABELS = Object.freeze({
  [OPPORTUNITY_TYPES.INTERNSHIP]: 'Internship',
  [OPPORTUNITY_TYPES.JOB]: 'Entry-Level Job',
  [OPPORTUNITY_TYPES.APPRENTICESHIP]: 'Apprenticeship',
  [OPPORTUNITY_TYPES.PROJECT]: 'Live Project',
  [OPPORTUNITY_TYPES.FACULTY_INTERNSHIP]: 'Faculty Internship',
  [OPPORTUNITY_TYPES.INDUSTRIAL_TRAINING]: 'Industrial Training',
  [OPPORTUNITY_TYPES.FDP]: 'Faculty Development Programme',
  [OPPORTUNITY_TYPES.WORKSHOP]: 'Workshop',
  [OPPORTUNITY_TYPES.MENTORSHIP]: 'Mentorship',
  [OPPORTUNITY_TYPES.RESEARCH_COLLABORATION]: 'Research Collaboration',
  [OPPORTUNITY_TYPES.CONSULTANCY]: 'Consultancy',
  [OPPORTUNITY_TYPES.GUEST_LECTURE]: 'Guest Lecture',
});

/**
 * Which types each audience may be offered. Mirrors TYPES_BY_AUDIENCE.
 *
 * ALSO THE DISPLAY ORDER, which is why it is a frozen array rather than a Set:
 * every dropdown and filter list in the app reads its options from here, so the
 * server's rule about what is legal and the UI's decision about what to offer
 * cannot drift apart. The student list is byte-for-byte the four values that used
 * to be the whole enum, so no student surface changes.
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

export const isTypeAllowedForAudience = (type, audience) =>
  (TYPES_BY_AUDIENCE[audience] ?? []).includes(type);

/** The types to offer a reader of `audience`, in display order. */
export const typeOrderFor = (audience) =>
  TYPES_BY_AUDIENCE[audience] ?? TYPES_BY_AUDIENCE[DEFAULT_AUDIENCE];

/**
 * STILL THE FOUR STUDENT TYPES, deliberately.
 *
 * Three filter bars and the create form read this. Widening it to all twelve
 * would have put "Faculty Development Programme" in the student browse filter —
 * an option that can only ever return nothing, since the API scopes discovery by
 * the caller's role. Anything that legitimately spans both audiences asks
 * `typeOrderFor` or `ALL_TYPE_ORDER` by name instead.
 */
export const OPPORTUNITY_TYPE_ORDER = TYPES_BY_AUDIENCE[AUDIENCES.STUDENT];

/**
 * Every type, students first.
 *
 * For the employer's own-postings filter, which is the one list that mixes
 * audiences: an employer who has posted both an internship and an FDP owns both,
 * and hiding half their work behind an audience they did not choose would be a
 * bug. The server agrees — its query validator only restricts the type filter by
 * audience for *discovery*, never for the owner list.
 */
export const ALL_TYPE_ORDER = Object.freeze([
  ...TYPES_BY_AUDIENCE[AUDIENCES.STUDENT],
  ...TYPES_BY_AUDIENCE[AUDIENCES.ACADEMICIAN],
]);

/**
 * The academician split: what you can offer versus what you can gain.
 *
 * COLLABORATION is a two-way working relationship with a company — joint
 * research, paid consultancy, mentoring their engineers, going in to lecture. The
 * academician brings the expertise.
 *
 * PROGRAMME is something the academician attends to learn: an FDP, a workshop, a
 * stint inside a company. The company brings the expertise.
 *
 * That is the difference between the dashboard's "Collaboration Opportunities"
 * and "Upcoming Programs" cards. Mirrors the server's two arrays.
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

/** Matches the server's WORK_MODES. */
export const WORK_MODES = Object.freeze({
  REMOTE: 'remote',
  ONSITE: 'onsite',
  HYBRID: 'hybrid',
});

export const WORK_MODE_VALUES = Object.freeze(Object.values(WORK_MODES));

export const WORK_MODE_LABELS = Object.freeze({
  [WORK_MODES.REMOTE]: 'Remote',
  [WORK_MODES.ONSITE]: 'On-site',
  [WORK_MODES.HYBRID]: 'Hybrid',
});

export const WORK_MODE_ORDER = Object.freeze([
  WORK_MODES.REMOTE,
  WORK_MODES.ONSITE,
  WORK_MODES.HYBRID,
]);

/** Matches the server's OPPORTUNITY_STATUSES. */
export const OPPORTUNITY_STATUSES = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  CLOSED: 'closed',
});

export const OPPORTUNITY_STATUS_VALUES = Object.freeze(Object.values(OPPORTUNITY_STATUSES));

/**
 * Status names for the employer's own filter.
 *
 * Distinct from AVAILABILITY_BADGE below, and the difference matters: status is
 * what the employer decided, availability is what a student can act on. An active
 * posting whose deadline has passed is `status: 'active'` and
 * `availability: 'expired'` at the same time, so one set of labels could not
 * honestly describe both.
 */
export const OPPORTUNITY_STATUS_LABELS = Object.freeze({
  [OPPORTUNITY_STATUSES.DRAFT]: 'Draft',
  [OPPORTUNITY_STATUSES.ACTIVE]: 'Active',
  [OPPORTUNITY_STATUSES.CLOSED]: 'Closed',
});

/** Mirrors CREATABLE_OPPORTUNITY_STATUSES — `closed` is not a way to start. */
export const CREATABLE_OPPORTUNITY_STATUSES = Object.freeze([
  OPPORTUNITY_STATUSES.DRAFT,
  OPPORTUNITY_STATUSES.ACTIVE,
]);

/**
 * Mirrors the server's STATUS_TRANSITIONS: `from -> [to]`.
 *
 * The UI reads this rather than hardcoding which buttons to show, so a button
 * that the server would refuse cannot appear. Two edges are absent on purpose and
 * the reasons are on the server copy: active -> draft would make a posting
 * students have already seen silently vanish, and draft -> closed is meaningless
 * because a draft was never open.
 */
export const STATUS_TRANSITIONS = Object.freeze({
  [OPPORTUNITY_STATUSES.DRAFT]: Object.freeze([OPPORTUNITY_STATUSES.ACTIVE]),
  [OPPORTUNITY_STATUSES.ACTIVE]: Object.freeze([OPPORTUNITY_STATUSES.CLOSED]),
  [OPPORTUNITY_STATUSES.CLOSED]: Object.freeze([OPPORTUNITY_STATUSES.ACTIVE]),
});

/**
 * The status buttons to offer for a posting in `status`, already labelled.
 *
 * The label depends on where you are coming from, not just where you are going:
 * draft -> active is "Publish" (it has never been seen), while closed -> active
 * is "Reopen" (it has). Same request, different promise to the employer.
 */
export const statusActionsFor = (status) =>
  (STATUS_TRANSITIONS[status] ?? []).map((to) => {
    if (to === OPPORTUNITY_STATUSES.ACTIVE) {
      return status === OPPORTUNITY_STATUSES.DRAFT
        ? { to, label: 'Publish', variant: 'primary' }
        : { to, label: 'Reopen', variant: 'secondary' };
    }

    return { to, label: 'Close', variant: 'secondary' };
  });

/** Mirrors the server's OPPORTUNITY_PAGE, so the client asks for a legal page size. */
export const OPPORTUNITY_PAGE = Object.freeze({
  defaultLimit: 10,
  maxLimit: 50,
});

/**
 * Derived availability, mirroring the server's AVAILABILITY.
 *
 * The API sends this on every opportunity it returns, so the UI displays it
 * rather than computing it. The helpers below exist for the one case where the UI
 * legitimately needs its own answer: previewing an unsaved form.
 */
export const AVAILABILITY = Object.freeze({
  DRAFT: 'draft',
  OPEN: 'open',
  EXPIRED: 'expired',
  CLOSED: 'closed',
});

/**
 * How each availability state is presented.
 *
 * `variant` names a Badge variant from components/ui/Badge.jsx — no new colour
 * system, and never colour alone: the label always renders beside the dot, per
 * DESIGN.md section 40 ("Important information should not be communicated
 * through color alone").
 */
export const AVAILABILITY_BADGE = Object.freeze({
  [AVAILABILITY.OPEN]: { label: 'Open', variant: 'success' },
  [AVAILABILITY.EXPIRED]: { label: 'Deadline passed', variant: 'warning' },
  [AVAILABILITY.CLOSED]: { label: 'Closed', variant: 'neutral' },
  [AVAILABILITY.DRAFT]: { label: 'Draft', variant: 'outline' },
});

export const availabilityBadge = (availability) =>
  AVAILABILITY_BADGE[availability] ?? AVAILABILITY_BADGE[AVAILABILITY.CLOSED];

/**
 * Resolves availability from a status and deadline.
 *
 * Deliberately identical in behaviour to the server's `availabilityFor`. The
 * server is the source of truth for every stored opportunity; this is for the
 * create/edit form's preview, where nothing has been saved yet and there is
 * nothing to ask the API about.
 */
export const availabilityFor = ({ status, deadline } = {}, now = new Date()) => {
  if (status === OPPORTUNITY_STATUSES.DRAFT) return AVAILABILITY.DRAFT;
  if (status === OPPORTUNITY_STATUSES.CLOSED) return AVAILABILITY.CLOSED;

  const deadlineTime = deadline instanceof Date ? deadline.getTime() : new Date(deadline).getTime();
  if (!Number.isFinite(deadlineTime)) return AVAILABILITY.EXPIRED;

  return deadlineTime >= now.getTime() ? AVAILABILITY.OPEN : AVAILABILITY.EXPIRED;
};

/**
 * Types where a duration field is worth showing. Mirrors DURATION_RELEVANT_TYPES.
 *
 * The academician additions are the ones that run for a stretch of months: a
 * faculty internship or industrial training placement, a research collaboration, a
 * consultancy engagement. Absent are FDP, workshop and guest lecture, which are
 * measured in days or hours and whose length belongs in the description, and
 * mentorship, which is open-ended by nature.
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

/** Mirrors the server's OPPORTUNITY_LIMITS, so the form warns before the API rejects. */
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
  deadlineMaxYearsAhead: 10,
});

export const typeLabel = (type) => OPPORTUNITY_TYPE_LABELS[type] ?? 'Opportunity';
export const workModeLabel = (mode) => WORK_MODE_LABELS[mode] ?? '—';

/** "6 months", "1 month", or null when there is nothing to say. */
export const durationLabel = (months) => {
  const numeric = Number(months);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return `${numeric} ${numeric === 1 ? 'month' : 'months'}`;
};

/**
 * "25 Aug 2026" — the deadline format DESIGN.md section 18 shows on the card.
 *
 * Uses en-GB explicitly rather than the visitor's locale so the demo reads the
 * same on every machine, and so a date never renders in the ambiguous US
 * month/day order for an Indian audience.
 */
export const formatDeadline = (deadline) => {
  const date = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(date.getTime())) return 'No deadline';

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * "3 days left", "Closes today", "Closed 2 days ago".
 *
 * Deliberately says nothing about *availability* — a closed opportunity with a
 * future deadline still has days remaining on the clock, and it would be
 * misleading to imply a student could act on it. The status badge carries that
 * meaning; this is only about the calendar.
 */
export const deadlineCountdown = (deadline, now = new Date()) => {
  const date = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;

  const msPerDay = 24 * 60 * 60 * 1000;
  const startOfDay = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.round((startOfDay(date) - startOfDay(now)) / msPerDay);

  if (days === 0) return 'Closes today';
  if (days === 1) return '1 day left';
  if (days > 1) return `${days} days left`;
  if (days === -1) return 'Closed yesterday';
  return `Closed ${Math.abs(days)} days ago`;
};

export default OPPORTUNITY_TYPES;
