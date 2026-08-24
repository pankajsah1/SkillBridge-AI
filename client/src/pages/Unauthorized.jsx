/**
 * 403 page — signed in, but this area belongs to a different role.
 *
 * Distinct from the login redirect on purpose: "you are not allowed here" and
 * "we do not know who you are" are different problems with different fixes, and
 * collapsing them into one screen leaves people retyping a password that was
 * never the issue.
 */

import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABELS, homePathForRole } from '../constants/roles.js';

export default function Unauthorized() {
  const { user, role } = useAuth();
  const location = useLocation();

  const attemptedPath = location.state?.attemptedPath;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-warning-50 text-warning-600">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          You do not have access to this area
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          {attemptedPath ? (
            <>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                {attemptedPath}
              </code>{' '}
              is restricted to a different role.
            </>
          ) : (
            'This area is restricted to a different role.'
          )}
          {role ? <> You are signed in as {ROLE_LABELS[role] ?? role}.</> : null}
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to={homePathForRole(user?.role)}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            Back to my dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
