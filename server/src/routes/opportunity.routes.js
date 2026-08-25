/**
 * Opportunity routes — `${API_PREFIX}/opportunities` and `${API_PREFIX}/industry`.
 *
 * Both mount points come from TRD.md section 31 and section 39. Exported
 * separately so routes/index.js keeps its flat, scannable `mounts` list — the same
 * two-router shape catalogue.routes.js uses.
 *
 * MIDDLEWARE ORDER IS THE AUTHORIZATION DESIGN, and it is
 * `authenticate -> allowRoles -> validate -> controller` on every write, exactly
 * as his section 3 specifies:
 *
 *   authenticate  first, so an anonymous request gets 401 rather than 403 — "who
 *                 are you?" has to be answered before "may you?"
 *   allowRoles    second, so a STUDENT is refused before any body is parsed for
 *                 meaning. The role is read from the database inside
 *                 authenticate, never from the token claim, so a user demoted
 *                 after their token was issued cannot keep writing.
 *   validate      third, so the controller only ever sees a well-formed body.
 *   controller    last, and it contains no role or ownership logic at all.
 *
 * OWNERSHIP IS NOT IN THIS FILE, deliberately. `allowRoles(ROLES.INDUSTRY)` proves
 * the caller is *an* industry user; it cannot prove they own row X. That check is
 * structural in the service, where every owner-scoped query filters on
 * `req.user.id`. Splitting it this way is what makes "industry B edits industry
 * A's posting" unexpressible rather than merely rejected.
 *
 * WHY THE READ ROUTES ARE AUTHENTICATED. TRD.md section 35 lists Browse
 * Opportunities under "Public Pages", but the catalogue routes set the precedent
 * of requiring a token for non-sensitive reads, and Step 2 already redirects
 * anonymous visitors to login. Keeping the API's default closed is the habit worth
 * having, and it costs a student nothing since they must sign in to reach the page.
 * No role gate on the reads, though: an INDUSTRY user viewing their own posting
 * goes through the same detail endpoint.
 */

import { Router } from 'express';

import ROLES from '../constants/roles.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import {
  browseOpportunities,
  getOpportunity,
  listMyOpportunities,
  patchOpportunity,
  postOpportunity,
  removeOpportunity,
} from '../controllers/opportunity.controller.js';
import { validateObjectIdParam } from '../validators/studentProfile.validator.js';
import { listForOpportunity } from '../controllers/application.controller.js';
import { validateApplicationQuery } from '../validators/application.validator.js';
import {
  validateCreateOpportunity,
  validateOpportunityQuery,
  validateUpdateOpportunity,
} from '../validators/opportunity.validator.js';

export const opportunityRoutes = Router();

// Every route in this file needs a signed-in caller. router.use() applies it to
// each one, so a route added later cannot accidentally ship unprotected.
opportunityRoutes.use(authenticate);

opportunityRoutes
  .route('/')
  .get(validateOpportunityQuery, browseOpportunities)
  .post(allowRoles(ROLES.INDUSTRY), validateCreateOpportunity, postOpportunity);

opportunityRoutes
  .route('/:id')
  .get(validateObjectIdParam('id'), getOpportunity)
  .patch(
    allowRoles(ROLES.INDUSTRY),
    validateObjectIdParam('id'),
    validateUpdateOpportunity,
    patchOpportunity,
  )
  .delete(allowRoles(ROLES.INDUSTRY), validateObjectIdParam('id'), removeOpportunity);

/**
 * The applicant list for one posting.
 *
 * Hung off /opportunities/:id rather than given a mount of its own, because that
 * is the resource it belongs to — and Express reads `/:id/applications` as a
 * distinct path from `/:id` above, so the order of the two is not a hazard.
 *
 * `allowRoles(ROLES.INDUSTRY)` proves the caller is an employer. It cannot prove
 * they posted this job; application.service.js checks that by loading the
 * opportunity and testing `isOwnedBy`, so one company can never read another's
 * applicants.
 */
opportunityRoutes.get(
  '/:id/applications',
  allowRoles(ROLES.INDUSTRY),
  validateObjectIdParam('id'),
  validateApplicationQuery,
  listForOpportunity,
);

/**
 * `${API_PREFIX}/industry` — the owner's management view (TRD.md section 39).
 *
 * INDUSTRY-only for the whole router, so there is no path through it for a
 * student, and no way to list another company's postings: the only list it can
 * produce is scoped to the authenticated caller.
 */
export const industryRoutes = Router();

industryRoutes.use(authenticate, allowRoles(ROLES.INDUSTRY));

industryRoutes.get('/opportunities', validateOpportunityQuery, listMyOpportunities);

export default { opportunityRoutes, industryRoutes };
