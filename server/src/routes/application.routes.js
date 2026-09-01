/**
 * /api/v1/applications
 *
 * TWO KINDS OF CALLER ON ONE MOUNT, so this file cannot use the single file-wide
 * `allowRoles` guard that student.routes.js does. Applicants — students and, since
 * Step 7, academicians — create and read their own applications; employers move
 * them along. `authenticate` still applies to the whole file — the split is only
 * about *which* signed-in role, never about whether a route is protected at all.
 *
 * LITERAL PATHS ARE LISTED BEFORE `/:id`. Without that, a GET of `/me` would be
 * read as an id called "me" and answered with a 400 from the ObjectId validator
 * instead of the applicant's list. Route order is the only thing preventing it, so
 * it is not to be tidied alphabetically.
 *
 * OWNERSHIP IS NOT IN THIS FILE, deliberately — the same rule as
 * opportunity.routes.js. `allowRoles(...APPLICANT_ROLE_VALUES)` proves the caller
 * is *an* applicant, not that application X is theirs; `allowRoles(ROLES.INDUSTRY)`
 * proves the caller is *an* employer, not that they posted the job. Both of those
 * checks are structural in application.service.js, where every query filters on the
 * id from the token.
 */

import { Router } from 'express';

import ROLES, { APPLICANT_ROLE_VALUES } from '../constants/roles.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import {
  getApplication,
  getMySummary,
  listMine,
  patchApplicationStatus,
  postApplication,
} from '../controllers/application.controller.js';
import { validateObjectIdParam } from '../validators/studentProfile.validator.js';
import {
  validateApplicationQuery,
  validateCreateApplication,
  validateStatusUpdate,
} from '../validators/application.validator.js';

const router = Router();

router.use(authenticate);

/**
 * APPLICANTS ONLY — both kinds (Step 7).
 *
 * `APPLICANT_ROLE_VALUES` is STUDENT and ACADEMICIAN, derived in constants/roles.js
 * rather than spelled out here, so the two roles that can hold an application are
 * defined in exactly one place. An academician registering for a faculty programme
 * creates one of these documents, so refusing them at the route would have meant a
 * second parallel endpoint doing the same thing.
 *
 * WIDENING THE GATE IS NOT WEAKENING IT. Industry, institution and admin are still
 * refused, and *which* postings each applicant may apply to is enforced one layer
 * down: `loadApplicablePosting` compares the posting's audience against the
 * caller's role, so a student reaching this route with a faculty programme id gets
 * a 400 rather than a registration.
 */
router.post(
  '/',
  allowRoles(...APPLICANT_ROLE_VALUES),
  validateCreateApplication,
  postApplication,
);

router.get('/me', allowRoles(...APPLICANT_ROLE_VALUES), validateApplicationQuery, listMine);

router.get('/summary', allowRoles(...APPLICANT_ROLE_VALUES), getMySummary);

/* Employers only: an applicant cannot advance their own application. */
router.patch(
  '/:id/status',
  allowRoles(ROLES.INDUSTRY),
  validateObjectIdParam('id'),
  validateStatusUpdate,
  patchApplicationStatus,
);

router.get(
  '/:id',
  allowRoles(...APPLICANT_ROLE_VALUES),
  validateObjectIdParam('id'),
  getApplication,
);

export default router;
