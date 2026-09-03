/**
 * Learning routes — `${API_PREFIX}/learning`.
 *
 * ONE ROUTER, ONE MOUNT. The publisher's own-catalogue view lives on the shared
 * `/industry` router in opportunity.routes.js instead of here; the note above its export
 * at the bottom of this file explains why.
 *
 * MIDDLEWARE ORDER IS THE AUTHORIZATION DESIGN:
 * `authenticate -> allowRoles -> validateObjectIdParam -> validateBody -> controller`.
 *
 *   authenticate  first, so an anonymous request gets 401 rather than 403.
 *   allowRoles    second, so a wrong role is refused before a body is parsed for meaning.
 *                 The role is read from the database inside authenticate, never from the
 *                 token claim, so a user demoted after their token was issued cannot keep
 *                 writing.
 *   validate      third, so the controller only ever sees a well-formed request.
 *   controller    last, containing no role or ownership logic at all.
 *
 * NO NEW ROLE AND NO NEW PERMISSION SYSTEM. Publishing is `ROLES.INDUSTRY`, which is what
 * docs/rules.md 5.2 already gives industry users; enrolling is STUDENT or ACADEMICIAN via
 * `LEARNER_ROLE_VALUES`, derived from the existing `ROLES`; recommendations are STUDENT
 * only because they are computed from a StudentProfile that nobody else has.
 *
 * OWNERSHIP IS NOT IN THIS FILE, deliberately. `allowRoles(ROLES.INDUSTRY)` proves the
 * caller is *an* industry user; it cannot prove they own programme X. That check is
 * structural in the services, where every owner-scoped and learner-scoped query filters on
 * `req.user.id`. Splitting it this way is what makes "student B updates student A's
 * enrolment" unexpressible rather than merely rejected.
 */

import { Router } from 'express';

import ROLES from '../constants/roles.js';
import { LEARNER_ROLE_VALUES } from '../constants/learning.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import {
  browseLearningPrograms,
  getLearningProgram,
  getLearningRecommendations,
  getLearningSummary,
  getMyEnrollment,
  listMyLearning,
  patchEnrollment,
  patchLearningProgram,
  postEnrollment,
  postLearningProgram,
  removeLearningProgram,
} from '../controllers/learning.controller.js';
import { validateObjectIdParam } from '../validators/studentProfile.validator.js';
import {
  validateCreateLearningProgram,
  validateEnroll,
  validateEnrollmentQuery,
  validateEnrollmentUpdate,
  validateLearningProgramQuery,
  validateRecommendationQuery,
  validateUpdateLearningProgram,
} from '../validators/learning.validator.js';

const learningRoutes = Router();

// Every route in this file needs a signed-in caller. router.use() applies it to each one,
// so a route added later cannot accidentally ship unprotected.
learningRoutes.use(authenticate);

/**
 * `/learning/recommendations` — registered BEFORE `/programs/:id` for readability only;
 * they share no prefix, so the order is not a hazard here. STUDENT-only because the whole
 * computation reads a StudentProfile's skills and target roles.
 */
learningRoutes.get(
  '/recommendations',
  allowRoles(ROLES.STUDENT),
  validateRecommendationQuery,
  getLearningRecommendations,
);

/**
 * Browse is not role-gated: students, academicians and publishers all see the same
 * published catalogue, so a role check would add nothing but a second list of roles.
 * Creating is INDUSTRY-only.
 */
learningRoutes
  .route('/programs')
  .get(validateLearningProgramQuery, browseLearningPrograms)
  .post(allowRoles(ROLES.INDUSTRY), validateCreateLearningProgram, postLearningProgram);

learningRoutes
  .route('/programs/:id')
  .get(validateObjectIdParam('id'), getLearningProgram)
  .patch(
    allowRoles(ROLES.INDUSTRY),
    validateObjectIdParam('id'),
    validateUpdateLearningProgram,
    patchLearningProgram,
  )
  .delete(allowRoles(ROLES.INDUSTRY), validateObjectIdParam('id'), removeLearningProgram);

/**
 * ENROLMENT IS LEARNER-ONLY as a whole subtree, so there is no path through it for an
 * industry user: the only list it can produce is scoped to the authenticated learner.
 *
 * `/summary` IS REGISTERED BEFORE `/:id` AND THAT ORDER IS LOAD-BEARING. Express matches
 * in registration order, so the reverse would send `/enrollments/summary` into the detail
 * handler, where `validateObjectIdParam` would reject "summary" as a malformed id — a 400
 * on the dashboard card, from nothing but two lines being the wrong way round.
 */
learningRoutes
  .route('/enrollments')
  .get(allowRoles(...LEARNER_ROLE_VALUES), validateEnrollmentQuery, listMyLearning)
  .post(allowRoles(...LEARNER_ROLE_VALUES), validateEnroll, postEnrollment);

learningRoutes.get('/enrollments/summary', allowRoles(...LEARNER_ROLE_VALUES), getLearningSummary);

learningRoutes
  .route('/enrollments/:id')
  .get(allowRoles(...LEARNER_ROLE_VALUES), validateObjectIdParam('id'), getMyEnrollment)
  .patch(
    allowRoles(...LEARNER_ROLE_VALUES),
    validateObjectIdParam('id'),
    validateEnrollmentUpdate,
    patchEnrollment,
  );

/**
 * THE PUBLISHER'S MANAGEMENT VIEW IS NOT IN THIS FILE, and that is deliberate.
 * `GET ${API_PREFIX}/industry/learning-programs` is registered on the shared
 * `industryRoutes` router in opportunity.routes.js, next to `/industry/opportunities` and
 * `/industry/applications/summary`.
 *
 * WHY NOT A SECOND `/industry` ROUTER EXPORTED FROM HERE. Express would mount both and try
 * them in order, so every `/industry/learning-programs` request would run `authenticate`
 * and `allowRoles` twice — two user lookups per call — and "no prefix is mounted twice" is
 * an invariant the analytics suite already checks, because a double mount is usually an
 * accident. That shared router is also already the established home for another feature's
 * owner surface: it imports from application.controller.js for the same reason this
 * imports from learning.controller.js. One base path, one auth pass, no new pattern.
 */
export default learningRoutes;
