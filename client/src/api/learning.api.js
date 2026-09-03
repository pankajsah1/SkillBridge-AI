/**
 * Learning endpoint client.
 *
 * Same contract as opportunity.api.js: unwrap the server's
 * `{ success, message, data }` envelope, return just the useful part, and let
 * axiosInstance's normalised `{ status, message, errors, isNetworkError }`
 * rejection propagate so every caller handles failures identically.
 *
 * The `data` keys below are not guesses — each matches what
 * server/src/controllers/learning.controller.js actually sends. List endpoints put
 * `pagination` beside `data` rather than inside it (TRD.md section 46), so the list
 * helpers assemble their return value from both.
 *
 * NOTHING HERE EVER SENDS AN IDENTITY. There is no `studentId`, `learnerId` or
 * `publisherId` parameter in this file, because the server derives all three from
 * the token and its validators reject them by name. "My learning" is a request with
 * no arguments for that reason.
 */

import axiosInstance from './axiosInstance.js';

/**
 * Builds a query object from filters, dropping everything blank.
 *
 * A cleared dropdown must ask for the unfiltered list, not for `?type=` — the
 * server rejects an empty enum value, so sending it would turn "show me
 * everything" into a 400. `skills` goes out as a comma-separated id list, which is
 * what the validator expects and what a checkbox filter naturally serialises to.
 */
const toQuery = (filters = {}) => {
  const params = {};

  if (filters.type) params.type = filters.type;
  if (filters.level) params.level = filters.level;
  if (filters.deliveryMode) params.deliveryMode = filters.deliveryMode;
  if (filters.status) params.status = filters.status;
  if (filters.search?.trim()) params.search = filters.search.trim();

  if (Array.isArray(filters.skills) && filters.skills.length > 0) {
    params.skills = filters.skills.join(',');
  } else if (typeof filters.skills === 'string' && filters.skills.trim()) {
    params.skills = filters.skills.trim();
  }

  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  return params;
};

/**
 * GET /learning/programs — the Learning Hub catalogue.
 *
 * Published and not yet ended, decided by the server. Each row carries
 * `enrollment`: the caller's own row on that programme, or null — which is what a
 * card decides between "Enrol" and "Continue" from, so it never offers to enrol a
 * learner in something they are halfway through.
 *
 * @param {{type?: string, level?: string, deliveryMode?: string,
 *          skills?: string[]|string, search?: string, page?: number,
 *          limit?: number}} [filters]
 * @returns {Promise<{programs: Array<object>, total: number, pagination: object}>}
 */
export const fetchLearningPrograms = async (filters = {}) => {
  const response = await axiosInstance.get('/learning/programs', { params: toQuery(filters) });
  const { data, pagination } = response.data;

  return { programs: data.programs, total: data.total, pagination };
};

/**
 * GET /learning/programs/:id
 *
 * One endpoint for every signed-in reader, including the publisher — which is why
 * the edit form uses it too instead of a second detail route. Returns both halves
 * because the page needs both: the programme, and whether this reader is on it.
 *
 * @returns {Promise<{program: object, enrollment: object|null}>}
 */
export const fetchLearningProgram = async (programId) => {
  const response = await axiosInstance.get(`/learning/programs/${programId}`);
  const { program, enrollment } = response.data.data;

  return { program, enrollment };
};

/**
 * POST /learning/programs — publish or draft a programme. INDUSTRY only.
 *
 * The publisher is the authenticated user; there is no owner field to send.
 *
 * @returns {Promise<object>}
 */
export const createLearningProgram = async (payload) => {
  const response = await axiosInstance.post('/learning/programs', payload);
  return response.data.data.program;
};

/**
 * PATCH /learning/programs/:id — edit, or move the status.
 *
 * One endpoint for both, because a status change is an edit of one field. The
 * server refuses an illegal transition, and constants/learning.js's
 * `programStatusActionsFor` is what stops the UI offering one.
 *
 * @returns {Promise<object>}
 */
export const updateLearningProgram = async (programId, payload) => {
  const response = await axiosInstance.patch(`/learning/programs/${programId}`, payload);
  return response.data.data.program;
};

/**
 * DELETE /learning/programs/:id
 *
 * Only the publisher, and only while nobody is enrolled — the server refuses
 * otherwise and says why, because deleting a programme learners are recorded
 * against would erase their learning history. Archiving is the alternative it
 * points at.
 *
 * @returns {Promise<string>} the deleted id
 */
export const deleteLearningProgram = async (programId) => {
  const response = await axiosInstance.delete(`/learning/programs/${programId}`);
  return response.data.data.id;
};

/**
 * GET /industry/learning-programs — the signed-in publisher's own catalogue.
 *
 * Includes drafts, archived and ended programmes, because this is a management
 * view. Each row's `enrollment` is a COUNT of learners on it
 * (`{ total, enrolled, inProgress, completed }`) — not the caller's own row, which
 * is what the same key means on the learner list. Publishers see numbers, never
 * names.
 *
 * @returns {Promise<{programs: Array<object>, total: number, summary: object,
 *                    pagination: object}>}
 */
