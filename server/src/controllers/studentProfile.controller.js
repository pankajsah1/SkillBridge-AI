/**
 * Student profile controller — HTTP translation only.
 *
 * Same contract as auth.controller.js: read the request, delegate, format with
 * the Step 1 helpers. No business logic, no try/catch (asyncHandler forwards
 * rejections to errorMiddleware, which owns every error shape).
 *
 * Note what every handler has in common: the user id comes from `req.user.id`
 * and nowhere else. No handler reads a profile id, a user id or an owner from
 * the URL or body, which is what makes cross-account access impossible rather
 * than merely guarded. His section 9 also asks that authorization not be
 * duplicated in controllers — the STUDENT check lives in the route's
 * allowRoles(), so there is no role logic here at all.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { normaliseCareerGoals } from '../validators/studentProfile.validator.js';
import {
  addSkill,
  createOwnProfile,
  getOwnProfile,
  getOwnSkills,
  removeSkill,
  setCareerGoals,
  updateOwnProfile,
  updateSkillLevel,
} from '../services/studentProfile.service.js';

/**
 * GET /api/v1/students/profile
 *
 * 200 with `profile: null` when none exists yet — not a 404. A new student
 * having no profile is the expected first state, and the client uses the null to
 * decide between a create form and an edit form. Reserving 404 for genuine
 * mistakes keeps it meaningful.
 */
export const getProfile = asyncHandler(async (req, res) => {
  const profile = await getOwnProfile(req.user.id);

  return sendSuccess(res, {
    message: profile ? 'Profile retrieved successfully.' : 'No profile has been created yet.',
    data: { profile },
  });
});

/** POST /api/v1/students/profile -> 201. Duplicate creation is a 409 from the service. */
export const createProfile = asyncHandler(async (req, res) => {
  const profile = await createOwnProfile(req.user.id, req.body);

  return sendCreated(res, {
    message: 'Profile created successfully.',
    data: { profile },
  });
});

/** PATCH /api/v1/students/profile -> 200 with the updated profile. */
export const updateProfile = asyncHandler(async (req, res) => {
  const profile = await updateOwnProfile(req.user.id, req.body);

  return sendSuccess(res, {
    message: 'Profile updated successfully.',
    data: { profile },
  });
});

/**
 * PUT /api/v1/students/profile/career-goals
 *
 * PUT rather than PATCH because the body is the complete new selection —
 * replacing a set, not merging into one.
 */
export const updateCareerGoals = asyncHandler(async (req, res) => {
  const goals = normaliseCareerGoals(req.body.roleIds);
  const profile = await setCareerGoals(req.user.id, goals);

  return sendSuccess(res, {
    message: 'Career goals updated successfully.',
    data: { profile },
  });
});

/** GET /api/v1/students/profile/skills -> 200 with just the skill list. */
export const getSkills = asyncHandler(async (req, res) => {
  const skills = await getOwnSkills(req.user.id);

  return sendSuccess(res, {
    message: 'Skills retrieved successfully.',
    data: { skills },
  });
});

/**
 * POST /api/v1/students/profile/skills -> 201.
 *
 * Returns the whole profile, not just the new skill, because adding a skill
 * changes profileCompletion too and the client should not have to guess the new
 * value or re-fetch to learn it. Every mutating handler here does the same.
 */
export const createSkill = asyncHandler(async (req, res) => {
  const { skillId, level } = req.body;

  const profile = await addSkill(req.user.id, { skillId, level });

  return sendCreated(res, {
    message: 'Skill added successfully.',
    data: { profile },
  });
});

/** PATCH /api/v1/students/profile/skills/:skillId -> 200. Only `level` is mutable. */
export const updateSkill = asyncHandler(async (req, res) => {
  const { level } = req.body;

  const profile = await updateSkillLevel(req.user.id, req.params.skillId, { level });

  return sendSuccess(res, {
    message: 'Skill updated successfully.',
    data: { profile },
  });
});

/**
 * DELETE /api/v1/students/profile/skills/:skillId -> 200.
 *
 * 200 with the updated profile rather than 204. sendNoContent() exists, but a
 * body-less response would force the client to re-fetch to refresh its
 * completion percentage, and DESIGN.md section 34 wants immediate feedback.
 */
export const deleteSkill = asyncHandler(async (req, res) => {
  const profile = await removeSkill(req.user.id, req.params.skillId);

  return sendSuccess(res, {
    message: 'Skill removed successfully.',
    data: { profile },
  });
});

export default {
  getProfile,
  createProfile,
  updateProfile,
  updateCareerGoals,
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
};
