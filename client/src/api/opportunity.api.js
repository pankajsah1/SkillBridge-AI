/**
 * Opportunity endpoint client.
 *
 * Same contract as auth.api.js and catalogue.api.js: unwrap the server's
 * `{ success, message, data }` envelope, return just the useful part, and let
 * axiosInstance's normalised `{ status, message, errors, isNetworkError }`
 * rejection propagate so every caller handles failures the same way.
 *
 * The `data` keys below are not guesses — each matches what
 * server/src/controllers/opportunity.controller.js actually sends. The list
 * endpoints put `pagination` beside `data` rather than inside it (TRD.md section
 * 46), so the two list helpers return `{ opportunities, total, pagination }`
 * assembled from both.
 *
 * Only non-empty filters are sent. A cleared dropdown must ask for the unfiltered
 * list, not for `?type=` — and the server rejects an empty enum value, so sending
 * it would turn "show me everything" into a 400.
 */

import axiosInstance from './axiosInstance.js';

/**
 * Builds a query object from filters, dropping everything blank.
 *
 * `skills` is sent as a comma-separated id list, which is the shape the server's
 * validator expects and what a checkbox filter naturally serialises to.
 */
const toQuery = (filters = {}) => {
  const params = {};

  if (filters.type) params.type = filters.type;
  if (filters.workMode) params.workMode = filters.workMode;
  if (filters.status) params.status = filters.status;
  if (filters.location?.trim()) params.location = filters.location.trim();
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
 * GET /opportunities — student discovery. Only genuinely open postings.
 *
 * @param {{type?: string, workMode?: string, location?: string,
 *          skills?: string[]|string, search?: string, page?: number,
 *          limit?: number}} [filters]
 * @returns {Promise<{opportunities: Array<object>, total: number, pagination: object}>}
 */
export const fetchOpportunities = async (filters = {}) => {
  const response = await axiosInstance.get('/opportunities', { params: toQuery(filters) });
  const { data, pagination } = response.data;

  return { opportunities: data.opportunities, total: data.total, pagination };
};

/**
 * GET /opportunities/:id
 *
 * One endpoint for every signed-in reader, including the owner — which is why the
 * edit form uses it too instead of a second detail route.
 *
 * @returns {Promise<object>}
 */
export const fetchOpportunity = async (opportunityId) => {
  const response = await axiosInstance.get(`/opportunities/${opportunityId}`);
  return response.data.data.opportunity;
};

/**
 * GET /industry/opportunities — the signed-in company's own postings.
 *
 * Includes drafts, closed and expired ones, because this is a management view.
 * `summary` counts the whole collection, not the returned page, so the dashboard
 * figures do not change with the page size.
 *
 * @returns {Promise<{opportunities: Array<object>, total: number,
 *                    summary: object, pagination: object}>}
 */
export const fetchMyOpportunities = async (filters = {}) => {
  const response = await axiosInstance.get('/industry/opportunities', {
    params: toQuery(filters),
  });
  const { data, pagination } = response.data;

  return {
    opportunities: data.opportunities,
    total: data.total,
    summary: data.summary,
    pagination,
  };
};

/**
 * POST /opportunities -> 201.
 *
 * No owner is sent. The server takes it from the authenticated user, which is
 * what makes "post this as another company" unexpressible rather than merely
 * rejected.
 *
 * @returns {Promise<object>} the created opportunity
 */
export const createOpportunity = async (payload) => {
  const response = await axiosInstance.post('/opportunities', payload);
  return response.data.data.opportunity;
};

/**
 * PATCH /opportunities/:id
 *
 * Also the publish, close and reopen path: `{ status }` through this endpoint is
 * the documented way, so there is no invented /close route.
 *
 * @returns {Promise<object>} the updated opportunity
 */
export const updateOpportunity = async (opportunityId, patch) => {
  const response = await axiosInstance.patch(`/opportunities/${opportunityId}`, patch);
  return response.data.data.opportunity;
};

/**
 * DELETE /opportunities/:id
 *
 * @returns {Promise<string>} the deleted id, so a caller can drop exactly that
 *                            row without a refetch
 */
export const deleteOpportunity = async (opportunityId) => {
  const response = await axiosInstance.delete(`/opportunities/${opportunityId}`);
  return response.data.data.id;
};

export default {
  fetchOpportunities,
  fetchOpportunity,
  fetchMyOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
};
