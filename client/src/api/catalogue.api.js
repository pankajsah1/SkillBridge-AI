/**
 * Catalogue endpoint client — skills and career roles.
 *
 * Same contract as auth.api.js: unwrap the server's
 * `{ success, message, data }` envelope and return just the useful part, letting
 * axiosInstance's normalised `{ status, message, errors, isNetworkError }`
 * rejection propagate.
 *
 * READ ONLY, ON PURPOSE. The catalogue is populated by `npm run seed` on the
 * server; there are no write endpoints to call. This is what keeps the skill and
 * career-role lists out of the frontend source entirely — his section 2 asks for
 * exactly one source of truth, and it lives in the database.
 */

import axiosInstance from './axiosInstance.js';

/**
 * GET /skills
 *
 * @param {{category?: string, tag?: string, search?: string}} [filters]
 * @returns {Promise<Array<object>>} skills, each `{ id, name, slug, category, description, tags }`
 */
export const fetchSkills = async (filters = {}) => {
  // Only defined, non-empty filters are sent, so a cleared search box asks for
  // the full list rather than for `?search=`.
  const params = {};
  if (filters.category) params.category = filters.category;
  if (filters.tag) params.tag = filters.tag;
  if (filters.search) params.search = filters.search;

  const response = await axiosInstance.get('/skills', { params });
  return response.data.data.skills;
};

/**
 * GET /skills/:id
 * @returns {Promise<object>}
 */
export const fetchSkill = async (skillId) => {
  const response = await axiosInstance.get(`/skills/${skillId}`);
  return response.data.data.skill;
};

/**
 * GET /career-roles
 *
 * The list omits each role's required-skill blueprint (only
 * `requiredSkillCount`), which is all the goal picker needs. Fetch a single role
 * when the full blueprint matters.
 *
 * @param {{category?: string}} [filters]
 * @returns {Promise<Array<object>>}
 */
export const fetchCareerRoles = async (filters = {}) => {
  const params = {};
  if (filters.category) params.category = filters.category;

  const response = await axiosInstance.get('/career-roles', { params });
  return response.data.data.careerRoles;
};

/**
 * GET /career-roles/:id — includes `requiredSkills` with skill names resolved.
 * @returns {Promise<object>}
 */
export const fetchCareerRole = async (roleId) => {
  const response = await axiosInstance.get(`/career-roles/${roleId}`);
  return response.data.data.careerRole;
};

export default { fetchSkills, fetchSkill, fetchCareerRoles, fetchCareerRole };
