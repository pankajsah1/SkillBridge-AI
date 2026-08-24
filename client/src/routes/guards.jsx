/**
 * Guards that gate routes on authentication and role.
 *
 * IMPORTANT — what these do and do not do.
 *
 * These are navigation and UX only. They stop someone from landing on a page
 * that would be empty or confusing for them. They are NOT a security boundary:
 * all of this runs in the browser, where anyone can edit the JavaScript, the
 * React state, or their localStorage entry.
 *
 * The real boundary is the server. Every protected endpoint runs `authenticate`
 * and `allowRoles(...)`, and authorisation is decided from the live database
 * record rather than the token's claims. A student who forces their way to
 * /industry sees a shell whose API calls all come back 403.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { homePathForRole } from '../constants/roles.js';
import { FullPageLoader } from '../components/ui/Spinner.jsx';

/**
 * Requires a signed-in user.
 *
 * Waits for the boot-time token check before deciding — redirecting during
 * `isInitialising` would bounce a perfectly valid session to the login page on
 * every refresh.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isInitialising } = useAuth();
  const location = useLocation();

  if (isInitialising) return <FullPageLoader message="Restoring your session…" />;

  if (!isAuthenticated) {
    // `state.from` lets the login page return them to where they were headed.
    // `replace` keeps the blocked URL out of history, so Back does not bounce
    // between login and the guarded page.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/**
 * Requires one of `allowedRoles` on top of authentication.
 *
 * Mirrors the backend's allowRoles() so the UI and the API agree on who belongs
 * where — but see the note above: the backend copy is the one that matters.
 */
export function RoleRoute({ allowedRoles = [] }) {
  const { isAuthenticated, isInitialising, role } = useAuth();
  const location = useLocation();

  if (isInitialising) return <FullPageLoader message="Restoring your session…" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(role)) {
    // Sent to /unauthorized rather than silently home, so the reason is visible
    // instead of looking like a broken link. `attemptedPath` lets that page say
    // what was refused.
    return <Navigate to="/unauthorized" replace state={{ attemptedPath: location.pathname }} />;
  }

  return <Outlet />;
}

/**
 * The inverse guard, for /login and /register.
 *
 * Someone already signed in has no use for these pages, so send them to their
 * dashboard. Without this, logging in then pressing Back shows a login form to
 * a logged-in user.
 */
export function PublicOnlyRoute() {
  const { isAuthenticated, isInitialising, role } = useAuth();

  if (isInitialising) return <FullPageLoader message="Restoring your session…" />;

  if (isAuthenticated) return <Navigate to={homePathForRole(role)} replace />;

  return <Outlet />;
}

export default ProtectedRoute;
