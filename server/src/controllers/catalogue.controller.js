/**
 * Catalogue controller — read-only skill and career-role endpoints.
 *
 * HTTP translation only, same as the other controllers. Query parameters are
 * read individually rather than passed through as `req.query`, so an unexpected
 * parameter cannot reach a database filter.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  getCareerRoleById,
  getSkillById,
  listCareerRoles,
  listSkills,
} from '../services/catalogue.service.js';

/**
 * GET /api/v1/skills
 *
 * Optional `?category=technical|soft`, `?tag=Frontend`, `?search=rea`.
 * Unrecognised values simply match nothing — a 400 for a bad filter would make
 * an exploratory request fail where an empty list is the honest answer.
 */
export const getSkills = asyncHandler(async (req, res) => {
  const { category, tag, search } = req.query;

  const skills = await listSkills({ category, tag, search });

  return sendSuccess(res, {
    message: 'Skills retrieved successfully.',
    data: { skills, total: skills.length },
  });
});

/** GET /api/v1/skills/:id */
export const getSkill = asyncHandler(async (req, res) => {
  const skill = await getSkillById(req.params.id);

  return sendSuccess(res, {
    message: 'Skill retrieved successfully.',
    data: { skill },
  });
});

/** GET /api/v1/career-roles — optional `?category=Engineering`. */
export const getCareerRoles = asyncHandler(async (req, res) => {
  const { category } = req.query;

  const careerRoles = await listCareerRoles({ category });

  return sendSuccess(res, {
    message: 'Career roles retrieved successfully.',
    data: { careerRoles, total: careerRoles.length },
  });
});

/** GET /api/v1/career-roles/:id — includes the populated skill blueprint. */
export const getCareerRole = asyncHandler(async (req, res) => {
  const careerRole = await getCareerRoleById(req.params.id);

  return sendSuccess(res, {
    message: 'Career role retrieved successfully.',
    data: { careerRole },
  });
});

export default { getSkills, getSkill, getCareerRoles, getCareerRole };
