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

/**
 * GET /analytics/institution/intelligence — the longer report.
 *
 * SEPARATE FROM THE CALL ABOVE, NOT A FLAG ON IT. The dashboard and the intelligence
 * page are two screens with two payload sizes, and the dashboard should not pay for
 * the demand ranking, the learning before/after and the outcome funnel it never
 * renders. Same account scoping, same lack of any id in the path.
 *
 * @returns {Promise<object>} `{institution, summary, skillDemand, skillGaps, learningImpact, outcomes, actions, coverage}`
 */
export const fetchInstitutionIntelligence = async () => {
  const response = await axiosInstance.get('/analytics/institution/intelligence');
  return response.data.data;
};

export default { fetchInstitutionAnalytics, fetchInstitutionIntelligence };
