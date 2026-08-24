/**
 * The body of a placeholder dashboard.
 *
 * All five role dashboards are stubs in Step 2 — the actual features arrive in
 * later steps. This holds the parts they share (the signed-in confirmation and
 * the "what lands here later" list) so each dashboard file stays a short,
 * readable description of one role rather than five copies of the same markup.
 */

import { useAuth } from '../../context/AuthContext.jsx';
import { ROLE_LABELS } from '../../constants/roles.js';

export default function DashboardPlaceholder({ upcoming = [] }) {
  const { user } = useAuth();

  return (
    <div className="space-y-5">
      {/* Confirms auth actually worked. Every value here came from /auth/me, so
          seeing it filled in proves the token round-tripped — which is exactly
          what the Step 2 verification checklist looks for. */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Your account</h2>
          <span className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700">
            Signed in
          </span>
        </div>

        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Name</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">{user?.name}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="mt-0.5 truncate text-sm font-medium text-slate-900">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Role</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">
              {ROLE_LABELS[user?.role] ?? user?.role}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Status</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">
              {user?.isActive ? 'Active' : 'Inactive'}
            </dd>
          </div>
        </dl>

        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          These details come from <code className="font-mono">GET /api/v1/auth/me</code>, verified
          against the database on every request.
        </p>
      </section>

      {upcoming.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-slate-900">Coming in later steps</h2>
          <p className="mt-1 text-sm text-slate-500">
            This dashboard is a placeholder. These features are planned, not built.
          </p>

          <ul className="mt-4 space-y-2.5">
            {upcoming.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                <span className="text-sm text-slate-600">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
