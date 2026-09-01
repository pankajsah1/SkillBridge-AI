/**
 * Academician routes, mounted at `${API_PREFIX}/academicians` by routes/index.js.
 *
 * PATH NAMING MIRRORS `/students` DELIBERATELY. Step 7 sketched paths like
 * `POST /academician/profile` but also said "Adapt exact endpoint names to the
 * existing route conventions. Do NOT blindly use these exact paths if the repository
 * has a different established naming convention" — so the repository wins. Every
 * segment below has a student counterpart at the same depth: `/profile`,
 * `/profile/skills/:skillId`, `/profile/completion`, `/matches`,
 * `/matches/:opportunityId`. A frontend developer who has wired the student pages
 * already knows the shape of these, and the plural mount matches `/students`,
 * `/skills`, `/opportunities` and `/applications`.
 *
 * THERE ARE NO OPPORTUNITY ROUTES HERE, ON PURPOSE. Step 7's Phase 4 asks that
 * academicians browse opportunities available to them, and that already works:
 * `GET /opportunities` and `GET /opportunities/:id` are deliberately not role-gated,
 * and the controller scopes each response with `audienceForRole(req.user.role)`, so an
 * academician hitting the existing list gets academician-facing postings without a
 * line of new code. Adding `/academicians/opportunities` would be the parallel
 * implementation the brief forbids, and it would be a second place for the
 * availability rule to drift.
 *
 * Middleware order on every route is the same and is not optional:
 *
 *   authenticate -> allowRoles(ROLES.ACADEMICIAN) -> [validate] -> controller
 *
 * authenticate first so an anonymous request gets 401, not 403 — they mean different
 * things and the client reacts differently (401 sends you to login). allowRoles next
 * so a STUDENT or INDUSTRY user is rejected before any validation work. Validation
 * last, because there is no point checking a body the caller was never allowed to
 * send.
 *
 * `router.use()` applies the first two to every route in this file, so a route added
 * later cannot accidentally ship unprotected — the secure default is the one you get
 * by doing nothing.
 */

import { Router } from 'express';

import {
  createAchievement,
  createEducation,
  createExperience,
  createExpertise,
  createProfile,
  deleteAchievement,
  deleteEducation,
  deleteExperience,
  deleteExpertise,
  getCompletion,
  getDashboard,
  getMatches,
  getOpportunityMatch,
  getProfile,
  patchAchievement,
  patchEducation,
  patchExperience,
  updateExpertise,
  updateProfile,
} from '../controllers/academician.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../constants/roles.js';
import {
  validateObjectIdParam,
  validateOptionalLimitQuery,
} from '../validators/studentProfile.validator.js';
import {
  validateAddExpertise,
  validateCreateAcademicianProfile,
  validateCreateAchievement,
  validateCreateEducation,
  validateCreateExperience,
  validateUpdateAcademicianProfile,
  validateUpdateAchievement,
  validateUpdateEducation,
  validateUpdateExperience,
  validateUpdateExpertise,
} from '../validators/academician.validator.js';

const router = Router();

/**
 * Applies to every route below. Academicians only — this is the authorization
 * boundary, and the React route guard is only a mirror of it for user experience.
 *
 * Because it is declared once here, the Phase 9 rules hold for the whole file at
 * once: a student cannot reach an academician profile route, and an industry user
 * cannot edit an academician's profile, without any route repeating the check.
 */
router.use(authenticate, allowRoles(ROLES.ACADEMICIAN));

// ------------------------------------------------------------------- profile
// No route on this mount accepts a user id or a profile id, so every handler can
// only ever reach the caller's own profile via `req.user.id`. "An academician must
// only be able to edit their own profile" is therefore structural, not a check.
router
  .route('/profile')
  .get(getProfile)
  .post(validateCreateAcademicianProfile, createProfile)
  .patch(validateUpdateAcademicianProfile, updateProfile);

// Its own endpoint because the completion panel refreshes after every edit and does
// not need the whole profile payload to do it. Declared before any `/profile/...`
// pattern with a parameter would be, though none exists — the ordering rule still
// holds if one is added later.
router.get('/profile/completion', getCompletion);

// ----------------------------------------------------------------- expertise
// Catalogue-backed skills, the same reference the student side stores, which is what
// lets one matching engine score both without knowing who it is scoring. There is no
// GET here: the profile response already carries the populated skill list, and a
// second endpoint returning the same array would be one more thing to keep in step.
router.route('/profile/skills').post(validateAddExpertise, createExpertise);

router
  .route('/profile/skills/:skillId')
  .patch(validateObjectIdParam('skillId'), validateUpdateExpertise, updateExpertise)
  .delete(validateObjectIdParam('skillId'), deleteExpertise);

// ----------------------------------------------------------------- education
router.route('/profile/education').post(validateCreateEducation, createEducation);

router
  .route('/profile/education/:entryId')
  .patch(validateObjectIdParam('entryId'), validateUpdateEducation, patchEducation)
  .delete(validateObjectIdParam('entryId'), deleteEducation);

// ---------------------------------------------------------------- experience
// Academic posts and industry stints both live here — `isIndustry` on the entry is
// what makes an academician's industry exposure visible to a company reviewing a
// collaboration, which is the whole point of the field.
router.route('/profile/experiences').post(validateCreateExperience, createExperience);

router
  .route('/profile/experiences/:entryId')
  .patch(validateObjectIdParam('entryId'), validateUpdateExperience, patchExperience)
  .delete(validateObjectIdParam('entryId'), deleteExperience);

// -------------------------------------------------------------- achievements
router.route('/profile/achievements').post(validateCreateAchievement, createAchievement);

router
  .route('/profile/achievements/:entryId')
  .patch(validateObjectIdParam('entryId'), validateUpdateAchievement, patchAchievement)
  .delete(validateObjectIdParam('entryId'), deleteAchievement);

// ----------------------------------------------------------------- dashboard
// One request for every card, following `GET /industry/summary` and the institution
// analytics endpoint. Read-only and derived: nothing here is stored, so no figure can
// go stale against the data it summarises.
router.get('/dashboard', getDashboard);

// ------------------------------------------------------------------- matching
// The academician's ranked list and the breakdown behind one posting. This lives on
// this mount rather than under /opportunities because the answer is about *this*
// academician — the subject is `req.user.id`, so one academician cannot ask for
// another's matches.
//
// NOTE ON PATH ORDER: `/matches` is declared before `/matches/:opportunityId`. The
// two cannot collide at different segment depths, but keeping literal paths ahead of
// parameterised ones is the rule the rest of the app follows, and it is the rule that
// stops a future `/matches/summary` from being read as an id.
router.get('/matches', validateOptionalLimitQuery({ min: 1, max: 20 }), getMatches);

router.get(
  '/matches/:opportunityId',
  validateObjectIdParam('opportunityId'),
  getOpportunityMatch,
);

export default router;
