/**
 * Assessment controllers — request in, response out, nothing else.
 *
 * Every handler here does the same three things: read the student from
 * `req.user.id`, call the service, send the envelope. No scoring, no question
 * selection, no database queries. RULES.md section 43 puts logic in services, and
 * the practical payoff is that `scoreAnswers` can be tested without Express.
 *
 * `req.user.id` and never a body or param field. There is no route in this file
 * that takes a student id, so "assess another student" is not merely blocked, it
 * is unrepresentable.
 */

import {
  abandonAssessment,
  getAssessmentForStudent,
  getLatestSubmittedAssessment,
  listAssessmentsForStudent,
  startAssessment,
  submitAssessment,
} from '../services/assessment.service.js';
import { ASSESSMENT_STATUSES } from '../constants/assessments.js';
import { buildPagination, sendCreated, sendSuccess } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Picks the right serialisation for an attempt.
 *
 * An in-progress attempt gets `toQuestionPaper()`, which omits option scores. A
 * submitted one gets `toResult()`, which includes them. This one branch is the
 * only thing standing between a student and the answer key, so it lives in a
 * named helper rather than being repeated inline in four handlers.
 */
const serialise = (assessment) =>
  assessment.status === ASSESSMENT_STATUSES.SUBMITTED
    ? assessment.toResult()
    : assessment.toQuestionPaper();

/**
 * POST /assessments
 *
 * 200 rather than 201 when an in-progress attempt was resumed — nothing was
 * created, and a client that keys off the status code should be told the truth.
 */
export const createAssessment = asyncHandler(async (req, res) => {
  const { assessment, resumed } = await startAssessment({
    studentId: req.user.id,
    careerRoleId: req.body?.careerRoleId,
    questionCount: req.body?.questionCount,
  });

  const data = { ...assessment.toQuestionPaper(), resumed };

  if (resumed) {
    return sendSuccess(res, {
      message: 'You have an assessment in progress. Picking up where you left off.',
      data,
    });
  }

  return sendCreated(res, { message: 'Assessment started.', data });
});

/** GET /assessments/latest — the newest submitted result, or null. */
export const getLatestAssessment = asyncHandler(async (req, res) => {
  const assessment = await getLatestSubmittedAssessment({ studentId: req.user.id });

  return sendSuccess(res, {
    message: assessment ? 'Latest assessment result retrieved.' : 'No assessment has been completed yet.',
    data: assessment ? assessment.toResult() : null,
  });
});

/** GET /assessments/active — the paper in progress, or null. */
export const getActiveAssessment = asyncHandler(async (req, res) => {
  const { assessments } = await listAssessmentsForStudent({
    studentId: req.user.id,
    page: 1,
    limit: 1,
  });

  const active =
    assessments[0] && assessments[0].status === ASSESSMENT_STATUSES.IN_PROGRESS
      ? assessments[0]
      : null;

  return sendSuccess(res, {
    message: active ? 'Assessment in progress retrieved.' : 'No assessment is in progress.',
    data: active ? active.toQuestionPaper() : null,
  });
});

/** GET /assessments — the student's own history. */
export const listAssessments = asyncHandler(async (req, res) => {
  const { assessments, total, page, limit } = await listAssessmentsForStudent({
    studentId: req.user.id,
    page: req.query.page,
    limit: req.query.limit,
  });

  return sendSuccess(res, {
    message: 'Assessments retrieved successfully.',
    data: assessments.map((assessment) => assessment.toSummary()),
    pagination: buildPagination({ page, limit, total }),
  });
});

/** GET /assessments/:assessmentId */
export const getAssessment = asyncHandler(async (req, res) => {
  const assessment = await getAssessmentForStudent({
    studentId: req.user.id,
    assessmentId: req.params.assessmentId,
  });

  return sendSuccess(res, {
    message: 'Assessment retrieved successfully.',
    data: serialise(assessment),
  });
});

/** POST /assessments/:assessmentId/submit */
export const submitAssessmentAnswers = asyncHandler(async (req, res) => {
  const { assessment, profileUpdated, updatedSkillCount } = await submitAssessment({
    studentId: req.user.id,
    assessmentId: req.params.assessmentId,
    answers: req.body?.answers ?? [],
  });

  return sendSuccess(res, {
    message: profileUpdated
      ? 'Assessment submitted. Your skill profile has been updated.'
      : 'Assessment submitted. Create your profile to save these scores to it.',
    data: { ...assessment.toResult(), profileUpdated, updatedSkillCount },
  });
});

/** DELETE /assessments/:assessmentId — discards an unfinished attempt. */
export const discardAssessment = asyncHandler(async (req, res) => {
  const assessment = await abandonAssessment({
    studentId: req.user.id,
    assessmentId: req.params.assessmentId,
  });

  return sendSuccess(res, {
    message: 'Assessment discarded. You can start a new one.',
    data: assessment.toSummary(),
  });
});

export default {
  createAssessment,
  discardAssessment,
  getActiveAssessment,
  getAssessment,
  getLatestAssessment,
  listAssessments,
  submitAssessmentAnswers,
};
