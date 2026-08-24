/**
 * Shell for every signed-in page: top bar with branding, the current user, and
 * logout.
 *
 * Shared so all five role dashboards get identical chrome and one logout
 * implementation.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { ROLE_LABELS } from '../../constants/roles.js';
import Button from '../ui/Button.jsx';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'SkillBridge AI';

export default function DashboardLayout({ title, subtitle, children }) {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      // No navigate() call: clearing auth state makes ProtectedRoute redirect
      // on its own. One mechanism, not two competing ones.
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
              SB
            </span>
            <span className="truncate text-sm font-semibold text-slate-900">{APP_NAME}</span>
          </Link>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">
                {ROLE_LABELS[user?.role] ?? user?.role}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleLogout} isLoading={isLoggingOut}>
              {isLoggingOut ? 'Logging out…' : 'Log out'}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>

        {children}
      </main>
    </div>
  );
}
