/**
 * Learning vocabulary for the UI.
 *
 * A deliberate parallel of server/src/constants/learning.js, exactly as
 * constants/opportunities.js parallels the server's opportunity enums. The
 * duplication is unavoidable across a process boundary: the browser cannot
 * import from the server package. If you change a wire value here, change it
 * there too — the verifier suite asserts the two agree.
 *
 * The wire values are lowercase (snake_case where they need two words) because
 * that is what the API validates and stores. Everything a person reads comes out
 * of the *_LABELS maps below, so no component has to decide how to spell
 * "self_paced" for a human being.
 */

/** Mirrors the server's LEARNING_PROGRAM_TYPES. */
export const LEARNING_PROGRAM_TYPES = Object.freeze({
  COURSE: 'course',
  CERTIFICATION: 'certification',
  WORKSHOP: 'workshop',
  TRAINING: 'training',
  MENTORSHIP: 'mentorship',
});

export const LEARNING_PROGRAM_TYPE_VALUES = Object.freeze(
  Object.values(LEARNING_PROGRAM_TYPES),
);

export const LEARNING_PROGRAM_TYPE_LABELS = Object.freeze({
  [LEARNING_PROGRAM_TYPES.COURSE]: 'Course',
  [LEARNING_PROGRAM_TYPES.CERTIFICATION]: 'Certification',
  [LEARNING_PROGRAM_TYPES.WORKSHOP]: 'Workshop',
  [LEARNING_PROGRAM_TYPES.TRAINING]: 'Training',
  [LEARNING_PROGRAM_TYPES.MENTORSHIP]: 'Mentorship',
});

/**
 * ALSO THE DISPLAY ORDER, which is why it is a frozen array rather than a Set:
 * the hub's filter bar and the publisher's create form both read their options
 * from here, so what the server accepts and what the UI offers cannot drift.
 * Broadest first — most of the catalogue is courses.
 */
export const LEARNING_PROGRAM_TYPE_ORDER = Object.freeze([
  LEARNING_PROGRAM_TYPES.COURSE,
  LEARNING_PROGRAM_TYPES.CERTIFICATION,
  LEARNING_PROGRAM_TYPES.TRAINING,
  LEARNING_PROGRAM_TYPES.WORKSHOP,
  LEARNING_PROGRAM_TYPES.MENTORSHIP,
]);

export const programTypeLabel = (type) => LEARNING_PROGRAM_TYPE_LABELS[type] ?? type ?? '—';

/**
 * How the programme is delivered. Mirrors DELIVERY_MODES.
 *
 * `offline` reads as "In person" for a person: the wire value describes the
 * absence of the internet, which is not what a learner is choosing between.
 */
export const DELIVERY_MODES = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  HYBRID: 'hybrid',
  SELF_PACED: 'self_paced',
});

export const DELIVERY_MODE_VALUES = Object.freeze(Object.values(DELIVERY_MODES));

export const DELIVERY_MODE_LABELS = Object.freeze({
  [DELIVERY_MODES.ONLINE]: 'Online',
  [DELIVERY_MODES.OFFLINE]: 'In person',
  [DELIVERY_MODES.HYBRID]: 'Hybrid',
  [DELIVERY_MODES.SELF_PACED]: 'Self-paced',
});

export const DELIVERY_MODE_ORDER = Object.freeze([
  DELIVERY_MODES.ONLINE,
  DELIVERY_MODES.SELF_PACED,
  DELIVERY_MODES.HYBRID,
  DELIVERY_MODES.OFFLINE,
]);

export const deliveryModeLabel = (mode) => DELIVERY_MODE_LABELS[mode] ?? mode ?? '—';

/** Mirrors PROGRAM_LEVELS. Easiest first, because that is how a beginner reads it. */
export const PROGRAM_LEVELS = Object.freeze({
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
});

export const PROGRAM_LEVEL_VALUES = Object.freeze(Object.values(PROGRAM_LEVELS));

export const PROGRAM_LEVEL_LABELS = Object.freeze({
  [PROGRAM_LEVELS.BEGINNER]: 'Beginner',
  [PROGRAM_LEVELS.INTERMEDIATE]: 'Intermediate',
  [PROGRAM_LEVELS.ADVANCED]: 'Advanced',
});

