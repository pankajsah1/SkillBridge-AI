/**
 * Application endpoint client.
 *
 * Same contract as every other api/ module: unwrap the server's
 * `{ success, message, data }`, return the useful part, and let axiosInstance's
 * normalised `{ status, message, errors, isNetworkError }` rejection through
 * untouched.
 *
 * THE 409 IS NOT AN ERROR TO SWALLOW. Applying twice rejects with status 409 and
 * the server's sentence, and the apply UI shows it as "you have already applied"
 * rather than a red failure — a duplicate is a fact about the student's own
 * history, not something that went wrong.
 *
 * NO STUDENT ID IN ANY PATH. Every student route is scoped by the token on the
 * server, the same as studentProfile.api.js and matching.api.js.
 */

import axiosInstance from './axiosInstance.js';

/**
 * POST /applications — apply to one opportunity.
 *
 * @param {{opportunityId: string, coverNote?: string}} input
 * @returns {Promise<object>} the created application
 */
export const applyToOpportunity = async ({ opportunityId, coverNote } = {}) => {
  const payload = { opportunityId };
  if (coverNote && coverNote.trim() !== '') payload.coverNote = coverNote.trim();

  const response = await axiosInstance.post('/applications', payload);
  return response.data.data.application;
};

/**
 * GET /applications/me — this student's applications, newest first.
 *
 * Pass `opportunityId` to ask about a single posting: the answer is an array of
 * length 0 or 1, because one application per student per opportunity is enforced
 * by a unique index on the server.
 *
 * @param {{opportunityId?: string, status?: string, page?: number, limit?: number}} [options]
 * @returns {Promise<{applications: Array<object>, total: number, pagination: object}>}
 */
export const fetchMyApplications = async ({ opportunityId, status, page, limit } = {}) => {
  const params = {};
  if (opportunityId) params.opportunityId = opportunityId;
  if (status) params.status = status;
  if (page) params.page = page;
  if (limit) params.limit = limit;

  const response = await axiosInstance.get('/applications/me', { params });
  const { applications = [], total = 0 } = response.data.data;

  return { applications, total, pagination: response.data.pagination };
};

/**
 * GET /applications/me?opportunityId= — the one-posting question, answered.
 *
 * Resolves to the application or `null`. A convenience over the call above
 * rather than a second endpoint, so the "have I applied?" check and the list
 * cannot drift apart.
 *
 * @param {string} opportunityId
 * @returns {Promise<object|null>}
 */
export const fetchMyApplicationFor = async (opportunityId) => {
  const { applications } = await fetchMyApplications({ opportunityId, limit: 1 });
  return applications[0] ?? null;
};

/**
 * GET /applications/summary — counts by status, for the dashboard card.
 *
 * @returns {Promise<{total: number, byStatus: object}>}
 */
export const fetchApplicationSummary = async () => {
  const response = await axiosInstance.get('/applications/summary');
  const { total = 0, byStatus = {} } = response.data.data;
  return { total, byStatus };
};

/**
 * GET /applications/:id — one of this student's applications.
 *
 * @returns {Promise<object>}
 */
export const fetchApplication = async (applicationId) => {
  const response = await axiosInstance.get(`/applications/${applicationId}`);
  return response.data.data.application;
};

/**
 * GET /opportunities/:id/applications — employer view of one posting's applicants.
 *
 * `statusCounts` covers every application for the posting, not just the filtered
 * page, so status tabs can show totals the current filter is hiding.
 *
 * @returns {Promise<{applications: Array<object>, opportunity: object, statusCounts: object, total: number, pagination: object}>}
 */
export const fetchOpportunityApplications = async (opportunityId, { status, page, limit } = {}) => {
  const params = {};
  if (status) params.status = status;
  if (page) params.page = page;
  if (limit) params.limit = limit;

  const response = await axiosInstance.get(`/opportunities/${opportunityId}/applications`, {
    params,
  });

  const { applications = [], opportunity = null, statusCounts = {}, total = 0 } =
    response.data.data;

  return { applications, opportunity, statusCounts, total, pagination: response.data.pagination };
};

/**
 * PATCH /applications/:id/status — employer moves an application along.
 *
 * @param {string} applicationId
 * @param {{status: string, note?: string}} input
 * @returns {Promise<object>} the updated application
 */
export const updateApplicationStatus = async (applicationId, { status, note } = {}) => {
  const payload = { status };
  if (note && note.trim() !== '') payload.note = note.trim();

  const response = await axiosInstance.patch(`/applications/${applicationId}/status`, payload);
  return response.data.data.application;
};

export default {
  applyToOpportunity,
  fetchMyApplications,
  fetchMyApplicationFor,
  fetchApplicationSummary,
  fetchApplication,
  fetchOpportunityApplications,
  updateApplicationStatus,
};
