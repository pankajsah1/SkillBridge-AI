/**
 * Authentication middleware.
 *
 * Runs before protected handlers, proves who the caller is, and attaches a
 * safe user object to `req.user`. Every rejection produces the standard 401
 * envelope through AppError, so clients see one consistent error shape.
 */

import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { extractBearerToken, verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';

/**
 * Requires a valid JWT belonging to an existing, active user.
 *
 * The database lookup on every request is the important design decision. We
 * could trust the token's payload and skip it — that is faster — but a JWT is
 * a snapshot from signing time. Re-reading the user means a deleted account,
 * a deactivated account, or a changed role takes effect on the very next
 * request instead of lingering until the token expires (up to 7 days).
 *
 * Rejects, each with its own message:
 *   - missing or malformed Authorization header
 *   - invalid signature / expired token   (via verifyToken)
 *   - token valid but user no longer exists
 *   - user exists but isActive === false
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    throw AppError.unauthorized(
      'Authentication required. Provide a Bearer token in the Authorization header.',
    );
  }

  // Throws a 401 AppError for expired/invalid tokens.
  const payload = verifyToken(token);

  if (!payload?.userId) {
    throw AppError.unauthorized('Invalid authentication token.');
  }

  // `password` has select:false, so it is not loaded here.
  const user = await User.findById(payload.userId);

  if (!user) {
    // Token is cryptographically valid but the account is gone.
    throw AppError.unauthorized('This account no longer exists.');
  }

  if (!user.isActive) {
    throw AppError.forbidden('This account has been deactivated.');
  }

  // Safe shape only — no password, ever.
  req.user = user.toSafeObject();
  req.userDocument = user; // for handlers that need the full document

  return next();
});

export default authenticate;