export const PROGRAM_LEVEL_ORDER = Object.freeze([
  PROGRAM_LEVELS.BEGINNER,
  PROGRAM_LEVELS.INTERMEDIATE,
  PROGRAM_LEVELS.ADVANCED,
]);

export const programLevelLabel = (level) => PROGRAM_LEVEL_LABELS[level] ?? level ?? '—';

/**
 * The publisher's lifecycle. Mirrors LEARNING_PROGRAM_STATUSES.
 *
 * Distinct from PROGRAM_AVAILABILITY below, and the difference is the same one
 * opportunities draw: status is what the publisher decided, availability is what
 * a learner can act on. A published programme whose end date has passed is
 * `status: 'published'` and `availability: 'ended'` at the same time, so one set
 * of labels could not honestly describe both.
 */
export const LEARNING_PROGRAM_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

export const LEARNING_PROGRAM_STATUS_VALUES = Object.freeze(
  Object.values(LEARNING_PROGRAM_STATUSES),
);

export const LEARNING_PROGRAM_STATUS_LABELS = Object.freeze({
  [LEARNING_PROGRAM_STATUSES.DRAFT]: 'Draft',
  [LEARNING_PROGRAM_STATUSES.PUBLISHED]: 'Published',
  [LEARNING_PROGRAM_STATUSES.ARCHIVED]: 'Archived',
});

export const programStatusLabel = (status) =>
  LEARNING_PROGRAM_STATUS_LABELS[status] ?? status ?? '—';

/** Mirrors CREATABLE_LEARNING_PROGRAM_STATUSES — `archived` is not a way to start. */
export const CREATABLE_LEARNING_PROGRAM_STATUSES = Object.freeze([
  LEARNING_PROGRAM_STATUSES.DRAFT,
  LEARNING_PROGRAM_STATUSES.PUBLISHED,
]);

/**
 * Mirrors the server's LEARNING_PROGRAM_STATUS_TRANSITIONS: `from -> [to]`.
 *
 * The management UI reads this rather than hardcoding its buttons, so a button
 * the server would refuse cannot appear. `published -> draft` is absent for the
 * reason recorded on the server copy: learners have already seen it, and one may
 * be enrolled, so unpublishing would make their programme vanish. Archiving is
 * the honest way to retire it, and it is reversible.
 */
export const LEARNING_PROGRAM_STATUS_TRANSITIONS = Object.freeze({
  [LEARNING_PROGRAM_STATUSES.DRAFT]: Object.freeze([LEARNING_PROGRAM_STATUSES.PUBLISHED]),
  [LEARNING_PROGRAM_STATUSES.PUBLISHED]: Object.freeze([LEARNING_PROGRAM_STATUSES.ARCHIVED]),
  [LEARNING_PROGRAM_STATUSES.ARCHIVED]: Object.freeze([LEARNING_PROGRAM_STATUSES.PUBLISHED]),
});

export const nextProgramStatusesFor = (status) =>
  LEARNING_PROGRAM_STATUS_TRANSITIONS[status] ?? [];

/**
 * The status buttons to offer for a programme in `status`, already labelled.
 *
 * The label depends on where you are coming from, not only where you are going:
 * draft -> published is "Publish" (nobody has seen it), archived -> published is
 * "Restore" (they have). Same request, different promise to the publisher.
 */
export const programStatusActionsFor = (status) =>
  nextProgramStatusesFor(status).map((to) => {
    if (to === LEARNING_PROGRAM_STATUSES.PUBLISHED) {
      return status === LEARNING_PROGRAM_STATUSES.DRAFT
        ? { to, label: 'Publish', variant: 'primary' }
        : { to, label: 'Restore', variant: 'secondary' };
    }

    return { to, label: 'Archive', variant: 'secondary' };
  });

/**
 * Derived availability, mirroring the server's PROGRAM_AVAILABILITY.
 *
 * The API sends this on every programme it returns, so the UI displays it rather
 * than computing it. `programAvailabilityFor` below exists for the one case where
 * the UI legitimately needs its own answer: previewing an unsaved form.
 */
export const PROGRAM_AVAILABILITY = Object.freeze({
  DRAFT: 'draft',
  OPEN: 'open',
  ENDED: 'ended',
  ARCHIVED: 'archived',
});

export const PROGRAM_AVAILABILITY_VALUES = Object.freeze(Object.values(PROGRAM_AVAILABILITY));

