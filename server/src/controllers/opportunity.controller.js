/**
 * Opportunity controller — HTTP translation only.
 *
 * Same contract as auth.controller.js and studentProfile.controller.js: read the
 * request, delegate, format with the Step 1 helpers. No business logic, no
 * try/catch (asyncHandler forwards rejections to errorMiddleware, which owns
 * every error shape).
 *
 * Note what every write handler has in common: the owner comes from `req.user.id`
 * and nowhere else. No handler reads an owner from the URL or body, which is what
 * makes cross-account writes impossible rather than merely guarded. The INDUSTRY
 * check lives in the route's allowRoles(), so there is no role logic here at all
 * — his section 3 asks that authorization not be duplicated into controllers.
 *
 * Query parameters are destructured individually rather than passed through as
 * `req.query`, so an unexpected parameter cannot reach a database filter. Same
 * reasoning as catalogue.controller.js.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { buildPagination, sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { audienceForRole } from '../constants/opportunities.js';
import {
  createOpportunity,
  deleteOpportunity,
  getOpportunityForViewer,
  listOpenOpportunities,
  listOwnedOpportunities,
  updateOpportunity,
} from '../services/opportunity.service.js';

/**
 * GET /api/v1/opportunities — browse, for a student or an academician.
 *
 * Only genuinely open postings, decided by the service. `pagination` rides
 * alongside `data` as a sibling key, which is the envelope TRD.md section 46
 * defines and buildPagination() already produces — no second response format.
 *
 * `audience` IS THE ONE VALUE HERE THAT DOES NOT COME FROM THE QUERY STRING. It is
 * derived from `req.user.role`, so an academician gets faculty programmes and
 * everyone else gets exactly the student postings they got before Step 7. Adding
 * it to the destructured list above would let a student send
 * `?audience=academician` and browse — then apply to — a Faculty Development
 * Programme, which is why the mapping is a function of the authenticated role and
 * nothing else.
 */
export const browseOpportunities = asyncHandler(async (req, res) => {
  const { type, workMode, location, skills, search, page, limit } = req.query;

  const result = await listOpenOpportunities({
    type,
    workMode,
    location,
    skills,
    search,
    page,
    limit,
    audience: audienceForRole(req.user.role),
  });

  return sendSuccess(res, {
    message: 'Opportunities retrieved successfully.',
    data: { opportunities: result.opportunities, total: result.total },
    pagination: buildPagination({
      page: result.page,
      limit: result.limit,
      total: result.total,
    }),
  });
});

/**
 * GET /api/v1/opportunities/:id
 *
 * One endpoint for every signed-in reader, including the owner. A closed or
 * expired posting is returned with its `availability` rather than hidden, so a
 * bookmarked link can say "this closed on 12 August" instead of 404-ing as if the
 * page never existed. Drafts 404 for everyone but their owner.
 *
 * `req.user.id` is passed so the service can make that owner distinction; it is
 * not an authorization decision made here.
 */
export const getOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await getOpportunityForViewer(req.params.id, req.user.id);

  return sendSuccess(res, {
    message: 'Opportunity retrieved successfully.',
    data: { opportunity },
  });
});

/** POST /api/v1/opportunities -> 201. Owner is req.user.id, never the body. */
export const postOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await createOpportunity(req.user.id, req.body);

  return sendCreated(res, {
    message: 'Opportunity posted successfully.',
    data: { opportunity },
  });
});

/**
 * PATCH /api/v1/opportunities/:id -> 200.
 *
 * Also the close and reopen path: TRD.md section 31 defines no separate status
 * route, so `{ "status": "closed" }` through this endpoint is the documented way
 * rather than an invented /close. The message reflects what actually changed, so
 * a demo shows "Opportunity closed." rather than a vague "updated".
 */
export const patchOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await updateOpportunity(req.user.id, req.params.id, req.body);

  const statusMessages = {
    closed: 'Opportunity closed.',
    active: 'Opportunity published.',
    draft: 'Opportunity saved as a draft.',
  };

  const message =
    'status' in req.body && statusMessages[opportunity.status]
      ? statusMessages[opportunity.status]
      : 'Opportunity updated successfully.';

  return sendSuccess(res, { message, data: { opportunity } });
});

/**
 * DELETE /api/v1/opportunities/:id -> 200.
 *
 * 200 with the deleted id rather than 204. sendNoContent() exists, but returning
 * the id lets the client remove exactly that row from its list without a refetch,
 * and confirms which record went — the same reasoning as deleteSkill.
 */
export const removeOpportunity = asyncHandler(async (req, res) => {
  const result = await deleteOpportunity(req.user.id, req.params.id);

  return sendSuccess(res, {
    message: 'Opportunity deleted.',
    data: { id: result.id },
  });
});

/**
 * GET /api/v1/industry/opportunities — the caller's own postings.
 *
 * Includes drafts, closed and expired, because this is a management view. The
 * `summary` is counted across the whole collection by the service, not over the
 * returned page, so the dashboard figures do not change with the page size.
 */
export const listMyOpportunities = asyncHandler(async (req, res) => {
  const { status, type, search, page, limit } = req.query;

  const result = await listOwnedOpportunities(req.user.id, {
    status,
    type,
    search,
    page,
    limit,
  });

  return sendSuccess(res, {
    message: 'Your opportunities were retrieved successfully.',
    data: {
      opportunities: result.opportunities,
      total: result.total,
      summary: result.summary,
    },
    pagination: buildPagination({
      page: result.page,
      limit: result.limit,
      total: result.total,
    }),
  });
});

export default {
  browseOpportunities,
  getOpportunity,
  postOpportunity,
  patchOpportunity,
  removeOpportunity,
  listMyOpportunities,
};
