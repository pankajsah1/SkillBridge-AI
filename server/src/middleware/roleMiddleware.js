/**
 * Role-based access control.
 *
 * TRD.md section 6.4 defines the flow:
 *   Request -> JWT Authentication -> Extract User -> Check Role -> Allow or Deny
 *
 * So this always runs *after* authenticate, never instead of it. Order matters
 * on the router: authenticate first (401 if unknown), then allowRoles (403 if
 * known but not permitted). 401 and 403 mean different things and clients
 * behave differently — 401 should send you to the login page, 403 should not.
 *
 * RULES.md section 6 is emphatic: "Authorization must always be enforced on the
 * backend. Frontend restrictions are for user experience only and must never be
 * considered a security mechanism." The React route guards mirror these checks
 * for UX; this file is the real boundary.
 */

import AppError from '../utils/AppError.js';
import { isValidRole } from '../constants/roles.js';

/**
 * Restricts a route to the given roles.
 *
 *   router.get('/students/me', authenticate, allowRoles(ROLES.STUDENT), handler);
 *   router.post('/opportunities', authenticate, allowRoles(ROLES.INDUSTRY, ROLES.ADMIN), handler);
 *
 * The role is read from `req.user`, which authenticate populated from the
 * database — not from the JWT payload. A token cannot claim its way past this.
 *
 * Unknown role names throw at startup rather than silently denying everyone,
 * which is how a typo like allowRoles('STUDNET') would otherwise reach
 * production as a mysterious 403.
 */
export const allowRoles = (...allowedRoles) => {
  const invalid = allowedRoles.filter((role) => !isValidRole(role));
  if (invalid.length > 0) {
    throw new Error(
      `allowRoles() received unknown role(s): ${invalid.join(', ')}. ` +
        'Use the ROLES constants from constants/roles.js.',
    );
  }

  if (allowedRoles.length === 0) {
    throw new Error('allowRoles() requires at least one role.');
  }

  return (req, _res, next) => {
    // Defensive: a 403 here means the route was misconfigured without authenticate.
    if (!req.user?.role) {
      return next(AppError.unauthorized('Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      /**
       * Deliberately does not name the required roles. Telling a student that
       * an endpoint needs ADMIN maps the platform's privilege structure for
       * them; the client already knows what it tried to do.
       */
      return next(
        AppError.forbidden('You do not have permission to access this resource.'),
      );
    }

    return next();
  };
};

export default allowRoles;