/**
 * How each availability state is presented.
 *
 * `variant` names a Badge variant from components/ui/Badge.jsx — no new colour
 * system, and never colour alone: the label always renders beside the dot, per
 * DESIGN.md section 40.
 */
export const PROGRAM_AVAILABILITY_BADGE = Object.freeze({
  [PROGRAM_AVAILABILITY.OPEN]: { label: 'Open for enrolment', variant: 'success' },
  [PROGRAM_AVAILABILITY.ENDED]: { label: 'Ended', variant: 'warning' },
  [PROGRAM_AVAILABILITY.ARCHIVED]: { label: 'Archived', variant: 'neutral' },
  [PROGRAM_AVAILABILITY.DRAFT]: { label: 'Draft', variant: 'outline' },
});

export const programAvailabilityBadge = (availability) =>
  PROGRAM_AVAILABILITY_BADGE[availability] ??
  PROGRAM_AVAILABILITY_BADGE[PROGRAM_AVAILABILITY.ARCHIVED];

/**
 * Resolves availability from a status and an end date.
 *
 * Deliberately identical in behaviour to the server's `programAvailabilityFor`,
 * including the part that differs from `availabilityFor` in constants/
 * opportunities.js: a MISSING end date means evergreen, not unreadable. A
 * self-paced course does not end, so null reads as OPEN; a present but
 * unreadable end date still fails closed to ENDED.
 *
 * The server is the source of truth for every stored programme; this is for the
 * publisher form's preview, where nothing has been saved yet.
 */
export const programAvailabilityFor = ({ status, endDate } = {}, now = new Date()) => {
  if (status === LEARNING_PROGRAM_STATUSES.DRAFT) return PROGRAM_AVAILABILITY.DRAFT;
  if (status === LEARNING_PROGRAM_STATUSES.ARCHIVED) return PROGRAM_AVAILABILITY.ARCHIVED;

  if (endDate === null || endDate === undefined || endDate === '') {
    return PROGRAM_AVAILABILITY.OPEN;
  }

  const endTime = endDate instanceof Date ? endDate.getTime() : new Date(endDate).getTime();
  if (!Number.isFinite(endTime)) return PROGRAM_AVAILABILITY.ENDED;

  return endTime >= now.getTime() ? PROGRAM_AVAILABILITY.OPEN : PROGRAM_AVAILABILITY.ENDED;
};

/**
 * True only when someone could enrol in this today.
 *
 * Reads the `availability` the API already sent when it is there, and falls back
 * to deriving it — so an unsaved form preview and a fetched programme answer the
 * same question the same way.
 */
export const isEnrollable = (program, now = new Date()) =>
  (program?.availability ?? programAvailabilityFor(program ?? {}, now)) ===
  PROGRAM_AVAILABILITY.OPEN;

/** Mirrors the server's ENROLLMENT_STATUSES. */
export const ENROLLMENT_STATUSES = Object.freeze({
  ENROLLED: 'enrolled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
});

export const ENROLLMENT_STATUS_VALUES = Object.freeze(Object.values(ENROLLMENT_STATUSES));

export const ENROLLMENT_STATUS_LABELS = Object.freeze({
  [ENROLLMENT_STATUSES.ENROLLED]: 'Enrolled',
  [ENROLLMENT_STATUSES.IN_PROGRESS]: 'In progress',
  [ENROLLMENT_STATUSES.COMPLETED]: 'Completed',
});

export const enrollmentStatusLabel = (status) =>
  ENROLLMENT_STATUS_LABELS[status] ?? status ?? '—';

/** The pipeline, in order. Doubles as the order of My Learning's tabs. */
export const ENROLLMENT_PIPELINE = Object.freeze([
  ENROLLMENT_STATUSES.ENROLLED,
  ENROLLMENT_STATUSES.IN_PROGRESS,
  ENROLLMENT_STATUSES.COMPLETED,
]);

export const TERMINAL_ENROLLMENT_STATUSES = Object.freeze([ENROLLMENT_STATUSES.COMPLETED]);

export const isTerminalEnrollmentStatus = (status) =>
  TERMINAL_ENROLLMENT_STATUSES.includes(status);

/**
 * How each enrolment state is presented, again as Badge variants with a label.
 *
 * `completed` is `success` and nothing else is: finishing is the only one of the
 * three that is an achievement. `enrolled` stays `outline` rather than a colour,
 * because "signed up and not started" is a neutral fact, not a warning.
 */
