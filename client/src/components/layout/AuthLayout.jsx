/**
 * Centred, branded shell for the login and registration pages.
 *
 * Keeps the SkillBridge AI mark and tagline identical across both, so the two
 * pages read as one flow rather than two separate screens.
 */

import { Link } from 'react-router-dom';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'SkillBridge AI';

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-7 text-center">
          <Link
            to="/"
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white shadow-card transition hover:bg-primary-700"
            aria-label={`${APP_NAME} home`}
          >
            SB
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assess. Bridge. Match. Get industry ready.
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>

          {children}
        </section>

        {footer ? <div className="mt-5 text-center text-sm text-slate-600">{footer}</div> : null}

        {/*
          Escape hatch. If the API is down, a sign-in failure looks the same as a
          wrong password from here, so give people one click to the health page
          rather than leaving them guessing.
        */}
        <p className="mt-6 text-center text-xs text-slate-400">
          <Link
            to="/status"
            className="rounded transition hover:text-slate-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            System status
          </Link>
        </p>
      </div>
    </main>
  );
}
