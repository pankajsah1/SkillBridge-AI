/**
 * Academician endpoint client.
 *
 * Same contract as portfolio.api.js and studentProfile.api.js, deliberately: every
 * function unwraps `response.data.data` so components never see the envelope, and
 * every rejection is left exactly as axiosInstance normalised it
 * (`{status, message, errors, isNetworkError}`) so one error path serves the whole
 * app.
 *
 * NO PATH IN THIS FILE CARRIES A USER OR PROFILE ID. The server derives the owner
 * from the token, which is what makes "academician A edits academician B's profile"
 * unrepresentable rather than merely blocked — the request cannot be expressed here,
 * so there is no check to forget. The one id any function takes is an *opportunity*
 * id, which is public to the audience it was posted for.
 *
 * READS AND WRITES ARE NAMED BY HOUSE CONVENTION: `fetch*` for reads, `create*` /
 * `update*` / `delete*` for writes, matching every other module in this folder.
 */

import axiosInstance from './axiosInstance.js';

const BASE = '/academicians';

/* --------------------------------------------------------------------- reads */

/**
 * GET /academicians/profile
 *
 * Resolves `{profile, completion}`. `profile` is null — not an error — for an
 * academician who has not created one yet, which is how the page decides between a
 * create form and an edit form.
 *
 * @returns {Promise<{profile: object|null, completion: object|null}>}
 */
export const fetchMyProfile = async () => {
  const response = await axiosInstance.get(`${BASE}/profile`);
  const { profile = null, completion = null } = response.data.data;
  return { profile, completion };
};

/**
 * GET /academicians/profile/completion
 *
 * The score on its own. Always a real object: no profile is an honest 0% with every
 * section listed as missing, not a 404.
 *
 * @returns {Promise<{completionPercentage: number, completedSections: string[],
 *                    missingSections: Array<{key: string, label: string,
 *                    weight: number, action: string}>}>}
 */
export const fetchMyCompletion = async () => {
  const response = await axiosInstance.get(`${BASE}/profile/completion`);
  return response.data.data.completion;
};

/**
 * GET /academicians/dashboard
 *
 * Every card on the dashboard in one request. Resolves the payload as the server
 * sends it:
 *
 *   {
 *     profileCompletion: {completionPercentage, completedSections, missingSections},
 *     hasProfile: boolean,
 *     opportunities: {open, collaborations, programmes, byType},
 *     applications: {total, active, byStatus},
 *     matches: {topMatches, consideredCount, reason},
 *     weights: {skills, careerInterest, eligibility, profileCompleteness},
 *   }
 *
 * Every number in it is a database count — nothing on that page is computed in the
 * browser, and nothing is hardcoded.
 *
 * @returns {Promise<object>}
 */
export const fetchDashboard = async () => {
  const response = await axiosInstance.get(`${BASE}/dashboard`);
  return response.data.data;
};

/**
 * GET /academicians/matches
 *
 * Ranked collaboration and programme postings. Each row is
 * `{opportunity, match, expertise}`, where `match` is the same object the student
 * matcher produces (`matchScore`, `breakdown`, `recommendation`, …) and `expertise`
 * is the Phase 7 explanation (`strongMatch`, `additionalExpertise`, `gaps`,
 * `highlights`).
 *
 * `reason` is a non-error empty state — `'no-profile'` means there is nothing to
 * match against yet, which is a first-run condition and not a failure.
 *
 * @param {{limit?: number}} [params]
 * @returns {Promise<{matches: Array<object>, consideredCount: number,
 *                    weights: object, reason: string|null}>}
 */
export const fetchMyMatches = async ({ limit } = {}) => {
  const response = await axiosInstance.get(`${BASE}/matches`, {
    params: limit ? { limit } : undefined,
  });

  const { matches = [], consideredCount = 0, weights, reason = null } = response.data.data;
  return { matches, consideredCount, weights, reason };
};

/**
 * GET /academicians/matches/:opportunityId
 *
 * The breakdown behind one posting. 404 when the opportunity does not exist or is
 * not addressed to academicians; `reason: 'no-profile'` with `match: null` when the
 * caller has no profile yet, which the details page renders as a prompt rather than
 * an error.
 *
 * @param {string} opportunityId
 * @returns {Promise<{opportunity: object, match: object|null, expertise: object|null,
 *                    weights: object, reason: string|null}>}
 */
