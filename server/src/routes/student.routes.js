/**
 * Student routes, mounted at `${API_PREFIX}/students` by routes/index.js.
 *
 * Path naming follows TRD.md section 28, which defines `GET /students/profile`
 * and `PATCH /students/profile`. The step brief sketched `/student-profile/me`
 * but also said "If TRD.md defines different route naming, follow TRD.md", so
 * TRD wins. `POST /students/profile` is added because TRD defines no creation
 * route and a profile has to come into existence somehow.
 *
 * Middleware order on every route is the same and is not optional:
 *
 *   authenticate -> allowRoles(ROLES.STUDENT) -> [validate] -> controller
 *
 * authenticate first so an anonymous request gets 401, not 403 — they mean
 * different things and the client reacts differently (401 sends you to login).
 * allowRoles next so an INDUSTRY user is rejected before any validation work.
 * Validation last, because there is no point checking a body the caller was
 * never allowed to send.
 *
 * router.use() applies the first two to every route in this file, so a route
 * added later cannot accidentally ship unprotected — the secure default is the
 * one you get by doing nothing.
 */

import { Router } from 'express';

import {
  createProfile,
  createSkill,
  deleteSkill,
  getProfile,
  getReadiness,
  getSkills,
  updateCareerGoals,
  updateProfile,
  updateSkill,
} from '../controllers/studentProfile.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../constants/roles.js';
import {
  validateAddSkill,
  validateCareerGoals,
  validateCreateProfile,
  validateObjectIdParam,
  validateOptionalObjectIdQuery,
  validateUpdateProfile,
  validateUpdateSkill,
} from '../validators/studentProfile.validator.js';

const router = Router();

/**
 * Applies to every route below. Students only — this is the authorization
 * boundary his section 9 requires, and the React route guard is only a mirror
 * of it for user experience.
 */
router.use(authenticate, allowRoles(ROLES.STUDENT));

// ------------------------------------------------------------------- profile
router
  .route('/profile')
  .get(getProfile)
  .post(validateCreateProfile, createProfile)
  .patch(validateUpdateProfile, updateProfile);

// -------------------------------------------------------------- career goals
// PUT: the body is the complete new selection, replacing whatever was there.
router.put('/profile/career-goals', validateCareerGoals, updateCareerGoals);

// -------------------------------------------------------------------- skills
router.route('/profile/skills').get(getSkills).post(validateAddSkill, createSkill);

router
  .route('/profile/skills/:skillId')
  .patch(validateObjectIdParam('skillId'), validateUpdateSkill, updateSkill)
  .delete(validateObjectIdParam('skillId'), deleteSkill);

// ----------------------------------------------------------------- readiness
// Career readiness and skill gaps against one role. Read-only and derived:
// nothing is stored, so it always reflects the profile as it is right now.
// It lives on this mount rather than a new one because it is the same owner
// (`req.user.id`) behind the same student-only guard applied above.
router.get('/readiness', validateOptionalObjectIdQuery('careerRoleId'), getReadiness);

export default router;
