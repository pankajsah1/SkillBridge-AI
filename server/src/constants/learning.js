/**
 * Learning vocabulary — a programme's type, level, delivery mode and lifecycle,
 * and an enrolment's lifecycle, defined once.
 *
 * WHY A SECOND CONSTANTS FILE RATHER THAN MORE OF `opportunities.js`. Step 7
 * folded eight academician-facing types into the Opportunity enum on the grounds
 * that a Faculty Development Programme *is* that schema, field for field. A
 * course is not. Nobody applies to a course and waits to be shortlisted: there
 * are no openings to compete for, no cover note, no match-score snapshot, no
 * recruiter on the other end, and the end state is "I finished it" rather than
 * "I was chosen". `opportunities.js` says as much itself — "the Learning Program
 * collection remains available for its own purpose if a later step builds it".
 * This is that purpose.
 *
 * WHERE THE LINE IS DRAWN, so nothing is built twice:
 *
 *   Opportunity      internships, jobs, apprenticeships, live projects, and the
 *                    eight academician-facing kinds. You APPLY, and someone else
 *                    decides what happens next.
 *   LearningProgram  courses, certifications, workshops, training, mentorship.
 *                    You ENROL, and then the progress is yours to make.
 *
 * `workshop` and `mentorship` appear in both enums, deliberately. A workshop an
 * industry partner runs *for faculty* is a posting with a deadline and a
 * shortlist; a workshop a student takes to close a Docker gap is something they
 * enrol in and progress through. Same word, different object — which is the
 * distinction `opportunities.js` drew itself when it reserved these values.
 *
 * VALUES ARE LOWERCASE SNAKE_CASE, like every enum in this project except
 * `ROLES`. The level vocabulary additionally matches the three words the shipped
 * recommendation service already synthesises — beginner, intermediate, advanced —
 * so a real programme and a synthesised one render identically in the UI that
 * already exists for them.
 */

import { ROLES } from './roles.js';

/**
 * What kind of learning this is.
 *
 * Exactly the five the Step 8 brief names and no more: a sixth value nothing
 * seeds is a filter option that always returns an empty list.
 */
export const LEARNING_PROGRAM_TYPES = Object.freeze({
  COURSE: 'course',
  CERTIFICATION: 'certification',
  WORKSHOP: 'workshop',
  TRAINING: 'training',
  MENTORSHIP: 'mentorship',
});

export const LEARNING_PROGRAM_TYPE_VALUES = Object.freeze(Object.values(LEARNING_PROGRAM_TYPES));
/**
 * Server-side labels, because error messages use them ("a mentorship cannot
 * state a duration in hours"). The client keeps its own copy for rendering — the
 * same split every other constants pair in this project uses.
 */
export const LEARNING_PROGRAM_TYPE_LABELS = Object.freeze({
  [LEARNING_PROGRAM_TYPES.COURSE]: 'Course',
  [LEARNING_PROGRAM_TYPES.CERTIFICATION]: 'Certification',
  [LEARNING_PROGRAM_TYPES.WORKSHOP]: 'Workshop',
  [LEARNING_PROGRAM_TYPES.TRAINING]: 'Training',
  [LEARNING_PROGRAM_TYPES.MENTORSHIP]: 'Mentorship',
});

export const programTypeLabel = (type) => LEARNING_PROGRAM_TYPE_LABELS[type] ?? type;

/**
 * How the learning is delivered.
 *
 * NOT `WORK_MODES`. An opportunity's remote/onsite/hybrid describes where you
 * work; these describe how a programme is taught, and the fourth value is the
 * one that matters most for a student fitting study around lectures:
 * `self_paced` has no schedule at all, which `remote` does not say.
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

export const deliveryModeLabel = (mode) => DELIVERY_MODE_LABELS[mode] ?? mode;
/**
 * How advanced a programme is.
 *
 * THREE VALUES, NOT THE FIVE IN `constants/skills.js`. A skill score is measured,
 * so it earns five bands; a course is authored, and no provider writes different
 * material for "basic" and "intermediate". More importantly these three words are
 * the ones `recommendation.service.js` already puts on a synthesised programme,
 * and the client's `RecommendedLearning` renders `item.level` verbatim. A fourth
 * value here would render as an unfamiliar word next to a familiar one.
 */
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