export const ENROLLMENT_STATUS_BADGE = Object.freeze({
  [ENROLLMENT_STATUSES.ENROLLED]: { label: 'Enrolled', variant: 'outline' },
  [ENROLLMENT_STATUSES.IN_PROGRESS]: { label: 'In progress', variant: 'primary' },
  [ENROLLMENT_STATUSES.COMPLETED]: { label: 'Completed', variant: 'success' },
});

export const enrollmentStatusBadge = (status) =>
  ENROLLMENT_STATUS_BADGE[status] ?? ENROLLMENT_STATUS_BADGE[ENROLLMENT_STATUSES.ENROLLED];

export const PROGRESS_MIN = 0;
export const PROGRESS_MAX = 100;

/** Completion means 100%, the same convention the server writes. */
export const PROGRESS_ON_COMPLETION = PROGRESS_MAX;

export const isValidProgress = (value) =>
  Number.isInteger(value) && value >= PROGRESS_MIN && value <= PROGRESS_MAX;

/** Keeps a slider or a number field inside the range the API accepts. */
export const clampProgress = (value) => {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return PROGRESS_MIN;
  return Math.min(Math.max(numeric, PROGRESS_MIN), PROGRESS_MAX);
};

/**
 * The status a progress figure implies on its own, or null when it implies
 * nothing. Mirrors the server, one direction only: progress pushes status
 * forward, status never pushes progress back.
 *
 * The UI needs this to promise the right thing on the button — reporting 100%
 * completes the enrolment, so the control has to say so before it is clicked.
 */
export const impliedStatusForProgress = (progress) => {
  if (!Number.isFinite(progress)) return null;
  if (progress >= PROGRESS_MAX) return ENROLLMENT_STATUSES.COMPLETED;
  if (progress > PROGRESS_MIN) return ENROLLMENT_STATUSES.IN_PROGRESS;
  return null;
};

/**
 * Mirrors the server's LEARNING_LIMITS, so the form warns before the API rejects.
 */
export const LEARNING_LIMITS = Object.freeze({
  titleMax: 150,
  descriptionMin: 30,
  descriptionMax: 5000,
  providerMax: 120,
  instructorMax: 120,
  maxSkills: 12,
  maxPrerequisites: 10,
  prerequisiteMax: 160,
  externalUrlMax: 500,
  durationHoursMin: 1,
  durationHoursMax: 2000,
  dateMaxYearsAhead: 10,
});

/** Mirrors LEARNING_PAGE, so the client asks for a legal page size. */
export const LEARNING_PAGE = Object.freeze({
  defaultLimit: 10,
  maxLimit: 50,
});

/**
 * How each priority band is shown on a recommendation.
 *
 * The band itself is the server's decision — `priorityBand` in
 * services/recommendation.service.js — and these are deliberately the same three
 * words components/student/RecommendedLearning.jsx already uses for the same
 * bands, so the readiness page's skill list and the hub's programme strip cannot
 * label the same urgency differently.
 */
export const PRIORITY_BADGE = Object.freeze({
  high: { label: 'Do this first', variant: 'error' },
  medium: { label: 'Do this next', variant: 'warning' },
  low: { label: 'Later', variant: 'outline' },
});

export const priorityBadge = (priority) => PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.medium;

/** "40 hours", "1 hour", or null when there is nothing to say. */
export const durationLabel = (hours) => {
  const numeric = Number(hours);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return `${numeric} ${numeric === 1 ? 'hour' : 'hours'}`;
};

export const progressLabel = (value) => `${clampProgress(value)}%`;

/**
 * "25 Aug 2026", or null when there is no usable date.
 *
 * en-GB explicitly, for the reason formatDeadline gives: the demo reads the same
 * on every machine, and a date never renders in the ambiguous US month/day order
 * for an Indian audience.
 */
export const formatLearningDate = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * The one line a card shows about when a programme runs.
 *
 * Says "No fixed dates" rather than nothing when both are absent, because that is
 * true of a self-paced course and is information a learner wants.
 */
export const programWindowLabel = ({ startDate, endDate } = {}) => {
  const start = formatLearningDate(startDate);
  const end = formatLearningDate(endDate);

  if (start && end) return `${start} – ${end}`;
  if (start) return `Starts ${start}`;
  if (end) return `Runs until ${end}`;
  return 'No fixed dates';
};

export default LEARNING_PROGRAM_TYPES;
