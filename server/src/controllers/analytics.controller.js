/**
 * Analytics endpoints.
 *
 * READ-ONLY, AND SCOPED BY THE TOKEN. There is no institution id in any path or
 * query: the cohort comes from `req.user.id`, so one college cannot ask for
 * another's numbers by changing a URL. That is the whole authorization story here,
 * and it is why this controller has no parameters to validate.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getInstitutionAnalytics } from '../services/analytics.service.js';
import { getInstitutionIntelligence } from '../services/institutionIntelligence.service.js';

/** GET /api/v1/analytics/institution — the institution dashboard, in one request. */
export const getInstitutionOverview = asyncHandler(async (req, res) => {
  const analytics = await getInstitutionAnalytics(req.user.id);

  return sendSuccess(res, {
    message: 'Institution analytics retrieved successfully.',
    data: analytics,
  });
});

/**
 * GET /api/v1/analytics/institution/intelligence
 *
 * The longer report: demand against supply with a priority and a sentence per
 * skill, what the learning programmes have measurably changed, and what became of
 * the applications. One request, six sections, same token-derived cohort as above.
 */
export const getInstitutionIntelligenceReport = asyncHandler(async (req, res) => {
  const intelligence = await getInstitutionIntelligence(req.user.id);

  return sendSuccess(res, {
    message: 'Institution intelligence retrieved successfully.',
    data: intelligence,
  });
});

export default { getInstitutionOverview, getInstitutionIntelligenceReport };
