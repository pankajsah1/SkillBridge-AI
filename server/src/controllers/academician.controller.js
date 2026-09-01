/**
 * Academician controller — HTTP translation only.
 *
 * Identical contract to `studentProfile.controller.js` and
 * `portfolio.controller.js`: read the request, delegate to the service, format with
 * the Step 1 helpers. No business logic, and no try/catch — `asyncHandler` forwards
 * rejections to `errorMiddleware`, which owns every error shape in the app.
 *
 * THE USER ID COMES FROM `req.user.id` AND NOWHERE ELSE. `authenticate` sets
 * `req.user = user.toSafeObject()`, whose shape is `{id, name, email, role, isActive,
 * createdAt}` — there is no `_id` on it, and reading one would silently pass
 * `undefined` into a query that then matches nothing. No handler below reads a user
 * id or a profile id from the URL or the body, which is what makes Step 7's "an
 * academician must only be able to edit their own profile" a property of the shape of
 * this file rather than a check somebody has to remember.
 *
 * There is no role logic here either. The ACADEMICIAN check lives in the route's
 * `allowRoles()`, so authorization is not duplicated in two places that could
 * disagree.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import {
  addAchievement,
  addEducation,
  addExperience,
  addExpertise,
  createOwnProfile,
  getDashboard as getDashboardData,
  getOwnCompletion,
  getOwnMatchForOpportunity,
  getOwnMatches,
  getOwnProfile,
  removeAchievement,
  removeEducation,
  removeExperience,
  removeExpertise,
  updateAchievement,
  updateEducation,
  updateExperience,
  updateExpertiseLevel,
  updateOwnProfile,
} from '../services/academician.service.js';
import { MATCH_WEIGHTS } from '../services/matching.service.js';

/* ------------------------------------------------------------------ profile */

/**
 * GET /api/v1/academicians/profile
 *
 * 200 with `profile: null` when none exists yet, not a 404 — the same decision the
 * student endpoint makes, for the same reason: a newly registered academician having
 * no profile is the expected first state, and the client uses the null to choose
 * between a create form and an edit form. Reserving 404 for genuine mistakes keeps it
 * meaningful.
 *
 * `completion` rides along so the page can render its progress panel from one request.
 */
export const getProfile = asyncHandler(async (req, res) => {
  const { profile, completion } = await getOwnProfile(req.user.id);

  return sendSuccess(res, {
    message: profile ? 'Profile retrieved successfully.' : 'No profile has been created yet.',
    data: { profile, completion },
  });
});

/** POST /api/v1/academicians/profile -> 201. A second creation is a 409 from the service. */
export const createProfile = asyncHandler(async (req, res) => {
  const { profile, completion } = await createOwnProfile(req.user.id, req.body);

  return sendCreated(res, {
    message: 'Profile created successfully.',
    data: { profile, completion },
  });
});

/** PATCH /api/v1/academicians/profile -> 200 with the updated profile. */
export const updateProfile = asyncHandler(async (req, res) => {
  const { profile, completion } = await updateOwnProfile(req.user.id, req.body);

  return sendSuccess(res, {
    message: 'Profile updated successfully.',
    data: { profile, completion },
  });
});

/**
 * GET /api/v1/academicians/profile/completion -> 200.
 *
 * Always 200, even with no profile: no profile genuinely is 0% complete, and the
 * missing-section list is exactly the advice a first-time visitor needs.
 */
export const getCompletion = asyncHandler(async (req, res) => {
  const completion = await getOwnCompletion(req.user.id);

  return sendSuccess(res, {
    message: 'Profile completion computed successfully.',
    data: { completion },
  });
});

/* ---------------------------------------------------------------- expertise */

/**
 * POST /api/v1/academicians/profile/skills -> 201.
 *
 * Returns the whole profile and completion rather than just the new skill, because
 * adding expertise moves the completion percentage and the client should not have to
 * guess the new value or re-fetch to learn it. Every mutating handler below does the
 * same, which is why they all share one response shape.
 */
export const createExpertise = asyncHandler(async (req, res) => {
  const { skillId, level } = req.body;
  const { profile, completion } = await addExpertise(req.user.id, { skillId, level });

  return sendCreated(res, {
    message: 'Expertise added successfully.',
    data: { profile, completion },
  });
});

/** PATCH /api/v1/academicians/profile/skills/:skillId -> 200. Only `level` is mutable. */
export const updateExpertise = asyncHandler(async (req, res) => {
  const { profile, completion } = await updateExpertiseLevel(req.user.id, req.params.skillId, {
    level: req.body.level,
  });

  return sendSuccess(res, {
    message: 'Expertise updated successfully.',
    data: { profile, completion },
  });
});

/** DELETE /api/v1/academicians/profile/skills/:skillId -> 200 with the updated profile. */
export const deleteExpertise = asyncHandler(async (req, res) => {
  const { profile, completion } = await removeExpertise(req.user.id, req.params.skillId);

  return sendSuccess(res, {
    message: 'Expertise removed successfully.',
    data: { profile, completion },
  });
});

/* ---------------------------------------------------------------- education */

/** POST /api/v1/academicians/profile/education -> 201. */
export const createEducation = asyncHandler(async (req, res) => {
  const { profile, completion } = await addEducation(req.user.id, req.body);

  return sendCreated(res, {
    message: 'Education entry added successfully.',
    data: { profile, completion },
  });
});