export const fetchMyLearningPrograms = async (filters = {}) => {
  const response = await axiosInstance.get('/industry/learning-programs', {
    params: toQuery(filters),
  });
  const { data, pagination } = response.data;

  return { programs: data.programs, total: data.total, summary: data.summary, pagination };
};

/**
 * GET /learning/recommendations — "Recommended for you", with the reasons.
 *
 * The whole shape matters, not just the array: `reason` is a STATE, not an error
 * ('no-profile', 'no-career-goal', 'no-gaps', 'no-programs'), and the hub renders a
 * sentence for each. `uncoveredGaps` is the honest answer to "why is there nothing
 * for Docker?", and `readinessScore` and `careerRole` are what the strip's heading
 * says the recommendations are measured against.
 *
 * Every number and every sentence in here is computed on the server, from this
 * student's own gaps. Nothing is scored in the browser.
 *
 * @param {{careerRoleId?: string, limit?: number}} [options]
 * @returns {Promise<{recommendations: Array<object>, careerRole: object|null,
 *                    readinessScore: number|null, reason: string|null,
 *                    gapsConsidered: number, uncoveredGaps: Array<object>}>}
 */
export const fetchLearningRecommendations = async ({ careerRoleId, limit } = {}) => {
  const params = {};
  if (careerRoleId) params.careerRoleId = careerRoleId;
  if (limit) params.limit = limit;

  const response = await axiosInstance.get('/learning/recommendations', { params });
  return response.data.data;
};

/**
 * POST /learning/enrollments — body `{ programId }` and nothing else.
 *
 * A new enrolment starts at 0% and `enrolled`; the validator rejects `progress`,
 * `status` and any learner id by name, so there is nothing else to send. A second
 * attempt on the same programme is a 409 the caller should surface as "you are
 * already enrolled" rather than a failure.
 *
 * @returns {Promise<object>}
 */
export const enrollInProgram = async (programId) => {
  const response = await axiosInstance.post('/learning/enrollments', { programId });
  return response.data.data.enrollment;
};

/**
 * GET /learning/enrollments — My Learning, newest first.
 *
 * `summary` counts the whole collection rather than the current page, so a learner
 * on page two does not read "2 programmes" as their total.
 *
 * @param {{status?: string, page?: number, limit?: number}} [filters]
 * @returns {Promise<{enrollments: Array<object>, total: number, summary: object,
 *                    pagination: object}>}
 */
export const fetchMyLearning = async (filters = {}) => {
  const response = await axiosInstance.get('/learning/enrollments', {
    params: toQuery(filters),
  });
  const { data, pagination } = response.data;

  return { enrollments: data.enrollments, total: data.total, summary: data.summary, pagination };
};

/**
 * GET /learning/enrollments/summary — the dashboard card, without a page of rows.
 *
 * `{ total, enrolled, inProgress, completed, active, continueWith }`, where
 * `continueWith` is the most recently touched unfinished enrolment — the one thing
 * a "Your Skill Development" card needs to offer a single Continue button.
 *
 * @returns {Promise<object>}
 */
export const fetchLearningSummary = async () => {
  const response = await axiosInstance.get('/learning/enrollments/summary');
  return response.data.data.summary;
};

/**
 * GET /learning/enrollments/:id — one of the caller's own enrolments.
 *
 * Returns the enrolment result shape, not a bare row:
 * `{ enrollment, justCompleted, nextAction, skillsToReassess }`. `nextAction` is
 * 'reassess' once complete, and `skillsToReassess` names the skills to be
 * reassessed on — the data behind the completion CTA. Another learner's id is a
 * 404 here, not a row.
 *
 * @returns {Promise<{enrollment: object, justCompleted: boolean,
 *                    nextAction: string|null, skillsToReassess: Array<object>}>}
 */
export const fetchMyEnrollment = async (enrollmentId) => {
  const response = await axiosInstance.get(`/learning/enrollments/${enrollmentId}`);
  return response.data.data;
};

/**
 * PATCH /learning/enrollments/:id — `{ progress }`, `{ status }`, or both.
 *
 * THERE IS NO `/complete` ENDPOINT and this file does not invent one: completing is
 * `progress: 100` (or `status: 'completed'`) and the server derives the other half,
 * stamps `completedAt` and returns `justCompleted: true` so the page can show the
 * reassessment prompt exactly once.
 *
 * Whether the move is legal is the server's decision — it refuses a lowered
 * percentage and a move out of `completed`, because both would rewrite a learner's
 * history.
 *
 * @param {string} enrollmentId
 * @param {{progress?: number, status?: string}} payload
 * @returns {Promise<{enrollment: object, justCompleted: boolean,
 *                    nextAction: string|null, skillsToReassess: Array<object>}>}
 */
export const updateEnrollment = async (enrollmentId, payload) => {
  const response = await axiosInstance.patch(`/learning/enrollments/${enrollmentId}`, payload);
  return response.data.data;
};

export default {
  fetchLearningPrograms,
  fetchLearningProgram,
  createLearningProgram,
  updateLearningProgram,
  deleteLearningProgram,
  fetchMyLearningPrograms,
  fetchLearningRecommendations,
  enrollInProgram,
  fetchMyLearning,
  fetchLearningSummary,
  fetchMyEnrollment,
  updateEnrollment,
};
