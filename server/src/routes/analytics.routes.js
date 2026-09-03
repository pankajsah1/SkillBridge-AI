/**
 * Analytics routes — `${API_PREFIX}/analytics`.
 *
 * The last mount the router comment has been promising since Step 1.
 *
 * ONE ROLE PER ROUTE, NOT ONE ROLE PER FILE. `router.use(authenticate)` covers
 * everything, but the role guard sits on each route, because the routes here will
 * not share an audience: an institution's cohort analytics are for INSTITUTION,
 * and anything later for an employer or an admin would be a different guard on the
 * same router. Guarding the whole file now would have to be undone then.
 *
 * NO PARAMETERS, ON PURPOSE. Every figure is scoped to `req.user.id` inside the
 * service, so there is no id for a caller to tamper with and nothing for a
 * validator to check.
 */

import { Router } from 'express';

import ROLES from '../constants/roles.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import {
  getInstitutionIntelligenceReport,
  getInstitutionOverview,
} from '../controllers/analytics.controller.js';

const analyticsRoutes = Router();

analyticsRoutes.use(authenticate);

analyticsRoutes.get('/institution', allowRoles(ROLES.INSTITUTION), getInstitutionOverview);

/* A static path, so its position relative to `/institution` does not matter — but
   it is a separate route rather than a `?detail=` flag on the one above, because
   the dashboard and the intelligence page are two screens with two payload sizes
   and one of them should not pay for the other. */
analyticsRoutes.get(
  '/institution/intelligence',
  allowRoles(ROLES.INSTITUTION),
  getInstitutionIntelligenceReport,
);

export default analyticsRoutes;