export const programLevelLabel = (level) => PROGRAM_LEVEL_LABELS[level] ?? level;

/**
 * Ordered weakest-first, so "is this one step up or two?" is subtraction rather
 * than a table of special cases.
 */
export const PROGRAM_LEVEL_ORDER = Object.freeze([
  PROGRAM_LEVELS.BEGINNER,
  PROGRAM_LEVELS.INTERMEDIATE,
  PROGRAM_LEVELS.ADVANCED,
]);

/**
 * The 0-100 window each level is aimed at.
 *
 * THE BREAK POINTS ARE COPIED FROM THE SHIPPED `programmeFor`, not re-derived.
 * That function sends a student below 40 to "Fundamentals", below 70 to "in
 * Practice", and above that to "Advanced". 40 is the BASIC floor in
 * `constants/skills.js`; 70 is not a band edge there (ADVANCED starts at 75), so
 * this is not the tidy mapping onto proficiency bands it might look like. It is
 * repeated exactly anyway, because a real programme and a synthesised one appear
 * in the same list and disagreeing about who "intermediate" is for would be worse
 * than an untidy number. Changing `programmeFor` is out of scope for Step 8.
 */
export const PROGRAM_LEVEL_BANDS = Object.freeze({
  [PROGRAM_LEVELS.BEGINNER]: Object.freeze({ from: 0, to: 40 }),
  [PROGRAM_LEVELS.INTERMEDIATE]: Object.freeze({ from: 40, to: 70 }),
  [PROGRAM_LEVELS.ADVANCED]: Object.freeze({ from: 70, to: 100 }),
});
/**
 * The level that fits a learner sitting at `studentLevel` right now.
 *
 * @param {number} studentLevel 0-100.
 * @returns {'beginner'|'intermediate'|'advanced'}
 */
export const programLevelForScore = (studentLevel = 0) => {
  const score = Number(studentLevel);
  if (!Number.isFinite(score) || score < PROGRAM_LEVEL_BANDS[PROGRAM_LEVELS.INTERMEDIATE].from) {
    return PROGRAM_LEVELS.BEGINNER;
  }
  return score < PROGRAM_LEVEL_BANDS[PROGRAM_LEVELS.ADVANCED].from
    ? PROGRAM_LEVELS.INTERMEDIATE
    : PROGRAM_LEVELS.ADVANCED;
};

/**
 * How badly a programme's level misses the learner: 0 when it is the fitting
 * level, 1 when it is one step off, 2 when it is two.
 *
 * WHY THIS IS A DISTANCE AND NOT A FILTER. An advanced course is not useless to a
 * beginner, it is just the wrong thing to start with, and a portal that hid it
 * would be hiding the only Kubernetes material it has. So mismatch demotes rather
 * than excludes — it is the third sort key in `learningRecommendation.service.js`,
 * after priority and coverage.
 *
 * @param {string} programLevel
 * @param {number} studentLevel 0-100.
 * @returns {number} 0, 1 or 2.
 */
export const levelFitDistance = (programLevel, studentLevel = 0) => {
  const wanted = PROGRAM_LEVEL_ORDER.indexOf(programLevelForScore(studentLevel));
  const offered = PROGRAM_LEVEL_ORDER.indexOf(programLevel);
  if (offered < 0) return PROGRAM_LEVEL_ORDER.length;
  return Math.abs(offered - wanted);
};

/**
 * Programme lifecycle.
 *
 * A STATUS ENUM, NOT THE `isPublished` / `isActive` PAIR THE BRIEF SKETCHES. Two
 * booleans have four combinations and only three of them mean anything — nothing
 * says what `isPublished: true, isActive: false` is, and every reader has to
 * invent an answer. This project already made the choice once, in
 * `OPPORTUNITY_STATUSES`, and its draft/active/closed ladder is the same ladder
 * with different words. One field, three values, an explicit transition table.
 */
export const LEARNING_PROGRAM_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

export const LEARNING_PROGRAM_STATUS_VALUES = Object.freeze(
  Object.values(LEARNING_PROGRAM_STATUSES),
);
/**
 * Same reasoning as `DEFAULT_OPPORTUNITY_STATUS`: someone who filled in the whole
 * form meant to publish. A draft is the deliberate case.
 */
