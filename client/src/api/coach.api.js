/**
 * Coach / explainability endpoint client.
 *
 * A thin wrapper over `/coach`. Every explanation, action and match reason in the
 * responses was assembled by the server from the Step 1–9 services and grounded in
 * stored data; this module fetches them and sends no identity, the same as every
 * other owner-scoped read in this client.
 */

import axiosInstance from './axiosInstance.js';

/**
 * GET /coach/explanations — the student AI Coach.
 *
 * @param {object} [params] `{ careerRoleId, narrate }`. `narrate=false` returns the
 *   raw deterministic answers without the optional natural-language rewording.
 * @returns {Promise<object>} `{ role, aiEnabled, careerRole, readinessScore, explanations, actions }`
 */
export const fetchCoach = async ({ careerRoleId, narrate } = {}) => {
  const response = await axiosInstance.get('/coach/explanations', {
    params: {
      careerRoleId,
      narrate: narrate === false ? 'false' : undefined,
    },
  });
  return response.data.data;
};

/**
 * GET /coach/next-actions — the Action Center for the signed-in role.
 *
 * @returns {Promise<{ role: string, title: string, actions: object[] }>}
 */
export const fetchNextActions = async () => {
  const response = await axiosInstance.get('/coach/next-actions');
  return response.data.data;
};

/**
 * GET /coach/opportunities/:id/why — the grounded reason one posting fits.
 *
 * @returns {Promise<object>}
 */
export const fetchOpportunityWhy = async (opportunityId) => {
  const response = await axiosInstance.get(`/coach/opportunities/${opportunityId}/why`);
  return response.data.data;
};

export default { fetchCoach, fetchNextActions, fetchOpportunityWhy };
