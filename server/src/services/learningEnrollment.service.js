/**
 * Enrolment business logic — the learner's side of Step 8.
 *
 * OWNERSHIP IS STRUCTURAL. Every read and write in this file is scoped by a
 * `learnerId` the caller obtained from `req.user.id`, which `authenticate` set from a
 * verified token. No function accepts a learner id from a request body, and the
 * validator rejects one by name if a client sends it, so "student B updates student A's
 * enrolment" is not a check that could be forgotten — it is a request that cannot be
 * expressed. That is the brief's "do not allow a student to modify another student's
 * enrollment", enforced by shape rather than by vigilance.
 *
 * THIS FILE NEVER WRITES A SKILL SCORE, AND THAT IS THE POINT. It imports no profile
 * model and no assessment service. Completing a programme records that it was completed
 * and when; the number in a student's skill profile moves only when
 * `applySkillScoresToProfile` runs off a real submitted assessment, which remains the
 * only writer of a measured level anywhere in the codebase. The completion response
 * carries `nextAction: 'reassess'` precisely because the improvement has to be
 * demonstrated rather than granted.
 *
 * PROGRESS IS MONOTONIC AND THAT RULE LIVES HERE. Enforcing it in a schema hook would
 * need the previous value, which a pre-validate hook does not reliably have; this
 * module compares against the loaded document. The model's hooks enforce the invariants
 * expressible from a single document — completed implies 100%, timestamps agree with
 * the status — so a row cannot be written incoherent from any direction.
 */

import AppError from '../utils/AppError.js';
import LearningEnrollment from '../models/LearningEnrollment.js';
import {
  ENROLLMENT_STATUSES,
  ENROLLMENT_STATUS_TRANSITIONS,
  LEARNING_PAGE,
  PROGRESS_ON_COMPLETION,
  canTransitionEnrollment,
  enrollmentStatusLabel,
  impliedStatusForProgress,
  isLearnerRole,
  isTerminalEnrollmentStatus,
  laterEnrollmentStatus,
} from '../constants/learning.js';
import { requireEnrollableProgram } from './learning.service.js';

/**
 * The programme is populated on every enrolment read: My Learning renders a title, a
 * provider and the skills a completed course says to go and reassess, and a second
 * request per row to fetch them would be absurd.
 */
const POPULATE_REFS = [
  {
    path: 'programId',
    select: 'title provider type level deliveryMode durationHours endDate status targetSkills',
    populate: { path: 'targetSkills', select: 'name slug' },
  },
];

/** Clamps page/limit into a sane window, exactly as the programme list does. */
const resolvePaging = ({ page, limit } = {}) => {
  const resolvedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const requested = Number.parseInt(limit, 10) || LEARNING_PAGE.defaultLimit;
  const resolvedLimit = Math.min(Math.max(1, requested), LEARNING_PAGE.maxLimit);

  return { page: resolvedPage, limit: resolvedLimit, skip: (resolvedPage - 1) * resolvedLimit };
};

/** Re-reads with the programme populated — save() leaves the ref bare. */
const reload = (id) => LearningEnrollment.findById(id).populate(POPULATE_REFS);

/**
 * The skills a just-completed programme says to go and reassess.
 *
 * THE SENTENCE THIS FEATURE EXISTS FOR: "you finished AWS Cloud Fundamentals — retake
 * the AWS assessment to show it". Read off the programme's `targetSkills`, which are
 * catalogue references, so the client can link straight into the existing assessment
 * flow by skill id rather than matching on names.
 */
const skillsToReassess = (program) => {
  const skills = program?.targetSkills ?? [];

  return skills
    .map((skill) =>
      skill && typeof skill === 'object' && skill._id
        ? { skillId: skill._id.toString(), name: skill.name, slug: skill.slug }
        : { skillId: String(skill) },
    )
    .filter((skill) => skill.skillId);
};

/**
 * POST /learning/enrollments
 *
 * TWO LAYERS STOP A DUPLICATE, exactly as the brief requires, and they are not
 * redundant. This lookup gives a learner who clicks twice a sentence instead of a stack
 * trace; the unique index on `{learnerId, programId}` is what makes the rule true, since
 * two requests 40ms apart can both pass a service-level check and cannot both pass an
 * index. `errorMiddleware` already maps E11000 to 409, so the racing request gets the
 * same status as the polite one with no try/catch here.
 */
