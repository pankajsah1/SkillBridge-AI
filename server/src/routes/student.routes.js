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
  getMatches,
  getOpportunityMatch,
  getReadiness,
  getRecommendations,
  getSkills,
  updateCareerGoals,
  updateProfile,
  updateSkill,
} from '../controllers/studentProfile.controller.js';
import {
  createAchievement,
  createCertification,
  createExperience,
  createProject,
  deleteAchievement,
  deleteCertification,
  deleteEntryDocument,
  deleteExperience,
  deleteProject,
  deleteResume,
  downloadDocument,
  getCompletion,
  getPortfolio,
  patchAchievement,
  patchCertification,
  patchExperience,
  patchProject,
  uploadEntryDocument,
  uploadResume,
} from '../controllers/portfolio.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../constants/roles.js';
import {
  validateAddSkill,
  validateCareerGoals,
  validateCreateProfile,
  validateObjectIdParam,
  validateOptionalLimitQuery,
  validateOptionalObjectIdQuery,
  validateUpdateProfile,
  validateUpdateSkill,
} from '../validators/studentProfile.validator.js';
import {
  validateCreateAchievement,
  validateCreateCertification,
  validateCreateExperience,
  validateCreateProject,
  validateDocumentUpload,
  validateStoredFileNameParam,
  validateUpdateAchievement,
  validateUpdateCertification,
  validateUpdateExperience,
  validateUpdateProject,
} from '../validators/portfolio.validator.js';

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

// ------------------------------------------------------------ recommendations
// What to learn next, derived from the same gaps /readiness reports. Also
// read-only and stored nowhere, so it cannot drift from the readiness numbers.
router.get(
  '/recommendations',
  validateOptionalObjectIdQuery('careerRoleId'),
  validateOptionalLimitQuery({ min: 1, max: 10 }),
  getRecommendations,
);

// ------------------------------------------------------------------- matching
// Student-side matching: the ranked list, and the breakdown behind one posting.
// It lives on this mount rather than under /opportunities because the answer is
// about *this* student — the owner is `req.user.id`, so a student cannot ask for
// anyone else's matches. Read-only and stored nowhere, like readiness above.
router.get('/matches', validateOptionalLimitQuery({ min: 1, max: 20 }), getMatches);

router.get(
  '/matches/:opportunityId',
  validateObjectIdParam('opportunityId'),
  getOpportunityMatch,
);

// ------------------------------------------------------------------ portfolio
// The digital portfolio: resume, projects, certifications, achievements,
// experience and the deterministic completion score.
//
// Mounted here rather than as a new top-level `/portfolio` router for one
// concrete reason: it is the same owner behind the same student-only guard
// applied at the top of this file. A separate mount would need its own
// `authenticate` + `allowRoles` pair, and a second copy of a security boundary is
// a second place for it to be wrong.
//
// Middleware order is unchanged and not optional:
//   authenticate -> allowRoles(STUDENT) -> [validate] -> controller
// The first two come from `router.use()` above, so every route below inherits
// them and a route added later cannot ship unprotected.
//
// NOTE ON PATH ORDER: `/portfolio/documents/:fileName` is declared BEFORE the
// `/portfolio/:section/:entryId/document` pattern. Express matches in
// declaration order, and `documents` would otherwise be captured as a `:section`,
// turning every download into a 404.
router.get('/portfolio', getPortfolio);
router.get('/portfolio/completion', getCompletion);

// Downloads. Authenticated, and the service will only resolve a file that the
// caller's own profile actually references — there is deliberately no static
// middleware serving the uploads directory.
router.get(
  '/portfolio/documents/:fileName',
  validateStoredFileNameParam,
  downloadDocument,
);

// The resume is singular and replaced rather than appended: a student has one
// current resume, and uploading again removes the previous file from disk.
router
  .route('/portfolio/resume')
  .post(validateDocumentUpload, uploadResume)
  .delete(deleteResume);

router.route('/portfolio/projects').post(validateCreateProject, createProject);

router
  .route('/portfolio/projects/:projectId')
  .patch(validateObjectIdParam('projectId'), validateUpdateProject, patchProject)
  .delete(validateObjectIdParam('projectId'), deleteProject);

router
  .route('/portfolio/certifications')
  .post(validateCreateCertification, createCertification);

router
  .route('/portfolio/certifications/:certificationId')
  .patch(
    validateObjectIdParam('certificationId'),
    validateUpdateCertification,
    patchCertification,
  )
  .delete(validateObjectIdParam('certificationId'), deleteCertification);

router.route('/portfolio/achievements').post(validateCreateAchievement, createAchievement);

router
  .route('/portfolio/achievements/:achievementId')
  .patch(validateObjectIdParam('achievementId'), validateUpdateAchievement, patchAchievement)
  .delete(validateObjectIdParam('achievementId'), deleteAchievement);

router.route('/portfolio/experiences').post(validateCreateExperience, createExperience);

router
  .route('/portfolio/experiences/:experienceId')
  .patch(validateObjectIdParam('experienceId'), validateUpdateExperience, patchExperience)
  .delete(validateObjectIdParam('experienceId'), deleteExperience);

/**
 * Attaching proof to one record.
 *
 * `:section` is constrained by the regex to the four sections that can carry a
 * document, so an unknown section is a 404 from the router itself rather than
 * something a controller has to police. The section also *determines* the
 * document type — a student cannot attach a certificate to a project — which is
 * what keeps this from being a general-purpose file store.
 */
router
  .route('/portfolio/:section(projects|certifications|achievements|experiences)/:entryId/document')
  .post(validateObjectIdParam('entryId'), validateDocumentUpload, uploadEntryDocument)
  .delete(validateObjectIdParam('entryId'), deleteEntryDocument);

export default router;