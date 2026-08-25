/**
 * Assessment endpoint client.
 *
 * Same contract as the other api/ modules: unwrap the server's
 * `{ success, message, data }`, return the useful part, and let axiosInstance's
 * normalised `{ status, message, errors, isNetworkError }` rejection propagate.
 *
 * ONE DIFFERENCE FROM opportunity.api.js WORTH KNOWING. The assessment
 * controller puts the attempt directly on `data` rather than under
 * `data.assessment`, so these helpers read `response.data.data`, not
 * `response.data.data.assessment`. That is the controller's actual shape — see
 * server/src/controllers/assessment.controller.js — not a preference.
 *
 * WHAT AN IN-PROGRESS PAPER DOES NOT CONTAIN: option scores. The server sends
 * `toQuestionPaper()` while an attempt is open and `toResult()` once it is
 * submitted, so there is no answer key in the browser to read out of devtools
 * mid-attempt. Nothing here tries to reconstruct one.
 */

import axiosInstance from './axiosInstance.js';

/**
 * POST /assessments — start a paper, or pick up the one already open.
 *
 * The server answers 201 for a fresh attempt and 200 with `resumed: true` when
 * an in-progress one already existed, because starting twice would silently
 * throw away half-finished answers. Callers get `resumed` so they can say so.
 *
 * @param {{careerRoleId?: string, questionCount?: number}} [options]
 * @returns {Promise<object>} the question paper, plus `resumed`
 */
export const startAssessment = async ({ careerRoleId, questionCount } = {}) => {
  const payload = {};
  if (careerRoleId) payload.careerRoleId = careerRoleId;
  if (questionCount) payload.questionCount = questionCount;

  const response = await axiosInstance.post('/assessments', payload);
  return response.data.data;
};

/**
 * GET /assessments/:id — the paper while open, the full result once submitted.
 *
 * @returns {Promise<object>}
 */
export const fetchAssessment = async (assessmentId) => {
  const response = await axiosInstance.get(`/assessments/${assessmentId}`);
  return response.data.data;
};

/**
 * GET /assessments/active — the open paper, or null.
 *
 * `null` is a normal answer, not a 404: "you have nothing in progress" is a fact
 * about a student, not a missing resource.
 *
 * @returns {Promise<object|null>}
 */
export const fetchActiveAssessment = async () => {
  const response = await axiosInstance.get('/assessments/active');
  return response.data.data;
};

/**
 * GET /assessments/latest — the newest submitted result, or null.
 *
 * @returns {Promise<object|null>}
 */
export const fetchLatestAssessment = async () => {
  const response = await axiosInstance.get('/assessments/latest');
  return response.data.data;
};

/**
 * GET /assessments — every attempt, newest first, as summaries (no questions).
 *
 * @returns {Promise<{assessments: Array<object>, pagination: object}>}
 */
export const fetchAssessments = async ({ page, limit } = {}) => {
  const params = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;

  const response = await axiosInstance.get('/assessments', { params });
  return { assessments: response.data.data, pagination: response.data.pagination };
};

/**
 * POST /assessments/:id/submit — score the paper.
 *
 * `answers` is `[{ questionIndex, optionIndex }]`. Unanswered questions are
 * simply absent; the server scores them zero and keeps them in the denominator,
 * so skipping cannot inflate a score.
 *
 * The response is the result plus `profileUpdated` and `updatedSkillCount`,
 * because submitting also writes the measured levels onto the student's profile.
 *
 * @returns {Promise<object>}
 */
export const submitAssessment = async (assessmentId, answers) => {
  const response = await axiosInstance.post(`/assessments/${assessmentId}/submit`, { answers });
  return response.data.data;
};

/**
 * DELETE /assessments/:id — abandon an open attempt.
 *
 * Marks it abandoned rather than deleting it, so a student can start again
 * without the previous half-answered paper blocking them.
 *
 * @returns {Promise<object>} the abandoned attempt's summary
 */
export const discardAssessment = async (assessmentId) => {
  const response = await axiosInstance.delete(`/assessments/${assessmentId}`);
  return response.data.data;
};

export default {
  startAssessment,
  fetchAssessment,
  fetchActiveAssessment,
  fetchLatestAssessment,
  fetchAssessments,
  submitAssessment,
  discardAssessment,
};