export const DEFAULT_LEARNING_PROGRAM_STATUS = LEARNING_PROGRAM_STATUSES.PUBLISHED;

/** Archiving something that was never published is meaningless — DELETE it. */
export const CREATABLE_LEARNING_PROGRAM_STATUSES = Object.freeze([
  LEARNING_PROGRAM_STATUSES.DRAFT,
  LEARNING_PROGRAM_STATUSES.PUBLISHED,
]);

/**
 * `from -> [to]`, mirroring the opportunity ladder edge for edge:
 *
 *   draft     -> published   publish it
 *   published -> archived    stop taking enrolments
 *   archived  -> published   bring it back (the service additionally refuses if
 *                            the end date has passed, exactly as reopening a
 *                            closed opportunity requires a future deadline —
 *                            un-archiving a finished programme would advertise
 *                            enrolment in something already over)
 *
 * Absent on purpose: `published -> draft`, which would make a programme students
 * are part-way through silently vanish. Archiving says the same thing honestly and
 * leaves their enrolments readable.
 */
export const LEARNING_PROGRAM_STATUS_TRANSITIONS = Object.freeze({
  [LEARNING_PROGRAM_STATUSES.DRAFT]: Object.freeze([LEARNING_PROGRAM_STATUSES.PUBLISHED]),
  [LEARNING_PROGRAM_STATUSES.PUBLISHED]: Object.freeze([LEARNING_PROGRAM_STATUSES.ARCHIVED]),
  [LEARNING_PROGRAM_STATUSES.ARCHIVED]: Object.freeze([LEARNING_PROGRAM_STATUSES.PUBLISHED]),
});

/** A no-op change is not a transition: PATCHing the status you have is fine. */
export const canTransitionProgram = (from, to) => {
  if (from === to) return true;
  return (LEARNING_PROGRAM_STATUS_TRANSITIONS[from] ?? []).includes(to);
};

/** The moves an owner may make from here, for the list page's buttons. */
export const nextProgramStatusesFor = (status) =>
  LEARNING_PROGRAM_STATUS_TRANSITIONS[status] ?? [];

/**
 * Derived availability — what a learner can actually do about this programme now.
 *
 * Same shape and same reason as the opportunity `availability` virtual: `status`
 * records the owner's decision, this answers "can I enrol today?", and the two
 * differ in exactly one case — a published programme whose end date has gone by.
 */
export const PROGRAM_AVAILABILITY = Object.freeze({
  DRAFT: 'draft',
  OPEN: 'open',
  ENDED: 'ended',
  ARCHIVED: 'archived',
});

export const PROGRAM_AVAILABILITY_VALUES = Object.freeze(Object.values(PROGRAM_AVAILABILITY));
/**
 * Resolves a programme's availability from its status and end date.
 *
 * Pure in both arguments — no `new Date()` unless the caller omits `now` — so a
 * test can ask what happens either side of an end date without waiting.
 *
 * A MISSING END DATE MEANS EVERGREEN, NOT UNREADABLE. This is the one place this
 * function deliberately parts company with `availabilityFor`: an opportunity's
 * deadline is required, so anything unparseable there is a broken document and
 * failing closed is right. Here `endDate` is optional by design — a self-paced
 * course does not end — so null must read as OPEN or every such programme would
 * be permanently unenrollable. A *present but unreadable* end date still fails
 * closed to ENDED, which keeps the broken-document case safe.
 *
 * @param {{status: string, endDate?: Date|string|number|null}} program
 * @param {Date} [now]
 * @returns {'draft'|'open'|'ended'|'archived'}
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

/** True only when someone could enrol in this today. */
export const isEnrollable = (program, now = new Date()) =>
  programAvailabilityFor(program, now) === PROGRAM_AVAILABILITY.OPEN;