/** PATCH /api/v1/academicians/profile/education/:entryId -> 200. */
export const patchEducation = asyncHandler(async (req, res) => {
  const { profile, completion } = await updateEducation(
    req.user.id,
    req.params.entryId,
    req.body,
  );

  return sendSuccess(res, {
    message: 'Education entry updated successfully.',
    data: { profile, completion },
  });
});

/** DELETE /api/v1/academicians/profile/education/:entryId -> 200. */
export const deleteEducation = asyncHandler(async (req, res) => {
  const { profile, completion } = await removeEducation(req.user.id, req.params.entryId);

  return sendSuccess(res, {
    message: 'Education entry removed successfully.',
    data: { profile, completion },
  });
});

/* --------------------------------------------------------------- experience */

/** POST /api/v1/academicians/profile/experiences -> 201. */
export const createExperience = asyncHandler(async (req, res) => {
  const { profile, completion } = await addExperience(req.user.id, req.body);

  return sendCreated(res, {
    message: 'Experience added successfully.',
    data: { profile, completion },
  });
});

/** PATCH /api/v1/academicians/profile/experiences/:entryId -> 200. */
export const patchExperience = asyncHandler(async (req, res) => {
  const { profile, completion } = await updateExperience(
    req.user.id,
    req.params.entryId,
    req.body,
  );

  return sendSuccess(res, {
    message: 'Experience updated successfully.',
    data: { profile, completion },
  });
});

/** DELETE /api/v1/academicians/profile/experiences/:entryId -> 200. */
export const deleteExperience = asyncHandler(async (req, res) => {
  const { profile, completion } = await removeExperience(req.user.id, req.params.entryId);

  return sendSuccess(res, {
    message: 'Experience removed successfully.',
    data: { profile, completion },
  });
});

/* ------------------------------------------------------------- achievements */

/** POST /api/v1/academicians/profile/achievements -> 201. */
export const createAchievement = asyncHandler(async (req, res) => {
  const { profile, completion } = await addAchievement(req.user.id, req.body);

  return sendCreated(res, {
    message: 'Achievement added successfully.',
    data: { profile, completion },
  });
});

/** PATCH /api/v1/academicians/profile/achievements/:entryId -> 200. */
export const patchAchievement = asyncHandler(async (req, res) => {
  const { profile, completion } = await updateAchievement(
    req.user.id,
    req.params.entryId,
    req.body,
  );

  return sendSuccess(res, {
    message: 'Achievement updated successfully.',
    data: { profile, completion },
  });
});

/** DELETE /api/v1/academicians/profile/achievements/:entryId -> 200. */
export const deleteAchievement = asyncHandler(async (req, res) => {
  const { profile, completion } = await removeAchievement(req.user.id, req.params.entryId);

  return sendSuccess(res, {
    message: 'Achievement removed successfully.',
    data: { profile, completion },
  });
});

/* ---------------------------------------------------------------- discovery */

/**
 * GET /api/v1/academicians/matches?limit=... -> 200.
 *
 * Ranked collaboration and programme postings, each carrying the Phase 7 expertise
 * explanation. `weights` rides along exactly as it does for students, so the UI can
 * label the breakdown without a second copy of 70/15/10/5 living in the frontend.
 *
 * `matches: []` with a `reason` for an academician who has not built a profile yet —
 * there is nothing to match against, which is a first-run state and not a failure.
 */
export const getMatches = asyncHandler(async (req, res) => {
  const { matches, consideredCount, reason } = await getOwnMatches(req.user.id, {
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
 * GET /api/v1/academicians/matches/:opportunityId -> 200.
 *
 * The breakdown behind one posting, plus the expertise explanation. 404 when the
 * opportunity does not exist — that is a genuine mistake, unlike the empty state
 * above.
 */
export const getOpportunityMatch = asyncHandler(async (req, res) => {
  const { opportunity, match, expertise, reason } = await getOwnMatchForOpportunity(
    req.user.id,
    req.params.opportunityId,
  );

  return sendSuccess(res, {
    message: reason ? 'No profile has been created yet.' : 'Match computed successfully.',
    data: { opportunity, match, expertise, weights: MATCH_WEIGHTS, reason },
  });
});

/**
 * GET /api/v1/academicians/dashboard -> 200.
 *
 * Every card on the academician dashboard in one request, following
 * `getRecruitmentSummary` for industry and the institution analytics endpoint: a page
 * that opens on every login should not cost five round-trips.
 *
 * Always 200. An academician with no profile and no applications gets real zeros and
 * empty lists, which is what lets the frontend render an empty state instead of an
 * error — and there are no hardcoded numbers anywhere behind this, every figure is a
 * database count.
 */
export const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await getDashboardData(req.user.id);

  return sendSuccess(res, {
    message: 'Dashboard retrieved successfully.',
    data: { ...dashboard, weights: MATCH_WEIGHTS },
  });
});

export default {
  getProfile,
  createProfile,
  updateProfile,
  getCompletion,
  createExpertise,
  updateExpertise,
  deleteExpertise,
  createEducation,
  patchEducation,
  deleteEducation,
  createExperience,
  patchExperience,
  deleteExperience,
  createAchievement,
  patchAchievement,
  deleteAchievement,
  getMatches,
  getOpportunityMatch,
  getDashboard,
};