export const enroll = async (learner, programId, now = new Date()) => {
  if (!isLearnerRole(learner?.role)) {
    throw AppError.forbidden('Only students and academicians can enroll in a learning program.');
  }

  const program = await requireEnrollableProgram(programId, now);

  const existing = await LearningEnrollment.findOne({
    learnerId: learner.id,
    programId: program._id,
  }).populate(POPULATE_REFS);

  if (existing) {
    throw AppError.conflict('You are already enrolled in this program.', [
      {
        field: 'programId',
        message: `This program is already in your learning list as ${enrollmentStatusLabel(
          existing.status,
        ).toLowerCase()}.`,
      },
    ]);
  }

  const enrollment = new LearningEnrollment({
    learnerId: learner.id,
    programId: program._id,
    learnerRole: learner.role,
  });

  await enrollment.save();

  return (await reload(enrollment._id)).toLearnerView();
};

/**
 * Loads one of the caller's own enrolments, or throws.
 *
 * SCOPED BY LEARNER IN THE QUERY, so the safe path never depends on a comparison
 * further down — and 404 rather than 403 for someone else's row, which is the opposite
 * of `requireOwnProgram`'s split. The difference is deliberate: a published programme's
 * existence is public, a person's enrolment is not, so "wrong owner" and "no such row"
 * must be indistinguishable. Telling a stranger that enrolment `abc` exists is itself
 * private student information.
 */
const requireOwnEnrollment = async (learnerId, id) => {
  const enrollment = await LearningEnrollment.findOne({ _id: id, learnerId }).populate(
    POPULATE_REFS,
  );

  if (!enrollment) {
    throw AppError.notFound('That enrollment could not be found.');
  }

  return enrollment;
};

/**
 * The response shape for a read or a write of one enrolment.
 *
 * `nextAction: 'reassess'` IS ATTACHED WHENEVER THE ROW IS COMPLETE, not only on the
 * call that completed it, so a page reloaded after a completion still shows the prompt.
 * `justCompleted` is what tells the client to *celebrate* — one is state, the other is
 * an event, and conflating them makes a refresh either lose the prompt or re-fire the
 * confetti.
 *
 * THE PROMPT IS THE INTEGRATION. It carries skill ids into the existing assessment
 * flow and nothing else: no score is granted, nothing is written to a profile. The
 * improvement has to be measured, and this is the sentence that asks for it.
 */
const toEnrollmentResult = (doc, { justCompleted = false } = {}) => {
  const complete = isTerminalEnrollmentStatus(doc.status);

  return {
    enrollment: doc.toLearnerView(),
    justCompleted,
    nextAction: complete ? 'reassess' : null,
    skillsToReassess: complete ? skillsToReassess(doc.programId) : [],
  };
};

/**
 * PATCH /learning/enrollments/:id — `{ progress }`, `{ status }`, or both.
 *
 * FOUR RULES, IN THIS ORDER, and the order is what makes the messages accurate:
 *
 *   1. A request asking for exactly what is stored is a no-op, not an error. A
 *      double-tapped button and a re-run of the demo seed must both be safe, and 400
 *      "already complete" for a request that changes nothing would break both.
 *   2. Completion is terminal. Evidence that can be withdrawn is not evidence, so a
 *      finished programme cannot be reopened, un-completed or wound back.
 *   3. Progress never decreases. A slider that jumped backwards is a client bug; a
 *      learner who wants to redo a course has already finished it, which rule 2 covers.
 *   4. Only the transitions in ENROLLMENT_STATUS_TRANSITIONS are legal, so `completed ->
 *      enrolled` is refused with the table's own answer rather than a hardcoded list.
 */
