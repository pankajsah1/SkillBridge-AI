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

  /**
   * Auth (Step 2).
   *
   * `jwtSecret` has no fallback on purpose. A default like 'secret' would let
   * the app boot and issue forgeable tokens; utils/jwt.js refuses to sign
   * without a real value instead.
   *
   * 7d is our choice, not the docs' — TRD.md section 42 declares
   * JWT_EXPIRES_IN with an empty value and never specifies one. Long enough
   * that a hackathon demo never logs out mid-presentation, short enough that a
   * leaked token is not permanent.
   */
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  /**
   * Optional generative-AI layer (TRD section "Optional Generative AI Layer").
   *
   * Deliberately NOT in REQUIRED_VARS. The assessment engine has a deterministic
   * question bank and every AI path falls back to it, so a missing key must be a
   * non-event: the app boots, the demo runs, nothing 500s. Anything that would
   * make the app refuse to start without a key belongs somewhere else.
   */
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    apiUrl: process.env.AI_API_URL || '',
    model: process.env.AI_MODEL || '',
    /** A slow provider must not hold a student on a spinner. */
    timeoutMs: toNumber(process.env.AI_TIMEOUT_MS, 12000),
  },
};

export const isDevelopment = env.nodeEnv === 'development';
export const isProduction = env.nodeEnv === 'production';

/**
 * True only when all three AI variables are present. Read at call time, not at
 * import time, so a `.env` edit takes effect on a server restart rather than
 * being baked into a module constant that is hard to reason about in a demo.
 *
 * A partially-configured provider counts as unconfigured. A URL with no key
 * would produce a 401 from the provider on every attempt — silently using the
 * question bank is the better failure.
 */
export const isAiConfigured = () =>
  Boolean(env.ai.apiKey) && Boolean(env.ai.apiUrl) && Boolean(env.ai.model);

/**
 * Variables the app cannot sensibly run without.
 *
 * JWT_SECRET joined this list in Step 2. Without it, authentication cannot
 * issue or verify tokens at all, so a missing value is worth shouting about at
 * startup rather than discovering on the first login attempt.
 */
const REQUIRED_VARS = ['MONGODB_URI', 'JWT_SECRET'];

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
