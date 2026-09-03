/**
 * Learning controller — HTTP translation only.
 *
 * Same contract as opportunity.controller.js: read the request, delegate, format with the
 * Step 1 helpers. No business logic, no try/catch, and no role checks — `allowRoles()` in
 * the route owns those, so authorization is not duplicated here.
 *
 * EVERY OWNER AND EVERY LEARNER COMES FROM `req.user.id`. No handler in this file reads a
 * publisher, student or learner id from a body, a query string or a URL segment. That is
 * what makes "student B updates student A's enrolment" and "company B edits company A's
 * course" unexpressible rather than merely rejected — and the validators reject those
 * field names by name as a second layer, for a client that tries.
 *
 * Query parameters are destructured individually rather than forwarded as `req.query`, so
 * an unexpected parameter cannot reach a database filter.
 *
 * NOTHING HERE WRITES A SKILL SCORE. Completing a programme returns
 * `nextAction: 'reassess'` and the skills to go and retake, which is a prompt, not a
 * grade: the number in a student's profile moves only when a real assessment is submitted.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { buildPagination, sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { isLearnerRole } from '../constants/learning.js';
import {
  createLearningProgram,
  deleteLearningProgram,
  getProgramForViewer,
  listOwnedPrograms,
  listPublishedPrograms,
  updateLearningProgram,
} from '../services/learning.service.js';
import {
  enroll,
  enrollmentsByProgramFor,
  getEnrollment,
  getMyLearningSummary,
  listMyEnrollments,
  myEnrollmentForProgram,
  updateEnrollment,
} from '../services/learningEnrollment.service.js';
import { getLearningRecommendationsForStudent } from '../services/learningRecommendation.service.js';

/**
 * Attaches "am I on this one?" to a page of programme cards.
 *
 * ONE QUERY FOR THE WHOLE PAGE, not one per card. A hub that offered "Enrol" on a course
 * the learner is 60% through would be the most visible possible bug in this feature, and
 * the alternative to this is the client discovering it by fetching every row's enrolment.
 *
 * An INDUSTRY viewer gets `null` on every card because they cannot enrol at all — the
 * badge is absent rather than wrong.
 */
const withMyEnrollment = async (viewer, programs) => {
  if (!isLearnerRole(viewer?.role) || programs.length === 0) {
    return programs.map((program) => ({ ...program, enrollment: null }));
  }

  const mine = await enrollmentsByProgramFor(
    viewer.id,
    programs.map((program) => program.id),
  );

  return programs.map((program) => ({ ...program, enrollment: mine.get(program.id) ?? null }));
};

/**
 * GET /api/v1/learning/programs — the Learning Hub's catalogue.
 *
 * Published and not yet ended, decided by the service. `pagination` rides alongside
 * `data` as a sibling key, the envelope TRD.md section 46 defines.
 *
 * NOT ROLE-GATED. A student browses, an academician browses, and an industry publisher
 * looking at how their course sits next to the others browses the same list — the rows
 * are identical for all three, so a role check would add nothing but a second list of
 * roles to maintain.
 */
export const browseLearningPrograms = asyncHandler(async (req, res) => {
  const { type, level, deliveryMode, skills, search, page, limit } = req.query;

  const result = await listPublishedPrograms({
    type,
    level,
    deliveryMode,
    skills,
    search,
    page,
    limit,
  });

  return sendSuccess(res, {
    message: 'Learning programs retrieved successfully.',
    data: {
      programs: await withMyEnrollment(req.user, result.programs),
      total: result.total,
    },
    pagination: buildPagination({
      page: result.page,
      limit: result.limit,
      total: result.total,
    }),
  });
});

/**
 * GET /api/v1/learning/programs/:id
 *
 * One endpoint for every signed-in reader, including the publisher. An ended or archived
 * programme is returned with its `availability` rather than hidden, so a bookmarked link
 * can say "this finished on 12 August" instead of 404-ing as if it never existed. Drafts
 * 404 for everyone but their owner.
 *
 * `enrollment` IS WHAT THE PAGE DECIDES ITS BUTTON FROM: null renders "Enrol", a row
 * renders the progress control and, once complete, the reassessment prompt.
 */
