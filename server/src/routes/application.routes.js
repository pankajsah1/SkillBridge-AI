/**
 * /api/v1/applications
 *
 * TWO ROLES ON ONE MOUNT, so this file cannot use the single file-wide
 * `allowRoles` guard that student.routes.js does. Students create and read their
 * own applications; employers move them along. `authenticate` still applies to
 * the whole file — the split is only about *which* signed-in role, never about
 * whether a route is protected at all.
 *
 * LITERAL PATHS ARE LISTED BEFORE `/:id`. Without that, a GET of `/me` would be
 * read as an id called "me" and answered with a 400 from the ObjectId validator
 * instead of the student's list. Route order is the only thing preventing it, so
 * it is not to be tidied alphabetically.
 *
 * OWNERSHIP IS NOT IN THIS FILE, deliberately — the same rule as
 * opportunity.routes.js. `allowRoles(ROLES.STUDENT)` proves the caller is *a*
 * student, not that application X is theirs; `allowRoles(ROLES.INDUSTRY)` proves
 * the caller is *an* employer, not that they posted the job. Both of those checks
 * are structural in application.service.js, where every query filters on the id
 * from the token.
 */

import { Router } from 'express';

import ROLES from '../constants/roles.js';
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

/* Students only: applying is something a student does for themselves. */
router.post('/', allowRoles(ROLES.STUDENT), validateCreateApplication, postApplication);

router.get('/me', allowRoles(ROLES.STUDENT), validateApplicationQuery, listMine);

router.get('/summary', allowRoles(ROLES.STUDENT), getMySummary);

/* Employers only: a student cannot advance their own application. */
router.patch(
  '/:id/status',
  allowRoles(ROLES.INDUSTRY),
  validateObjectIdParam('id'),
  validateStatusUpdate,
  patchApplicationStatus,
);

router.get('/:id', allowRoles(ROLES.STUDENT), validateObjectIdParam('id'), getApplication);

export default router;
