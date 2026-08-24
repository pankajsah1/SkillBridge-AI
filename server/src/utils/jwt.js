/**
 * JWT signing and verification.
 *
 * Kept separate from the auth middleware so token concerns live in one file and
 * the middleware stays about request handling.
 */

import jwt from 'jsonwebtoken';

import env from '../config/env.js';
import AppError from './AppError.js';

/**
 * Fails loudly and immediately if the secret is absent.
 *
 * The dangerous alternative is a fallback default like `|| 'secret'`, which
 * would let the app boot and happily issue tokens that anyone who has read the
 * source can forge. Refusing to sign is the safe failure.
 */
const requireSecret = () => {
  if (!env.jwtSecret) {
    throw AppError.internal(
      'JWT_SECRET is not configured. Set it in server/.env before using authentication.',
    );
  }
  return env.jwtSecret;
};

/**
 * Signs an access token.
 *
 * Payload is exactly `{ userId, role }` per TRD.md section 6.3, which also
 * warns: never include passwords, sensitive personal data, or full profiles.
 * A JWT is signed but NOT encrypted — anyone holding it can read the payload.
 *
 * The `role` claim is a convenience for the client. Authorization never trusts
 * it: authMiddleware re-reads the user from the database on every request, so
 * a role change or deactivation takes effect immediately rather than lingering
 * until the token expires.
 */
export const signToken = ({ userId, role }) =>
  jwt.sign({ userId, role }, requireSecret(), {
    expiresIn: env.jwtExpiresIn,
  });

/**
 * Verifies a token and returns its payload.
 *
 * Translates the library's error types into our own 401s so callers never have
 * to know about jsonwebtoken internals, and so the client gets a message it
 * can act on ("session expired" is actionable; "JsonWebTokenError" is not).
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, requireSecret());
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw AppError.unauthorized('Your session has expired. Please log in again.');
    }
    if (error.name === 'JsonWebTokenError') {
      throw AppError.unauthorized('Invalid authentication token.');
    }
    throw error; // e.g. our own AppError from requireSecret()
  }
};

/**
 * Pulls the token out of an `Authorization: Bearer <token>` header.
 * Returns null when the header is absent or malformed, letting the caller
 * decide whether that is an error (it is, for protected routes).
 */
export const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') return null;

  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  if (!token || !token.trim()) return null;

  return token.trim();
};

export default { signToken, verifyToken, extractBearerToken };
