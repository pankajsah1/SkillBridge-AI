/**
 * The top of the portfolio page: who this is, and how complete it is.
 *
 * This is the one part of Step 6 that is meant to look like a portfolio rather
 * than a form. A student who has filled this in should be able to screenshot the
 * top of the page and have it read as a profile, so the header carries the name,
 * the headline, the institution line and the score together — the things a
 * recruiter reads in the first two seconds.
 *
 * IT ONLY DISPLAYS. The percentage comes from the server's
 * `completion.completionPercentage`, the counts come from the arrays the server
 * returned, and nothing here recomputes either. If the number looks wrong, the
 * bug is in server/src/constants/portfolio.js PORTFOLIO_COMPLETION_SECTIONS, which
 * is where it should be.
 *
 * The gradient panel is the same primary palette used elsewhere in the app rather
 * than a new colour, per "keep it visually consistent … do not redesign the
 * entire application".
 */

import { Link } from 'react-router-dom';

import Badge from '../ui/Badge.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';

/** Initials for the avatar. Two letters at most, so it never overflows. */
const initialsOf = (name) => {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

/**
 * "B.Tech Computer Science · IIT Delhi · Class of 2026", skipping whatever is
 * missing so a half-filled profile still reads as a sentence rather than showing
 * empty separators.
 */
const educationLine = (profile) =>
  [
    [profile?.degree, profile?.branch].filter(Boolean).join(' '),
    profile?.institutionName,
    profile?.graduationYear ? `Class of ${profile.graduationYear}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

export default function PortfolioHeader({ user, profile, completion }) {
  const percentage = completion?.completionPercentage ?? 0;
  const education = educationLine(profile);

  const counts = [
    { label: 'projects', value: profile?.projects?.length ?? 0 },
    { label: 'certifications', value: profile?.certifications?.length ?? 0 },
    { label: 'experience records', value: profile?.experiences?.length ?? 0 },
    { label: 'achievements', value: profile?.achievements?.length ?? 0 },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="bg-gradient-to-br from-primary-600 to-primary-700 px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-start gap-5">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl font-semibold text-white ring-1 ring-inset ring-white/25"
            aria-hidden="true"
          >
            {initialsOf(user?.name)}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold text-white">
              {user?.name ?? 'Your portfolio'}
            </h2>

            {profile?.headline ? (
              <p className="mt-1 text-sm text-primary-50">{profile.headline}</p>
            ) : (
              <p className="mt-1 text-sm text-primary-100/80">
                Add a headline on your profile — it is the first line anyone reads.
              </p>
            )}

            {education ? <p className="mt-2 text-xs text-primary-100">{education}</p> : null}
          </div>

          {/* The score, large, on the right. It is the number the page is about. */}
          <div className="shrink-0 text-right">
            <p className="text-3xl font-semibold tabular-nums text-white">{percentage}%</p>
            <p className="text-xs text-primary-100">complete</p>
          </div>
        </div>

        <ProgressBar
          value={percentage}
          className="mt-5"
          // On the coloured panel the default slate track disappears, so both
          // track and fill are overridden here rather than in the primitive.
          barClassName="bg-white"
          size="sm"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-8">
        <div className="flex flex-wrap gap-2">
          {counts.map((entry) => (
            <Badge key={entry.label} variant={entry.value > 0 ? 'primary' : 'outline'}>
              {entry.value}{' '}
              {entry.value === 1 ? entry.label.replace(/s$/, '') : entry.label}
            </Badge>
          ))}
        </div>

        {/* The link out, because the summary above lives on the profile page and
            this page deliberately does not duplicate that form. */}
        <Link
          to="/student/profile"
          className="text-sm font-medium text-primary-700 transition hover:text-primary-800"
        >
          Edit your details →
        </Link>
      </div>
    </section>
  );
}