export const updateEnrollment = async (learnerId, id, body = {}, now = new Date()) => {
  const enrollment = await requireOwnEnrollment(learnerId, id);

  const currentStatus = enrollment.status;
  const currentProgress = enrollment.progress;

  const requestedProgress = 'progress' in body ? Number(body.progress) : null;
  const requestedStatus = 'status' in body ? body.status : null;

  const progressUnchanged = requestedProgress === null || requestedProgress === currentProgress;
  const statusUnchanged = requestedStatus === null || requestedStatus === currentStatus;

  if (progressUnchanged && statusUnchanged) {
    return toEnrollmentResult(enrollment);
  }

  if (isTerminalEnrollmentStatus(currentStatus)) {
    throw AppError.badRequest('This program is already marked as complete.', [
      {
        field: 'status',
        message:
          'A completed program cannot be changed. Retake the assessment to record the improvement it earned you.',
      },
    ]);
  }

  if (requestedProgress !== null && requestedProgress < currentProgress) {
    throw AppError.badRequest('Progress cannot go backwards.', [
      {
        field: 'progress',
        message: `This program is already recorded at ${currentProgress}%.`,
      },
    ]);
  }

  if (requestedStatus !== null && !canTransitionEnrollment(currentStatus, requestedStatus)) {
    const allowed = ENROLLMENT_STATUS_TRANSITIONS[currentStatus] ?? [];

    throw AppError.badRequest('That status change is not allowed.', [
      {
        field: 'status',
        message: allowed.length
          ? `An enrollment that is ${enrollmentStatusLabel(
              currentStatus,
            ).toLowerCase()} can only become ${allowed
              .map((status) => enrollmentStatusLabel(status).toLowerCase())
              .join(' or ')}.`
          : `An enrollment that is ${enrollmentStatusLabel(
              currentStatus,
            ).toLowerCase()} cannot change status.`,
      },
    ]);
  }

  /**
   * The derivation. ONE DIRECTION ONLY: progress pushes the status forward, the status
   * never pushes progress back.
   *
   * `laterEnrollmentStatus` is why `{progress: 100, status: 'in_progress'}` from a
   * confused client resolves to completed rather than storing a full bar that claims to
   * be unfinished. The reverse — `{status: 'completed'}` alone — sets progress to 100,
   * because "I finished it" and "I am 60% through" cannot both be true and the model's
   * `coherentProgress` hook refuses the pair outright.
   */
  let nextStatus = requestedStatus ?? currentStatus;

  if (requestedProgress !== null) {
    const implied = impliedStatusForProgress(requestedProgress);
    if (implied) nextStatus = laterEnrollmentStatus(nextStatus, implied);
  }

  const nextProgress =
    nextStatus === ENROLLMENT_STATUSES.COMPLETED
      ? PROGRESS_ON_COMPLETION
      : requestedProgress ?? currentProgress;

  enrollment.status = nextStatus;
  enrollment.progress = nextProgress;

  /**
   * `startedAt` is stamped the first time an enrolment leaves `enrolled` and never
   * rewritten, so the gap between enrolling and starting stays readable. `completedAt`
   * likewise: it is the date the reassessment prompt quotes back.
   */
  if (nextStatus !== ENROLLMENT_STATUSES.ENROLLED && !enrollment.startedAt) {
    enrollment.startedAt = now;
  }

  if (nextStatus === ENROLLMENT_STATUSES.COMPLETED && !enrollment.completedAt) {
    enrollment.completedAt = now;
  }

  await enrollment.save();

  const fresh = await reload(enrollment._id);

  return toEnrollmentResult(fresh, {
    justCompleted:
      nextStatus === ENROLLMENT_STATUSES.COMPLETED &&
      currentStatus !== ENROLLMENT_STATUSES.COMPLETED,
  });
};

/** GET /learning/enrollments/:id — one of the caller's own rows. */
export const getEnrollment = async (learnerId, id) => {
  const enrollment = await requireOwnEnrollment(learnerId, id);

  return toEnrollmentResult(enrollment);
};

/**
 * The four numbers the My Learning header and the dashboard card both show.
 *
 * `continueWith` is the most recently touched unfinished enrolment — the one the
 * "continue where you left off" prompt points at. It is resolved by the DATABASE rather
 * than by the client picking the first row of a page, because the first row of page one
 * is the newest enrolment, which is not the same thing as the one being worked on.
 */
