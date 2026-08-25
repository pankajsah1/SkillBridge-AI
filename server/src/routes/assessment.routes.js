/**
 * Assessment routes, mounted at `${API_PREFIX}/assessments` by routes/index.js.
 *
 * Students only. An industry recruiter or an institution admin has no business
 * starting or reading a student's paper, and the applicant-facing views they do
 * need come from the application endpoints instead.
 *
 * Middleware order is the same as everywhere else and is not optional:
 *
 *   authenticate -> allowRoles(ROLES.STUDENT) -> [validate] -> controller
 *
 * ROUTE ORDER MATTERS HERE. `/latest` and `/active` are declared before
 * `/:assessmentId`. Express matches in declaration order, so the reverse would
 * make `/latest` a request for an assessment whose id is the string "latest" —
 * a 400 from the id validator, and a confusing one.
 */

import { Router } from 'express';

import {
  createAssessment,
  discardAssessment,
  getActiveAssessment,
  getAssessment,
  getLatestAssessment,
  listAssessments,
  submitAssessmentAnswers,
} from '../controllers/assessment.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../constants/roles.js';
import {
  validateObjectIdParam,
  validateStartAssessment,
  validateSubmitAssessment,
} from '../validators/assessment.validator.js';

const router = Router();

/** Applies to every route below, so a route added later cannot ship open. */
router.use(authenticate, allowRoles(ROLES.STUDENT));

// ------------------------------------------------------------------ the paper
router.route('/').get(listAssessments).post(validateStartAssessment, createAssessment);

// -------------------------------------------------- fixed paths before params
router.get('/latest', getLatestAssessment);
router.get('/active', getActiveAssessment);

// ------------------------------------------------------------- one attempt
router
  .route('/:assessmentId')
  .get(validateObjectIdParam('assessmentId'), getAssessment)
  .delete(validateObjectIdParam('assessmentId'), discardAssessment);

router.post(
  '/:assessmentId/submit',
  validateObjectIdParam('assessmentId'),
  validateSubmitAssessment,
  submitAssessmentAnswers,
);

export default router;
