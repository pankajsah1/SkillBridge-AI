/**
 * API router — the single mount point for every versioned route.
 *
 * app.js mounts this at `env.apiPrefix` (default `/api/v1`), so paths added
 * here are automatically versioned. Later steps append their routers to the
 * `mounts` list below; nothing else needs to change.
 */

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';

const router = Router();

/** [mountPath, router] — kept as data so the list stays easy to scan. */
const mounts = [
  ['/health', healthRoutes],
  ['/auth', authRoutes],
  // Later steps add: /students, /industries, /skills, /opportunities,
  //                  /applications, /assessments, /recommendations, /analytics
];

for (const [mountPath, subRouter] of mounts) {
  router.use(mountPath, subRouter);
}

export default router;
