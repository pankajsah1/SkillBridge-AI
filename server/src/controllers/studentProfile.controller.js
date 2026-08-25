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
import { getReadinessForStudent } from '../services/readiness.service.js';
import { getRecommendationsForStudent } from '../services/recommendation.service.js';
import {
  MATCH_WEIGHTS,
  getMatchForStudent,
  getMatchesForStudent,
} from '../services/matching.service.js';

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

/**
 * GET /api/v1/students/readiness?careerRoleId=...
 *
 * Optional query param: measure against a specific role; absent means the
 * student's primary (priority-1) career goal, from the same profile field the
 * rest of the app reads. Two state answers rather than two errors: no profile,
 * or a profile with no career goal, both come back as a clean { reason } the
 * client can explain ("Add your career goals to see your readiness"). No
 * arithmetic happens here — the service is pure math over the two documents.
 */
export const getReadiness = asyncHandler(async (req, res) => {
  const { readiness, careerRole, reason } = await getReadinessForStudent({
    studentId: req.user.id,
    careerRoleId: req.query.careerRoleId,
  });

  if (!readiness) {
    return sendSuccess(res, {
      message:
        reason === 'no-profile'
          ? 'No profile has been created yet.'
          : 'No career goal has been set yet.',
      data: { readiness: null, careerRole: null, reason },
    });
  }

  return sendSuccess(res, {
    message: 'Readiness computed successfully.',
    data: { readiness, careerRole },
  });
});

/**
 * GET /api/v1/students/recommendations?careerRoleId=...&limit=...
 *
 * What to learn next, ranked deterministically from the same gaps the readiness
 * endpoint reports. Same optional role param, same two empty states, same
 * `{ reason }` contract — a client that can render one can render the other.
 */
export const getRecommendations = asyncHandler(async (req, res) => {
  const { recommendations, careerRole, readinessScore, reason } =
    await getRecommendationsForStudent({
      studentId: req.user.id,
      careerRoleId: req.query.careerRoleId,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

  if (reason) {
    return sendSuccess(res, {
      message:
        reason === 'no-profile'
          ? 'No profile has been created yet.'
          : 'No career goal has been set yet.',
      data: { recommendations: [], careerRole: null, readinessScore: null, reason },
    });
  }

  return sendSuccess(res, {
    message: 'Recommendations generated successfully.',
    data: { recommendations, careerRole, readinessScore, reason: null },
  });
});

/**
 * GET /api/v1/students/matches -> 200.
 *
 * The student's ranked matches across every live posting. `weights` rides along
 * so the UI can label the breakdown without a second copy of 70/15/10/5 — one
 * owner for the weighting, exactly as with every other number in this app.
 *
 * `matches: []` with a `reason` for a student who has no profile yet: there is
 * nothing to match against, which is a first-run state and not a failure.
 */
export const getMatches = asyncHandler(async (req, res) => {
  const { matches, consideredCount, reason } = await getMatchesForStudent({
    studentId: req.user.id,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  if (reason) {
    return sendSuccess(res, {
      message: 'No profile has been created yet.',
      data: { matches: [], consideredCount: 0, weights: MATCH_WEIGHTS, reason },
    });
  }

  return sendSuccess(res, {
    message: 'Matches computed successfully.',
    data: { matches, consideredCount, weights: MATCH_WEIGHTS, reason: null },
  });
});

/**
 * GET /api/v1/students/matches/:opportunityId -> 200.
 *
 * The breakdown behind one posting. 404 when the opportunity does not exist —
 * that is a genuine mistake, unlike the empty states above.
 */
export const getOpportunityMatch = asyncHandler(async (req, res) => {
  const { match, opportunity, reason } = await getMatchForStudent({
    studentId: req.user.id,
    opportunityId: req.params.opportunityId,
  });

  return sendSuccess(res, {
    message: reason ? 'No profile has been created yet.' : 'Match computed successfully.',
    data: { match, opportunity, weights: MATCH_WEIGHTS, reason },
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
  getReadiness,
  getRecommendations,
  getMatches,
  getOpportunityMatch,
};
