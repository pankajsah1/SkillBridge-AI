/**
 * Centralised environment configuration.
 *
 * Every other module imports `env` from here instead of touching
 * `process.env` directly. That keeps defaults in one place and makes it
 * obvious which variables the app actually depends on.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// src/config/env.js -> ../../.env  == server/.env
dotenv.config({ path: path.resolve(currentDir, '../../.env') });

const toNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toNumber(process.env.PORT, 5000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || '',
};

export const isDevelopment = env.nodeEnv === 'development';
export const isProduction = env.nodeEnv === 'production';

/**
 * Variables the app cannot sensibly run without.
 * Add to this list as later steps introduce new secrets (e.g. JWT_SECRET).
 */
const REQUIRED_VARS = ['MONGODB_URI'];

/**
 * Warns about missing configuration at startup instead of failing with a
 * confusing error deep inside a request. Returns the list of missing keys.
 */
export const validateEnv = () => {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(
      `[env] Missing required variable(s): ${missing.join(', ')}\n` +
        '[env] Copy server/.env.example to server/.env and fill in the values.',
    );
  }

  return missing;
};

export default env;