export const fetchMatchForOpportunity = async (opportunityId) => {
  const response = await axiosInstance.get(`${BASE}/matches/${opportunityId}`);
  const { opportunity, match = null, expertise = null, weights, reason = null } = response.data.data;
  return { opportunity, match, expertise, weights, reason };
};

/* ----------------------------------------------------------------- mutations */

/**
 * Every write resolves to the same `{profile, completion}` pair.
 *
 * Because every write can move the score — adding a skill changes it, deleting a
 * publication changes it — returning both means the progress panel can never
 * disagree with the list beside it, and the client never recomputes a number the
 * server owns. Same decision as portfolio.api.js.
 */
const unwrapMutation = (response) => {
  const { profile, completion } = response.data.data;
  return { profile, completion };
};

/* ------------------------------------------------------------------- profile */

/**
 * POST /academicians/profile — 409 if one already exists.
 *
 * Accepts any subset of the editable fields, including none at all: an academician
 * who lands on the page and presses "Create profile" gets an empty profile at 0%,
 * which is a better starting point than a validation error.
 */
export const createProfile = async (fields = {}) =>
  unwrapMutation(await axiosInstance.post(`${BASE}/profile`, fields));

/**
 * PATCH /academicians/profile — 404 when no profile exists yet.
 *
 * Editable fields only: headline, bio, institutionName, department, designation,
 * designationOther, location, expertiseAreas, researchInterests,
 * isOpenToCollaboration. Sending `skills`, `education`, `experiences` or
 * `achievements` here is a 400 naming the endpoint that owns them — they are lists
 * with their own routes, not fields.
 */
export const updateProfile = async (fields) =>
  unwrapMutation(await axiosInstance.patch(`${BASE}/profile`, fields));

/* ----------------------------------------------------------------- expertise */

/**
 * POST /academicians/profile/skills
 *
 * `skillId` references the shared skill catalogue — the same collection the student
 * matcher reads — which is what lets an academician's Python and an opportunity's
 * Python be the same thing rather than two strings that happen to look alike.
 *
 * @param {{skillId: string, level: number}} payload
 */
export const createExpertise = async ({ skillId, level }) =>
  unwrapMutation(await axiosInstance.post(`${BASE}/profile/skills`, { skillId, level }));

/** PATCH /academicians/profile/skills/:skillId — only `level` is mutable. */
export const updateExpertise = async (skillId, { level }) =>
  unwrapMutation(await axiosInstance.patch(`${BASE}/profile/skills/${skillId}`, { level }));

export const deleteExpertise = async (skillId) =>
  unwrapMutation(await axiosInstance.delete(`${BASE}/profile/skills/${skillId}`));

/* ----------------------------------------------------------------- education */

export const createEducation = async (payload) =>
  unwrapMutation(await axiosInstance.post(`${BASE}/profile/education`, payload));

export const updateEducation = async (entryId, payload) =>
  unwrapMutation(await axiosInstance.patch(`${BASE}/profile/education/${entryId}`, payload));

export const deleteEducation = async (entryId) =>
  unwrapMutation(await axiosInstance.delete(`${BASE}/profile/education/${entryId}`));

/* ---------------------------------------------------------------- experience */

export const createExperience = async (payload) =>
  unwrapMutation(await axiosInstance.post(`${BASE}/profile/experiences`, payload));

export const updateExperience = async (entryId, payload) =>
  unwrapMutation(await axiosInstance.patch(`${BASE}/profile/experiences/${entryId}`, payload));

export const deleteExperience = async (entryId) =>
  unwrapMutation(await axiosInstance.delete(`${BASE}/profile/experiences/${entryId}`));

/* -------------------------------------------------------------- achievements */

export const createAchievement = async (payload) =>
  unwrapMutation(await axiosInstance.post(`${BASE}/profile/achievements`, payload));

export const updateAchievement = async (entryId, payload) =>
  unwrapMutation(await axiosInstance.patch(`${BASE}/profile/achievements/${entryId}`, payload));

export const deleteAchievement = async (entryId) =>
  unwrapMutation(await axiosInstance.delete(`${BASE}/profile/achievements/${entryId}`));

export default {
  fetchMyProfile,
  fetchMyCompletion,
  fetchDashboard,
  fetchMyMatches,
  fetchMatchForOpportunity,
  createProfile,
  updateProfile,
  createExpertise,
  updateExpertise,
  deleteExpertise,
  createEducation,
  updateEducation,
  deleteEducation,
  createExperience,
  updateExperience,
  deleteExperience,
  createAchievement,
  updateAchievement,
  deleteAchievement,
};