export const getLearningProgram = asyncHandler(async (req, res) => {
  const program = await getProgramForViewer(req.params.id, req.user.id);

  const enrollment = isLearnerRole(req.user.role)
    ? await myEnrollmentForProgram(req.user.id, program.id)
    : null;

  return sendSuccess(res, {
    message: 'Learning program retrieved successfully.',
    data: { program, enrollment },
  });
});

/** POST /api/v1/learning/programs -> 201. Publisher is req.user.id, never the body. */
export const postLearningProgram = asyncHandler(async (req, res) => {
  const program = await createLearningProgram(req.user.id, req.body);

  return sendCreated(res, {
    message: 'Learning program published successfully.',
    data: { program },
  });
});

/**
 * PATCH /api/v1/learning/programs/:id -> 200.
 *
 * Also the publish and archive path: `{ "status": "archived" }` through this endpoint,
 * with no invented /publish or /archive route, the same choice opportunity.routes.js made.
 * The message names what actually changed so a demo reads "Learning program archived."
 * rather than a vague "updated".
 */
export const patchLearningProgram = asyncHandler(async (req, res) => {
  const program = await updateLearningProgram(req.user.id, req.params.id, req.body);

  const statusMessages = {
    published: 'Learning program published.',
    archived: 'Learning program archived.',
    draft: 'Learning program saved as a draft.',
  };

  const message =
    'status' in req.body && statusMessages[program.status]
      ? statusMessages[program.status]
      : 'Learning program updated successfully.';

  return sendSuccess(res, { message, data: { program } });
});

/**
 * DELETE /api/v1/learning/programs/:id -> 200.
 *
 * Returns the id rather than 204 so the client can drop that row without a refetch. The
 * service refuses outright once anyone has enrolled — deleting a course out from under a
 * learner's completion record would erase their evidence — and answers with "archive it
 * instead", which is the action that actually takes it off the hub.
 */
export const removeLearningProgram = asyncHandler(async (req, res) => {
  const result = await deleteLearningProgram(req.user.id, req.params.id);

  return sendSuccess(res, {
    message: 'Learning program deleted.',
    data: { id: result.id },
  });
});

/**
 * GET /api/v1/industry/learning-programs — the publisher's own catalogue.
 *
 * Includes drafts, archived and ended, because this is a management view. The `summary`
 * and the per-programme enrolment counts are computed across the whole collection by the
 * service, so the dashboard figures do not change with the page size.
 *
 * COUNTS, NEVER LEARNERS. A publisher sees "14 enrolled, 3 completed" and no names,
 * emails or individual progress: that is private student information, and the standing
 * rule against reading it without authorisation covers industry users too.
 */
export const listMyLearningPrograms = asyncHandler(async (req, res) => {
  const { status, type, search, page, limit } = req.query;

  const result = await listOwnedPrograms(req.user.id, { status, type, search, page, limit });

  return sendSuccess(res, {
    message: 'Your learning programs were retrieved successfully.',
    data: {
      programs: result.programs,
      total: result.total,
      summary: result.summary,
    },
    pagination: buildPagination({
      page: result.page,
      limit: result.limit,
      total: result.total,
    }),
  });
});

/**
 * The sentence the hub shows above the recommended strip.
 *
 * A REASON IS A STATE, NOT AN ERROR — "you have not chosen a target role yet" has to
 * render as guidance with a link, not a red toast, so it arrives as a 200 with a message
 * the page can print verbatim.
 */
const RECOMMENDATION_MESSAGES = {
  'no-profile': 'Complete your student profile to get learning recommendations.',
  'no-career-goal': 'Choose a target role to see which programs would close your gaps.',
  'no-gaps': 'You already meet every skill requirement for this role.',
  'no-programs': 'No published program covers your current skill gaps yet.',
};

/**
 * GET /api/v1/learning/recommendations — STUDENT only.
 *
 * The student is `req.user.id`; `careerRoleId` is optional and only chooses which of
 * their own target roles to measure against. There is no path here for one student to
 * request another's recommendations.
 */