const summariseMine = async (learnerId) => {
  const base = { learnerId };

  const [total, enrolled, inProgress, completed, latest] = await Promise.all([
    LearningEnrollment.countDocuments(base),
    LearningEnrollment.countDocuments({ ...base, status: ENROLLMENT_STATUSES.ENROLLED }),
    LearningEnrollment.countDocuments({ ...base, status: ENROLLMENT_STATUSES.IN_PROGRESS }),
    LearningEnrollment.countDocuments({ ...base, status: ENROLLMENT_STATUSES.COMPLETED }),
    LearningEnrollment.findOne({ ...base, status: { $ne: ENROLLMENT_STATUSES.COMPLETED } })
      .sort({ updatedAt: -1 })
      .populate(POPULATE_REFS),
  ]);

  return {
    total,
    enrolled,
    inProgress,
    completed,
    active: enrolled + inProgress,
    continueWith: latest ? latest.toLearnerView() : null,
  };
};

/**
 * GET /learning/enrollments — My Learning.
 *
 * Newest first, which is what the `{learnerId, enrolledAt: -1}` index exists for. The
 * optional `status` filter is what the page's three tabs send.
 *
 * The summary is computed by the DATABASE over every row, not by counting the current
 * page: a learner on page two must not see "2 programmes" as their total.
 */
export const listMyEnrollments = async (learnerId, query = {}) => {
  const { page, limit, skip } = resolvePaging(query);

  const filter = { learnerId };
  if (query.status) filter.status = query.status;

  const [docs, total, summary] = await Promise.all([
    LearningEnrollment.find(filter)
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(POPULATE_REFS),
    LearningEnrollment.countDocuments(filter),
    summariseMine(learnerId),
  ]);

  return {
    enrollments: docs.map((doc) => doc.toLearnerView()),
    total,
    page,
    limit,
    summary,
  };
};

/**
 * "Which of these programmes is this learner already on?" — one query for a whole page.
 *
 * THE HUB AND THE RECOMMENDATION SERVICE BOTH NEED THIS, which is exactly why it is
 * defined once here. A card that offers "Enrol" for a course the learner is already
 * halfway through is the most obvious possible bug in this feature, and the alternative
 * to this helper is each caller writing its own lookup and one of them drifting.
 *
 * A LIGHT PROJECTION ON PURPOSE: the badge on a card needs a status, a percentage and an
 * id to link to. It does not need the populated programme, which the caller is already
 * holding — that is the row the badge is being attached to.
 */
export const enrollmentsByProgramFor = async (learnerId, programIds = []) => {
  const ids = (Array.isArray(programIds) ? programIds : [programIds])
    .map((id) => (id && typeof id === 'object' && id._id ? id._id : id))
    .filter(Boolean)
    .map(String);

  if (!learnerId || ids.length === 0) return new Map();

  const docs = await LearningEnrollment.find({
    learnerId,
    programId: { $in: ids },
  }).select('programId status progress enrolledAt completedAt');

  return new Map(
    docs.map((doc) => [
      doc.programId.toString(),
      {
        id: doc._id.toString(),
        status: doc.status,
        progress: doc.progress,
        isComplete: isTerminalEnrollmentStatus(doc.status),
        enrolledAt: doc.enrolledAt,
        completedAt: doc.completedAt,
      },
    ]),
  );
};

/**
 * The caller's own enrolment on one programme, or null.
 *
 * What the details page uses to decide between an "Enrol" button and a progress control,
 * so it returns the FULL learner view rather than the badge projection above: that page
 * renders the dates and the reassessment prompt, not just a percentage.
 *
 * Null rather than a throw, because "not enrolled" is the ordinary state of almost every
 * programme a learner opens.
 */
export const myEnrollmentForProgram = async (learnerId, programId) => {
  if (!learnerId || !programId) return null;

  const enrollment = await LearningEnrollment.findOne({ learnerId, programId }).populate(
    POPULATE_REFS,
  );

  return enrollment ? toEnrollmentResult(enrollment) : null;
};

/** GET /learning/enrollments/summary — the dashboard card, without a page of rows. */
export const getMyLearningSummary = (learnerId) => summariseMine(learnerId);

export default {
  enroll,
  updateEnrollment,
  getEnrollment,
  listMyEnrollments,
  getMyLearningSummary,
  enrollmentsByProgramFor,
  myEnrollmentForProgram,
};

