/**
 * Matching endpoint client.
 *
 * Both routes sit on the student mount and are scoped to the caller by the
 * server, so there is no student id in either path — the same reason
 * studentProfile.api.js has none.
 *
 * `weights` comes back with every response. It is not decoration: the breakdown
 * UI labels each part with the weight the server actually used, so the page
 * cannot drift out of step with the scoring if the weighting ever changes.
 */

import axiosInstance from './axiosInstance.js';

/**
 * GET /students/matches
 *
 * Every live posting scored against this student's profile, best first.
 *
 * Resolves to `{ matches, consideredCount, weights, reason }`. `matches` is
 * empty with `reason: 'no-profile'` for a student who has not set up a profile —
 * a normal first-run state, so the caller explains it rather than showing an
 * error.
 *
 * @param {{limit?: number}} [options]
 */
export const fetchMyMatches = async ({ limit } = {}) => {
  const response = await axiosInstance.get('/students/matches', {
    params: limit ? { limit } : undefined,
  });

  const {
    matches = [],
    consideredCount = 0,
    weights = null,
    reason = null,
  } = response.data.data;

  return { matches, consideredCount, weights, reason };
};

/**
 * GET /students/matches/:opportunityId
 *
 * The breakdown behind one posting. Rejects with 404 if the opportunity does not
 * exist; resolves with `match: null` and `reason: 'no-profile'` when the student
 * has nothing to be matched on yet.
 *
 * @param {string} opportunityId
 */
export const fetchOpportunityMatch = async (opportunityId) => {
  const response = await axiosInstance.get(`/students/matches/${opportunityId}`);

  const { match = null, weights = null, reason = null } = response.data.data;
  return { match, weights, reason };
};

export default { fetchMyMatches, fetchOpportunityMatch };
