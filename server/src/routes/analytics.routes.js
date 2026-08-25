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
import { getInstitutionOverview } from '../controllers/analytics.controller.js';

const analyticsRoutes = Router();

analyticsRoutes.use(authenticate);

analyticsRoutes.get('/institution', allowRoles(ROLES.INSTITUTION), getInstitutionOverview);

export default analyticsRoutes;
