/**
 * Health check controller.
 *
 * Deliberately dependency-light: it must succeed even when MongoDB is down,
 * because its job is to *report* that condition rather than fail with it.
 */

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getDatabaseStatus, isDatabaseConnected } from '../config/db.js';
import { env } from '../config/env.js';

/**
 * GET /api/v1/health
 * Reports API liveness plus current database connectivity.
 */
export const getHealth = asyncHandler(async (req, res) => {
  const database = getDatabaseStatus();

  return sendSuccess(res, {
    message: 'SkillBridge AI API is running',
    data: {
      status: 'ok',
      environment: env.nodeEnv,
      apiVersion: 'v1',
      database,
      databaseConnected: isDatabaseConnected(),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

export default getHealth;
