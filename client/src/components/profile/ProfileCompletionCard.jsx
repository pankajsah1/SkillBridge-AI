/**
 * Profile completion card — DESIGN.md section 15.2.
 *
 * The percentage is computed by the server (StudentProfile.recomputeCompletion)
 * and simply displayed here. That is deliberate: if the browser calculated it
 * too, the two would eventually disagree and there would be no way to tell which
 * was right.
 *
 * The "what's missing" list is derived from the profile the API returned, using
 * the same field set the server weights. It is a hint about where to click next,
 * not a second scoring implementation — it never produces a number.
 */

import Badge from '../ui/Badge.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';

/**
 * Mirrors the server's COMPLETION_WEIGHTS keys, in the order they appear on the
 * page, so the suggestions read top to bottom like the form does.
 */
const CHECKS = [
  { label: 'a short about section', filled: (p) => Boolean(p.bio?.trim()) },
  { label: 'your institution', filled: (p) => Boolean(p.institutionName?.trim()) },
  { label: 'your branch', filled: (p) => Boolean(p.branch?.trim()) },
  { label: 'your graduation year', filled: (p) => Boolean(p.graduationYear) },
  { label: 'your location', filled: (p) => Boolean(p.location?.trim()) },
  { label: 'a few interests', filled: (p) => (p.interests?.length ?? 0) > 0 },
  { label: 'at least one career goal', filled: (p) => (p.targetRoles?.length ?? 0) > 0 },
  { label: 'at least one skill', filled: (p) => (p.skills?.length ?? 0) > 0 },
];

/** Wording scales with progress — DESIGN.md section 25 asks for constructive language. */
const messageFor = (percentage) => {
  if (percentage >= 100) return 'Your profile is complete. Everything below is ready for the next steps.';
  if (percentage >= 70) return 'Almost there. A couple more details and your profile is complete.';
  if (percentage >= 30) return 'Good start. Filling in the rest makes your profile far more useful.';
  return 'Add a few details to get started — you can come back and refine them any time.';
};

export default function ProfileCompletionCard({ profile }) {
  if (!profile) return null;

  const percentage = profile.profileCompletion ?? 0;
  const missing = CHECKS.filter((check) => !check.filled(profile));
  const isComplete = percentage >= 100;

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Profile completion</h2>
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
        label={undefined}
      />

      <p className="mt-3 text-sm text-slate-500">{messageFor(percentage)}</p>

      {missing.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500">Still to add</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((check) => (
              <Badge key={check.label} variant="outline">
                {check.label}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
