/**
 * API router — the single mount point for every versioned route.
 *
 * app.js mounts this at `env.apiPrefix` (default `/api/v1`), so paths added
 * here are automatically versioned. Later steps append their routers to the
 * `mounts` list below; nothing else needs to change.
 */

import { Router } from 'express';
import applicationRoutes from './application.routes.js';
import assessmentRoutes from './assessment.routes.js';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import studentRoutes from './student.routes.js';
import { careerRoleRoutes, skillRoutes } from './catalogue.routes.js';
import { industryRoutes, opportunityRoutes } from './opportunity.routes.js';

const router = Router();

/** [mountPath, router] — kept as data so the list stays easy to scan. */
const mounts = [
  ['/health', healthRoutes],
  ['/auth', authRoutes],
  ['/students', studentRoutes],
  ['/skills', skillRoutes],
  ['/career-roles', careerRoleRoutes],
  ['/opportunities', opportunityRoutes],
  ['/industry', industryRoutes],
  ['/assessments', assessmentRoutes],
  ['/applications', applicationRoutes],
  // Later steps add: /recommendations, /analytics
];

for (const [mountPath, subRouter] of mounts) {
  router.use(mountPath, subRouter);
}

export default router;
