/**
 * "What is missing, and what to do about it."
 *
 * THIS PANEL DOES NOT SCORE ANYTHING. It renders `completion.missingSections`
 * exactly as the server sent it — key, label, weight and the server's own `action`
 * sentence — and shows `completion.completionPercentage` as a number. There is no
 * second implementation of the scoring rules on this side, deliberately: two
 * implementations of one number is how a UI ends up saying 75% next to a list that
 * adds up to 60%, with no way to tell which is right.
 *
 * Contrast components/profile/ProfileCompletionCard.jsx, which derives its "still
 * to add" chips client-side from field presence. That was acceptable there because
 * the checks are single fields and it never produces a number. Here the server
 * already sends the list, so asking it is both easier and impossible to get wrong.
 *
 * THE ONE THING THIS FILE ADDS is where each missing section lives, because the
 * server has no business knowing the client's URLs. Summary, education and skills
 * are edited on the profile page; the rest are sections on this page, reached by
 * anchor. A key with no known destination still renders — it just shows the
 * server's advice without a link, which is a soft landing if a ninth section is
 * added server-side before this map learns about it.
 *
 * THE SAME PANEL SERVES THE ACADEMICIAN PROFILE. Its completion payload has exactly
 * this shape — `{completionPercentage, completedSections, missingSections}` with the
 * same `{key, label, weight, action}` entries — so the only role-specific parts are
 * the heading, the encouraging sentence and the destination map. Those are props with
 * the student's values as defaults, which is what lets one panel serve both pages
 * without the student page changing at all.
 */

import { Link } from 'react-router-dom';

import Card from '../ui/Card.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';

/**
 * Server section key -> where a student goes to fix it.
 *
 * The keys are the server's, verbatim, from PORTFOLIO_COMPLETION_SECTIONS. Note
 * `experience` is singular here — the completion section is named `experience`
 * while the API route segment is `experiences`. That asymmetry is the server's, and
 * mirroring it exactly is safer than "tidying" it on one side only.
 */
const DESTINATIONS = Object.freeze({
  summary: { to: '/student/profile', label: 'Edit your profile' },
  education: { to: '/student/profile', label: 'Edit your profile' },
  skills: { to: '/student/profile#skills', label: 'Manage skills' },
  resume: { to: '#portfolio-resume', label: 'Upload resume', isAnchor: true },
  projects: { to: '#portfolio-projects', label: 'Add a project', isAnchor: true },
  certifications: {
    to: '#portfolio-certifications',
    label: 'Add a certification',
    isAnchor: true,
  },
  experience: { to: '#portfolio-experiences', label: 'Add experience', isAnchor: true },
  achievements: { to: '#portfolio-achievements', label: 'Add an achievement', isAnchor: true },
});

/** Constructive at every level — an incomplete portfolio is a to-do, not a fault. */
const messageFor = (percentage) => {
  if (percentage >= 100) {
    return 'Your portfolio is complete. Everything a recruiter looks for is filled in.';
  }
  if (percentage >= 70) {
    return 'Nearly there. Finishing the sections below is what turns a good portfolio into a convincing one.';
  }
  if (percentage >= 30) {
    return 'A solid start. Each section below adds something a recruiter specifically looks for.';
  }
  return 'Start anywhere. Your resume and one project already make a portfolio worth sharing.';
};

/**
 * An in-page anchor, scrolled smoothly rather than jumped to.
 *
 * A plain `<a href="#id">` inside a React Router app is safe — the browser handles
 * a same-page fragment itself without a navigation — but it jumps. Handling the
 * click gives a smooth scroll while leaving the href intact, so middle-click,
 * copy-link and keyboard activation all still behave like a real link.
 */
function AnchorAction({ to, children }) {
  const handleClick = (event) => {
    const id = to.slice(1);
    const target = document.getElementById(id);
    if (!target) return; // Let the browser try the fragment itself.

    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <a
      href={to}
      onClick={handleClick}
      className="shrink-0 text-sm font-medium text-primary-700 transition hover:text-primary-800"
    >
      {children}
    </a>
  );
}

/**
 * @param {object} props
 * @param {object|null} props.completion the server's completion object, unmodified
 * @param {string} [props.id] anchor id, so a page can link to this panel
 * @param {string} [props.title]
 * @param {string} [props.description]
 * @param {Record<string, {to: string, label: string, isAnchor?: boolean}>} [props.destinations]
 *   section key -> where to go and what to call the link
 * @param {(percentage: number) => string} [props.message] the sentence above the bar
 */
export default function PortfolioCompletionPanel({
  completion,
  id = 'portfolio-completion',
  title = 'Portfolio completion',
  description = 'Worked out by the server from what you have filled in — the same number employers see.',
  destinations = DESTINATIONS,
  message = messageFor,
}) {
  // No completion object means no profile yet. The page shows a create prompt in
  // that case, so a 0% panel here would just be a second way of saying the same
  // thing.
  if (!completion) return null;

  const percentage = completion.completionPercentage ?? 0;
  const missing = completion.missingSections ?? [];
  const isComplete = missing.length === 0;

  return (
    <Card id={id} title={title} description={description}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-slate-600">{message(percentage)}</p>
        <span
          className={`text-2xl font-semibold tabular-nums ${
            isComplete ? 'text-success-600' : 'text-primary-600'
          }`}
        >
          {percentage}%
        </span>
      </div>

      <ProgressBar
        value={percentage}
        size="lg"
        className="mt-3"
        barClassName={isComplete ? 'bg-success-500' : 'bg-primary-600'}
      />

      {isComplete ? null : (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Recommended next
          </p>

          {/* Ordered by weight, so the section worth the most points is the first
              thing suggested. The server sends them in its own declaration order;
              sorting a copy leaves that array untouched. */}
          <ul className="mt-2.5 divide-y divide-slate-100">
            {[...missing]
              .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
              .map((section) => {
                const destination = destinations[section.key];

                return (
                  <li
                    key={section.key}
                    className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {section.label}
                        {typeof section.weight === 'number' ? (
                          <span className="ml-2 text-xs font-normal tabular-nums text-slate-400">
                            +{section.weight}%
                          </span>
                        ) : null}
                      </p>
                      {/* The server's own sentence, not a rewrite of it. */}
                      <p className="mt-0.5 text-sm text-slate-500">{section.action}</p>
                    </div>

                    {destination?.isAnchor ? (
                      <AnchorAction to={destination.to}>{destination.label} →</AnchorAction>
                    ) : destination ? (
                      <Link
                        to={destination.to}
                        className="shrink-0 text-sm font-medium text-primary-700 transition hover:text-primary-800"
                      >
                        {destination.label} →
                      </Link>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </Card>
  );
}
