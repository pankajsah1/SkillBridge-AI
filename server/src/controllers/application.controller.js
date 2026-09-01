/**
 * Application endpoints.
 *
 * Request and response only. Every decision — can this student apply, does this
 * employer own this posting, is that status move legal — is made in
 * application.service.js, so there is exactly one place to read the rules.
 *
 * THE STUDENT ID IS NEVER TAKEN FROM THE BODY. It is `req.user.id`, from the
 * verified token, on every route below. A body field would let anyone apply as
 * anyone. Same for the employer id on the two industry routes.
 *
 * Query parameters are destructured individually rather than handed through as
 * `req.query`, so an unexpected key cannot reach a database filter.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { buildPagination, sendCreated, sendSuccess } from '../utils/apiResponse.js';
import {
  countMyApplications,
  createApplication,
  getApplicationForStudent,
  getRecruitmentSummary,
  listApplicationsForOpportunity,
  listMyApplications,
  updateApplicationStatus,
} from '../services/application.service.js';

/**
 * POST /api/v1/applications -> 201.
 *
 * `applicantRole` COMES FROM THE TOKEN, NEVER THE BODY (Step 7). It is
 * `req.user.role`, the same verified source as the id beside it. A body field here
 * would let a student post `applicantRole: 'ACADEMICIAN'` and walk straight through
 * the audience gate in the service into a faculty programme.
 */
export const postApplication = asyncHandler(async (req, res) => {
  const application = await createApplication({
    studentId: req.user.id,
    applicantRole: req.user.role,
    opportunityId: req.body.opportunityId,
    coverNote: req.body.coverNote,
  });

  return sendCreated(res, {
    message: 'Application submitted successfully.',
    data: { application },
  });
});

/**
 * GET /api/v1/applications/me
 *
 * `?opportunityId=` narrows the answer to one row or none, which is how the
 * apply button on an opportunity page finds out whether this student has already
 * applied — no extra endpoint, no second shape to keep in step.
 */
export const listMine = asyncHandler(async (req, res) => {
  const { opportunityId, status, page, limit } = req.query;

  const result = await listMyApplications({
    studentId: req.user.id,
    opportunityId,
    status,
    page,
    limit,
  });

  return sendSuccess(res, {
    message: 'Applications retrieved successfully.',
    data: { applications: result.applications, total: result.total },
    pagination: buildPagination({
      page: result.page,
      limit: result.limit,
      total: result.total,
    }),
  });
});

/**
 * GET /api/v1/applications/summary — counts by status.
 *
 * Its own endpoint rather than a field on the list, because the dashboard card
 * wants "2 shortlisted" and nothing else; making it read a paginated list to
 * count would either be wrong past page one or pull rows it does not render.
 */
export const getMySummary = asyncHandler(async (req, res) => {
  const summary = await countMyApplications(req.user.id);

  return sendSuccess(res, {
    message: 'Application summary retrieved successfully.',
    data: summary,
  });
});

/** GET /api/v1/applications/:id — scoped to the student who made it. */
export const getApplication = asyncHandler(async (req, res) => {
  const application = await getApplicationForStudent({
    studentId: req.user.id,
    applicationId: req.params.id,
  });

  return sendSuccess(res, {
    message: 'Application retrieved successfully.',
    data: { application },
  });
});

/**
 * GET /api/v1/opportunities/:id/applications — the employer's applicant list.
 *
 * Mounted on the opportunity router because that is the resource it hangs off.
 * `req.user.id` goes to the service as `ownerId`; the service refuses postings
 * this employer does not own.
 */
export const listForOpportunity = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;

  const result = await listApplicationsForOpportunity({
    opportunityId: req.params.id,
    ownerId: req.user.id,
    status,
    page,
    limit,
  });

  return sendSuccess(res, {
    message: 'Applications retrieved successfully.',
    data: {
      applications: result.applications,
      opportunity: result.opportunity,
      statusCounts: result.statusCounts,
      total: result.total,
    },
    pagination: buildPagination({
      page: result.page,
      limit: result.limit,
      total: result.total,
    }),
  });
});

/** PATCH /api/v1/applications/:id/status — employer only. */
export const patchApplicationStatus = asyncHandler(async (req, res) => {
  const application = await updateApplicationStatus({
    applicationId: req.params.id,
    ownerId: req.user.id,
    status: req.body.status,
    note: req.body.note,
  });

  return sendSuccess(res, {
    message: 'Application status updated successfully.',
    data: { application },
  });
});

/**
 * GET /api/v1/industry/applications/summary — the employer's pipeline totals.
 *
 * On the industry router rather than under /opportunities, because it belongs to
 * no single posting. That router is already INDUSTRY-only and already scoped to
 * the caller, so `req.user.id` is the whole authorization story here.
 */
export const getRecruitmentTotals = asyncHandler(async (req, res) => {
  const summary = await getRecruitmentSummary(req.user.id);

  return sendSuccess(res, {
    message: 'Recruitment summary retrieved successfully.',
    data: summary,
  });
});

export default {
  postApplication,
  listMine,
  getMySummary,
  getApplication,
  listForOpportunity,
  patchApplicationStatus,
  getRecruitmentTotals,
};
