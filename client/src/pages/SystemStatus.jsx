/**
 * System status page — the Step 1 foundation check, preserved.
 *
 * This was the whole of App.jsx in Step 1. It moved here unchanged when App.jsx
 * became the router host, rather than being deleted: it is still the fastest way
 * to confirm client, API and database are all talking to each other, and it is
 * what the Step 1 verification checklist looks at.
 *
 * Public on purpose. It exposes no user data — only whether the services are up.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchHealth } from '../api/health.api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { homePathForRole } from '../constants/roles.js';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'SkillBridge AI';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

/** Small coloured dot + label used by each status row. */
function StatusDot({ tone }) {
  const tones = {
    ok: 'bg-success-500',
    warn: 'bg-warning-500',
    bad: 'bg-error-500',
    idle: 'bg-slate-300',
  };

  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tones[tone] ?? tones.idle}`} />;
}

/**
 * One foundation check. `tone` drives the dot colour, and the status text is
 * always written out — DESIGN.md §40 requires that meaning never depend on
 * colour alone.
 */
function CheckRow({ label, status, tone, detail }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {detail ? <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusDot tone={tone} />
        <span className="text-sm text-slate-600">{status}</span>
      </div>
    </div>
  );
}

export default function SystemStatus() {
  const { isAuthenticated, user } = useAuth();

  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setHealth(await fetchHealth());
    } catch (err) {
      setError(err);
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  // ---- Derive the three checks from current state ----
  const apiCheck = isLoading
    ? { status: 'Checking…', tone: 'idle' }
    : error
      ? { status: 'Unreachable', tone: 'bad' }
      : { status: 'Connected', tone: 'ok' };

  const dbCheck = isLoading
    ? { status: 'Checking…', tone: 'idle' }
    : error
      ? { status: 'Unknown', tone: 'idle' }
      : health?.databaseConnected
        ? { status: 'Connected', tone: 'ok' }
        : { status: health?.database ?? 'Disconnected', tone: 'warn' };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* ---- Header ---- */}
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white shadow-card">
            SB
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assess. Bridge. Match. Get industry ready.
          </p>
        </header>

        {/* ---- Foundation status card ---- */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">System status</h2>
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
              Foundation
            </span>
          </div>

          <CheckRow
            label="Client (React + Vite + Tailwind)"
            detail="If this card is styled, Tailwind is compiling."
            status="Running"
            tone="ok"
          />
          <CheckRow label="API server (Express)" detail={API_URL} {...apiCheck} />
          <CheckRow
            label="Database (MongoDB)"
            detail={health?.databaseConnected ? 'Mongoose connection established' : 'Checked via the health endpoint'}
            {...dbCheck}
          />

          {/* ---- Error state (DESIGN.md §35) ---- */}
          {error ? (
            <div className="mt-5 rounded-lg border border-error-100 bg-error-50 p-4">
              <p className="text-sm font-medium text-error-700">Could not reach the API</p>
              <p className="mt-1 text-sm text-error-600">{error.message}</p>
              <button
                type="button"
                onClick={loadHealth}
                className="mt-3 rounded-lg bg-error-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-error-700"
              >
                Retry
              </button>
            </div>
          ) : null}

          {/* ---- Warning state: API up, database down ---- */}
          {!isLoading && !error && !health?.databaseConnected ? (
            <div className="mt-5 rounded-lg border border-warning-100 bg-warning-50 p-4">
              <p className="text-sm font-medium text-warning-700">MongoDB is not connected</p>
              <p className="mt-1 text-sm text-warning-600">
                The API is running, so the foundation is sound. Start MongoDB (or set an Atlas
                URI in <code className="font-mono">server/.env</code>), then run{' '}
                <code className="font-mono">npm run db:check</code> in the server folder.
              </p>
            </div>
          ) : null}

          {/* ---- Success state ---- */}
          {!isLoading && !error && health?.databaseConnected ? (
            <div className="mt-5 rounded-lg border border-success-100 bg-success-50 p-4">
              <p className="text-sm font-medium text-success-700">
                Foundation verified — client, API and database are all connected.
              </p>
            </div>
          ) : null}

          {/* ---- Metadata from the health endpoint ---- */}
          {health ? (
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs">
              <div>
                <dt className="text-slate-500">Environment</dt>
                <dd className="font-medium text-slate-900">{health.environment}</dd>
              </div>
              <div>
                <dt className="text-slate-500">API version</dt>
                <dd className="font-medium text-slate-900">{health.apiVersion}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Uptime</dt>
                <dd className="font-medium text-slate-900">{health.uptimeSeconds}s</dd>
              </div>
              <div>
                <dt className="text-slate-500">Checked at</dt>
                <dd className="font-medium text-slate-900">
                  {new Date(health.timestamp).toLocaleTimeString()}
                </dd>
              </div>
            </dl>
          ) : null}
        </section>

        {/* ---- Where to go next ---- */}
        <div className="mt-6 flex items-center justify-center gap-3">
          {isAuthenticated ? (
            <Link
              to={homePathForRole(user?.role)}
              className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              Go to my dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Create account
              </Link>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Authentication is in place. Assessment, matching and portfolio features arrive in later
          steps.
        </p>
      </div>
    </main>
  );
}
