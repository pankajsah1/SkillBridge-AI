/**
 * Student profile endpoint client.
 *
 * Every route here is STUDENT-only and operates on *the caller's own* profile —
 * there is no id in any path, because the server derives the owner from the
 * token. That is why "student A edits student B" is not a bug this file could
 * have: the request cannot be expressed.
 *
 * Follows auth.api.js: unwrap the `{ success, message, data }` envelope, let
 * axiosInstance's normalised rejection propagate.
 */

import axiosInstance from './axiosInstance.js';

/**
 * GET /students/profile
 *
 * Returns `null` — not an error — when the student has not created a profile
 * yet. A first-time student is a normal state, not a failure, and the caller
 * distinguishes "no profile" from "request failed" by whether this resolves.
 *
 * @returns {Promise<object|null>}
 */
export const fetchMyProfile = async () => {
  const response = await axiosInstance.get('/students/profile');
  return response.data.data.profile;
};

/**
 * POST /students/profile
 *
 * Rejects with status 409 if a profile already exists. Every field is optional:
 * a student can create an empty profile and fill it in later.
 *
 * @param {object} payload
 * @returns {Promise<object>} the created profile
 */
export const createMyProfile = async (payload) => {
  const response = await axiosInstance.post('/students/profile', payload);
  return response.data.data.profile;
};

/**
 * PATCH /students/profile
 *
 * Send only the fields that changed. An empty object is rejected with 400 rather
 * than quietly succeeding.
 *
 * Scalar fields only — skills and career goals have their own endpoints, and
 * sending them here returns a 400 that says so.
 *
 * @param {object} payload
 * @returns {Promise<object>} the updated profile
 */
export const updateMyProfile = async (payload) => {
  const response = await axiosInstance.patch('/students/profile', payload);
  return response.data.data.profile;
};

/**
 * PUT /students/profile/career-goals
 *
 * PUT, not PATCH: the body is the complete new selection and replaces whatever
 * was stored. Passing `[]` clears the selection, which is how a student undoes a
 * choice.
 *
 * Accepts either `['roleId', ...]` (priority follows array order) or
 * `[{ roleId, priority }, ...]` for an explicit ranking.
 *
 * @param {Array<string|{roleId: string, priority?: number}>} roleIds
 * @returns {Promise<object>} the updated profile
 */
export const updateMyCareerGoals = async (roleIds) => {
  const response = await axiosInstance.put('/students/profile/career-goals', { roleIds });
  return response.data.data.profile;
};

/**
 * GET /students/profile/skills
 * @returns {Promise<Array<object>>}
 */
export const fetchMySkills = async () => {
  const response = await axiosInstance.get('/students/profile/skills');
  return response.data.data.skills;
};

/**
 * POST /students/profile/skills
 *
 * Rejects with 409 if the student already lists this skill — the caller should
 * offer to update the existing entry instead.
 *
 * The server forces `source: 'manual'` and `verified: false` regardless of what
 * is sent, so there is no point including them.
 *
 * @param {{skillId: string, level: number}} payload
 * @returns {Promise<object>} the whole updated profile, so `profileCompletion` stays in sync
 */
export const addMySkill = async ({ skillId, level }) => {
  const response = await axiosInstance.post('/students/profile/skills', { skillId, level });
  return response.data.data.profile;
};

/**
 * PATCH /students/profile/skills/:skillId
 * @returns {Promise<object>} the whole updated profile
 */
export const updateMySkillLevel = async (skillId, level) => {
  const response = await axiosInstance.patch(`/students/profile/skills/${skillId}`, { level });
  return response.data.data.profile;
};

/**
 * DELETE /students/profile/skills/:skillId
 *
 * Returns 200 with the updated profile rather than 204, because removing a skill
 * changes `profileCompletion` and the client should not have to guess the new
 * value.
 *
 * @returns {Promise<object>} the whole updated profile
 */
export const removeMySkill = async (skillId) => {
  const response = await axiosInstance.delete(`/students/profile/skills/${skillId}`);
  return response.data.data.profile;
};

/**
 * GET /students/readiness
 *
 * Career readiness against one role, derived on every request from the profile
 * as it is right now — nothing here is stored, so a skill added a second ago is
 * already reflected.
 *
 * Resolves to `{ readiness, careerRole, reason }`. `readiness` is null when
 * there is nothing to measure against, with `reason` saying which case it is
 * ('no-profile' or 'no-career-goal') — both are normal first-run states rather
 * than failures, so the caller renders an explanation, not an error.
 *
 * @param {string} [careerRoleId] omit to use the primary career goal
 * @returns {Promise<{readiness: object|null, careerRole: object|null, reason: string|null}>}
 */
export const fetchMyReadiness = async (careerRoleId) => {
  const response = await axiosInstance.get('/students/readiness', {
    params: careerRoleId ? { careerRoleId } : undefined,
  });

  const { readiness = null, careerRole = null, reason = null } = response.data.data;
  return { readiness, careerRole, reason };
};

export default {
  fetchMyProfile,
  createMyProfile,
  updateMyProfile,
  updateMyCareerGoals,
  fetchMySkills,
  addMySkill,
  updateMySkillLevel,
  removeMySkill,
  fetchMyReadiness,
};
