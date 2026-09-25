/**
 * coach.controller.js — HTTP translation for the explainability layer.
 *
 * Same contract as every other controller: read the request, delegate to
 * coach.service, format with the Step 1 helpers. No business logic, no try/catch,
 * no role checks — `allowRoles()` in the route owns authorization, and the identity
 * is always `req.user`, never a body or query field.
 *
 * NOTHING HERE COMPUTES A NUMBER. Explanations and actions are assembled entirely in
 * the service from existing Step 1–9 services; this file only shapes the envelope.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  getStudentCoach,
  getNextActionsForUser,
  getOpportunityWhy,
} from '../services/coach.service.js';

/**
 * GET /api/v1/coach/explanations — the student AI Coach.
 *
 * `careerRoleId` is optional; without it the student's primary career goal is used.
 * `narrate=false` returns the deterministic answers without the optional LLM
 * rewording, which the offline verifier and any judge who wants the raw grounding
 * can ask for.
 */
export const getCoach = asyncHandler(async (req, res) => {
  const narrate = req.query.narrate !== 'false';
  const result = await getStudentCoach(req.user.id, {
    careerRoleId: req.query.careerRoleId,
    narrate,
  });

  return sendSuccess(res, {
    message: 'Coach explanations retrieved successfully.',
    data: result,
  });
});

/**
 * GET /api/v1/coach/next-actions — the Action Center for the signed-in role.
 *
 * One endpoint for every role: the service picks the source from `req.user.role`,
 * so a student gets "Your Next Best Actions", an institution "Priority Actions", and
 * so on, all in one shape.
 */
export const getNextActions = asyncHandler(async (req, res) => {
  const result = await getNextActionsForUser(req.user);

  return sendSuccess(res, {
    message: 'Next actions retrieved successfully.',
    data: result,
  });
});

/**
 * GET /api/v1/coach/opportunities/:id/why — the grounded reason one posting fits.
 *
 * Reuses the matching engine's breakdown; the id is validated as an ObjectId by the
 * route before this runs.
 */
export const getWhyOpportunity = asyncHandler(async (req, res) => {
  const result = await getOpportunityWhy({ user: req.user, opportunityId: req.params.id });

  return sendSuccess(res, {
    message: 'Match explanation retrieved successfully.',
    data: result,
  });
});

export default { getCoach, getNextActions, getWhyOpportunity };
