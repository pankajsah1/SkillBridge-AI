/**
 * Analytics endpoint client.
 *
 * One request, one page. The institution dashboard renders six sections from a
 * single response rather than six calls, because they are six views of one cohort
 * and fetching them separately would let the header say 40 students while the table
 * below it described 39.
 *
 * NO INSTITUTION ID IN THE PATH. The server scopes every figure to the signed-in
 * account, the same as every other owner-scoped read in this client.
 */

import axiosInstance from './axiosInstance.js';

/**
 * GET /analytics/institution — the whole dashboard.
 *
 * @returns {Promise<object>} `{institution, cohort, readiness, branches, demand, skillGaps, strengths, pipeline}`
 */
export const fetchInstitutionAnalytics = async () => {
  const response = await axiosInstance.get('/analytics/institution');
  return response.data.data;
};

export default { fetchInstitutionAnalytics };
