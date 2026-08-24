/**
 * 404 page for any unmatched route.
 *
 * Sends signed-in users to their own dashboard and everyone else to login, so
 * the way out is always one click and never a dead end.
 */

import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { homePathForRole } from '../constants/roles.js';

export default function NotFound() {
  const { isAuthenticated, user } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-medium text-primary-700">404</p>

        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          We could not find that page
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          The link may be out of date, or the feature may not be built yet.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to={isAuthenticated ? homePathForRole(user?.role) : '/login'}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            {isAuthenticated ? 'Back to my dashboard' : 'Go to login'}
          </Link>
          <Link
            to="/status"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            System status
          </Link>
        </div>
      </div>
    </main>
  );
}