/**
 * The roles that can hold an enrolment.
 *
 * DERIVED FROM `ROLES`, SO THIS IS NOT A NEW ROLE OR A NEW PERMISSION SYSTEM —
 * Step 8 forbids both. It is the same kind of subset `APPLICANT_ROLES` already is:
 * the roles that consume what others publish. Industry publishes programmes and
 * cannot enrol in its own, institution reads analytics, admin administers.
 *
 * WHY A SEPARATE LIST FROM `APPLICANT_ROLES` WHEN THE TWO VALUES MATCH TODAY. They
 * answer different questions — "who may apply to a posting?" versus "who may enrol
 * in a programme?" — and reusing the applicant list would make an enrolment field
 * read as though it were about applications. The values coinciding is a fact about
 * this moment, not a definition.
 *
 * RECOMMENDATIONS ARE NARROWER THAN THIS. They need a StudentProfile, a target
 * career role and measured skill levels, which only a student has, so
 * `learningRecommendation.service.js` is STUDENT-only. An academician can browse and
 * enrol; they simply get no personalised list, which is honest rather than a
 * fabricated one.
 */
export const LEARNER_ROLES = Object.freeze({
  STUDENT: ROLES.STUDENT,
  ACADEMICIAN: ROLES.ACADEMICIAN,
});

export const LEARNER_ROLE_VALUES = Object.freeze(Object.values(LEARNER_ROLES));

/** Every enrolment written so far belongs to a student; nothing predates the field. */
export const DEFAULT_LEARNER_ROLE = LEARNER_ROLES.STUDENT;

export const isLearnerRole = (role) => LEARNER_ROLE_VALUES.includes(role);

/**
 * Enrolment lifecycle — the three states the brief names, and no fourth.
 *
 * There is no `dropped` or `cancelled`. Nothing in Step 8 asks a learner to
 * abandon a programme, and an unused terminal state is a transition table entry
 * that no test covers and no UI can reach.
 */
export const ENROLLMENT_STATUSES = Object.freeze({
  ENROLLED: 'enrolled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
});

export const ENROLLMENT_STATUS_VALUES = Object.freeze(Object.values(ENROLLMENT_STATUSES));

/** Every enrolment starts here. Nothing else may be passed in on create. */
export const DEFAULT_ENROLLMENT_STATUS = ENROLLMENT_STATUSES.ENROLLED;
export const ENROLLMENT_STATUS_LABELS = Object.freeze({
  [ENROLLMENT_STATUSES.ENROLLED]: 'Enrolled',
  [ENROLLMENT_STATUSES.IN_PROGRESS]: 'In progress',
  [ENROLLMENT_STATUSES.COMPLETED]: 'Completed',
});

export const enrollmentStatusLabel = (status) =>
  ENROLLMENT_STATUS_LABELS[status] ?? ENROLLMENT_STATUS_LABELS[DEFAULT_ENROLLMENT_STATUS];

/** The order the UI draws as a timeline. A list, not object key order. */
export const ENROLLMENT_PIPELINE = Object.freeze([
  ENROLLMENT_STATUSES.ENROLLED,
  ENROLLMENT_STATUSES.IN_PROGRESS,
  ENROLLMENT_STATUSES.COMPLETED,
]);

/**
 * `completed` is terminal.
 *
 * WHY YOU CANNOT WALK BACK OUT OF IT. Completion is the evidence a reassessment
 * hangs off — "you finished AWS Cloud Fundamentals on 14 August, now retake the
 * assessment" — and evidence that can be withdrawn is not evidence. It also stops
 * the one abuse that would matter: completing, then reopening and re-completing to
 * make a dashboard count climb.
 */
export const TERMINAL_ENROLLMENT_STATUSES = Object.freeze([ENROLLMENT_STATUSES.COMPLETED]);

export const isTerminalEnrollmentStatus = (status) =>
  TERMINAL_ENROLLMENT_STATUSES.includes(status);

/**
 * Allowed enrolment moves.
 *
 * Forward-skipping is allowed — someone who did the whole course before touching
 * the portal should not have to click "in progress" first — but nothing goes
 * backwards, for the reason above.
 */
export const ENROLLMENT_STATUS_TRANSITIONS = Object.freeze({
  [ENROLLMENT_STATUSES.ENROLLED]: Object.freeze([
    ENROLLMENT_STATUSES.IN_PROGRESS,
    ENROLLMENT_STATUSES.COMPLETED,
  ]),
  [ENROLLMENT_STATUSES.IN_PROGRESS]: Object.freeze([ENROLLMENT_STATUSES.COMPLETED]),
  [ENROLLMENT_STATUSES.COMPLETED]: Object.freeze([]),
});