export const getLearningRecommendations = asyncHandler(async (req, res) => {
  const { careerRoleId, limit } = req.query;

  const result = await getLearningRecommendationsForStudent({
    studentId: req.user.id,
    careerRoleId,
    limit,
  });

  return sendSuccess(res, {
    message:
      RECOMMENDATION_MESSAGES[result.reason] ?? 'Learning recommendations retrieved successfully.',
    data: {
      recommendations: result.recommendations,
      careerRole: result.careerRole,
      readinessScore: result.readinessScore,
      reason: result.reason,
      gapsConsidered: result.gapsConsidered,
      uncoveredGaps: result.uncoveredGaps,
    },
  });
});

/**
 * POST /api/v1/learning/enrollments -> 201, body `{ programId }`.
 *
 * The learner is `req.user`, and the validator rejects `learnerId`, `studentId`,
 * `progress` and `status` by name — a new enrolment starts at 0% and `enrolled`, so those
 * are a confused client rather than a request. A second attempt on the same programme is
 * a 409 from the service, and from the unique index if two requests race.
 */
export const postEnrollment = asyncHandler(async (req, res) => {
  const enrollment = await enroll(req.user, req.body.programId);

  return sendCreated(res, {
    message: 'You are enrolled. Update your progress as you work through it.',
    data: { enrollment },
  });
});

/**
 * GET /api/v1/learning/enrollments — My Learning.
 *
 * SCOPED TO `req.user.id` IN THE QUERY, not filtered afterwards, so there is no parameter
 * a client could send to widen it. The `summary` is counted across every row the learner
 * has, not the returned page, so page two does not report a smaller total.
 */
export const listMyLearning = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;

  const result = await listMyEnrollments(req.user.id, { status, page, limit });

  return sendSuccess(res, {
    message: 'Your learning was retrieved successfully.',
    data: {
      enrollments: result.enrollments,
      total: result.total,
      summary: result.summary,
    },
    pagination: buildPagination({
      page: result.page,
      limit: result.limit,
      total: result.total,
    }),
  });
});

/**
 * GET /api/v1/learning/enrollments/summary — the dashboard card.
 *
 * Its own endpoint because the "Your Skill Development" card needs four numbers and the
 * one programme to continue, not a page of rows — and working those out from page one of
 * a paginated list would be wrong for anyone with more than a page of learning.
 */
export const getLearningSummary = asyncHandler(async (req, res) => {
  const summary = await getMyLearningSummary(req.user.id);

  return sendSuccess(res, {
    message: 'Learning summary retrieved successfully.',
    data: { summary },
  });
});

/**
 * GET /api/v1/learning/enrollments/:id — one of the caller's own rows.
 *
 * 404 for someone else's enrolment rather than 403: a published programme's existence is
 * public, a person's enrolment is not, so "wrong owner" and "no such row" must be
 * indistinguishable from outside.
 */
export const getMyEnrollment = asyncHandler(async (req, res) => {
  const result = await getEnrollment(req.user.id, req.params.id);

  return sendSuccess(res, {
    message: 'Enrollment retrieved successfully.',
    data: result,
  });
});

/**
 * PATCH /api/v1/learning/enrollments/:id -> 200, body `{ progress }`, `{ status }` or both.
 *
 * THE ONLY WRITE PATH FOR PROGRESS, and there is no `/complete` route: `{status:
 * 'completed'}` or `{progress: 100}` through this endpoint is how a programme is finished,
 * the same single-endpoint choice the opportunity routes made.
 *
 * THE COMPLETION MESSAGE IS THE POINT OF STEP 8. It asks for a reassessment rather than
 * announcing an improvement, because finishing a course is evidence of study and the
 * number in a skill profile only moves when a real assessment is submitted. `justCompleted`
 * distinguishes the call that completed it from a later reload of the same row, so a
 * refresh neither loses the prompt nor re-fires the celebration.
 */
export const patchEnrollment = asyncHandler(async (req, res) => {
  const result = await updateEnrollment(req.user.id, req.params.id, req.body);

  const message = result.justCompleted
    ? 'Program complete. Retake the assessment to record the improvement it earned you.'
    : 'Progress updated.';

  return sendSuccess(res, { message, data: result });
});

export default {
  browseLearningPrograms,
  getLearningProgram,
  postLearningProgram,
  patchLearningProgram,
  removeLearningProgram,
  listMyLearningPrograms,
  getLearningRecommendations,
  postEnrollment,
  listMyLearning,
  getLearningSummary,
  getMyEnrollment,
  patchEnrollment,
};
