/**
 * Coach routes — `${API_PREFIX}/coach`.
 *
 * The explainability surface: a student's AI Coach, every role's Action Center, and
 * the grounded "why does this opportunity fit?" breakdown.
 *
 * MIDDLEWARE ORDER IS THE AUTHORIZATION DESIGN, exactly as learning.routes.js:
 * `authenticate -> allowRoles -> validateObjectIdParam -> controller`.
 *
 *   authenticate  first, so an anonymous request is 401 not 403.
 *   allowRoles    second, from the DATABASE role, never the token claim.
 *   validate      third, so the controller only sees a well-formed request.
 *
 * NO NEW ROLE, NO NEW PERMISSION SYSTEM (§4, §17). The coach reads a StudentProfile,
 * so `/explanations` is STUDENT-only; `/next-actions` is open to every signed-in
 * role because the service scopes its own source by `req.user.role`; the match
 * explanation is for applicants (STUDENT, ACADEMICIAN), the only roles with a match.
 *
 * OWNERSHIP IS NOT IN THIS FILE. Every figure is scoped to `req.user.id` inside the
 * services, so there is no id a caller could supply to see someone else's coach.
 */

import { Router } from 'express';

import ROLES, { APPLICANT_ROLE_VALUES } from '../constants/roles.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { getCoach, getNextActions, getWhyOpportunity } from '../controllers/coach.controller.js';
import { validateObjectIdParam } from '../validators/studentProfile.validator.js';

const coachRoutes = Router();

coachRoutes.use(authenticate);

/* The student AI Coach — grounded answers to the fixed employability question set. */
coachRoutes.get('/explanations', allowRoles(ROLES.STUDENT), getCoach);

/* The Action Center. Open to every role; the service chooses the source. */
coachRoutes.get('/next-actions', getNextActions);

/* Why one posting fits — applicants only, the roles that have a match to explain. */
coachRoutes.get(
  '/opportunities/:id/why',
  allowRoles(...APPLICANT_ROLE_VALUES),
  validateObjectIdParam('id'),
  getWhyOpportunity,
);

export default coachRoutes;