/** Same-state is a no-op rather than a 400, as everywhere else in this project. */
export const canTransitionEnrollment = (from, to) => {
  if (from === to) return true;
  return (ENROLLMENT_STATUS_TRANSITIONS[from] ?? []).includes(to);
};

export const nextEnrollmentStatusesFor = (status) =>
  ENROLLMENT_STATUS_TRANSITIONS[status] ?? [];
/** Percent complete. An integer — half a percent of a course is not a thing. */
export const PROGRESS_MIN = 0;
export const PROGRESS_MAX = 100;

/**
 * Completion means 100%.
 *
 * The brief asks for this "if that is the repo convention", and it is the same
 * convention as `Application.statusHistory`: the state and the numbers that
 * describe it are written together, never left to disagree. A `completed`
 * enrolment showing 60% would make every progress bar in My Learning a lie.
 */
export const PROGRESS_ON_COMPLETION = PROGRESS_MAX;

export const isValidProgress = (value) =>
  Number.isInteger(value) && value >= PROGRESS_MIN && value <= PROGRESS_MAX;

/**
 * The status a progress figure implies on its own, or null when it implies
 * nothing.
 *
 * ONE DIRECTION ONLY: progress pushes status forward, status never pushes
 * progress back. Reporting 35% on a fresh enrolment obviously means work has
 * started, so the status should not still read "enrolled" — the learner would
 * have to click a second button to state something they just demonstrated.
 * Reporting 0% on an `in_progress` enrolment, though, is a legitimate "I signed
 * up and opened it and have done nothing yet" and must not demote anything.
 *
 * Hitting 100 is completion. There is no separate "I did all of it but have not
 * finished" state, and inventing one to avoid this coupling would leave the
 * reassessment prompt with nothing to trigger on.
 *
 * @param {number} progress
 * @returns {'in_progress'|'completed'|null}
 */
export const impliedStatusForProgress = (progress) => {
  if (!Number.isFinite(progress)) return null;
  if (progress >= PROGRESS_MAX) return ENROLLMENT_STATUSES.COMPLETED;
  if (progress > PROGRESS_MIN) return ENROLLMENT_STATUSES.IN_PROGRESS;
  return null;
};

/** How far along the pipeline a status is. Used to take the later of two. */
export const enrollmentStage = (status) => {
  const index = ENROLLMENT_PIPELINE.indexOf(status);
  return index < 0 ? 0 : index;
};

/** The later of two statuses along the pipeline. Neither ever moves backwards. */
export const laterEnrollmentStatus = (a, b) => (enrollmentStage(b) > enrollmentStage(a) ? b : a);
/**
 * Field bounds, in one place so the model, the validator and the React form
 * cannot disagree.
 *
 * Chosen for the shape of real listings, the same way `OPPORTUNITY_LIMITS` was: a
 * title is a course name, a description holds an overview plus what is covered, a
 * skills list past a dozen entries has stopped describing one programme, and a
 * prerequisite is a phrase.
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
  /**
   * Hours, because it is the only unit that compares a six-hour workshop with a
   * twelve-week course. 2000 is about a year of full-time study — past that it is
   * a mistyped figure, and catching it here is kinder than storing it forever.
   */
  durationHoursMin: 1,
  durationHoursMax: 2000,
  /** Same reasoning as `deadlineMaxYearsAhead`: ten years out is a typo. */
  dateMaxYearsAhead: 10,
});

/** Pagination bounds for browse and the owner's list. */
export const LEARNING_PAGE = Object.freeze({
  defaultLimit: 10,
  maxLimit: 50,
});

export const isValidLearningProgramType = (value) => LEARNING_PROGRAM_TYPE_VALUES.includes(value);
export const isValidDeliveryMode = (value) => DELIVERY_MODE_VALUES.includes(value);
export const isValidProgramLevel = (value) => PROGRAM_LEVEL_VALUES.includes(value);
export const isValidLearningProgramStatus = (value) =>
  LEARNING_PROGRAM_STATUS_VALUES.includes(value);
export const isValidEnrollmentStatus = (value) => ENROLLMENT_STATUS_VALUES.includes(value);

export default LEARNING_PROGRAM_TYPES;

