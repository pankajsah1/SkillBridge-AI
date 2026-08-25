/**
 * A "back to somewhere" link with a chevron.
 *
 * Four new pages in this step need one. The markup is lifted from the inline copy
 * in pages/student/StudentProfile.jsx, which predates this component and has been
 * left alone for the same reason InterestsField was: it is shipped and tested, and
 * rewriting a working page to import a link is a change with risk and no benefit.
 * New pages use this one.
 */

import { Link } from 'react-router-dom';

export default function BackLink({ to, children = 'Back' }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-sm text-primary-700 transition hover:text-primary-800"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </Link>
  );
}
