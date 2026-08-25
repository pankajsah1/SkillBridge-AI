/**
 * Industry dashboard.
 *
 * Reachable only by INDUSTRY. The route guard enforces that in the UI; the backend
 * enforces it again on every industry endpoint.
 *
 * Step 4 turns this from a placeholder into the way into opportunity management,
 * exactly as Step 3 did for the student dashboard. The counts come from the
 * `summary` that GET /industry/opportunities already returns — the same request the
 * management list makes — so nothing is recomputed here and the two pages cannot
 * disagree.
 *
 * WHY `expired` IS A SEPARATE COUNT FROM `active`. They are answers to different
 * questions: `active` is what the employer published, `expired` is what the clock
 * has since done to it. A posting can be both published and past its deadline, and
 * an employer with three "active" roles that no student can see would have no way to
 * find that out from one number.
 *
 * The "coming later" list stays as Step 2 left it, minus the two items this step
 * delivered.
 */

import { Link } from 'react-router-dom';

import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import DashboardPlaceholder from '../../components/dashboard/DashboardPlaceholder.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Card from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import useMyOpportunities from '../../hooks/useMyOpportunities.js';

const UPCOMING = [
  'Matched candidates ranked by verified skill fit',
  'Application tracking and shortlisting',
  'Skill assessments that verify what applicants claim',
  'Collaboration requests to institutions',
];

/** The four numbers, in the order an employer cares about them. */
const COUNTS = [
  { key: 'active', label: 'Open to students', hint: 'Published and still accepting applications' },
  { key: 'drafts', label: 'Drafts', hint: 'Only you can see these' },
  { key: 'expired', label: 'Deadline passed', hint: 'Published, but no longer shown to students' },
  { key: 'closed', label: 'Closed', hint: 'Closed by you' },
];

function CountTile({ label, value, hint, isLoading }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3.5">
      <p className="text-xs font-medium text-slate-500">{label}</p>

      {isLoading ? (
        <span className="mt-1 block h-7 w-8 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      )}

      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

export default function IndustryDashboard() {
  /**
   * The dashboard asks for page 1 of the list and uses only the summary.
   *
   * One request rather than a second endpoint built to return four numbers. The
   * postings that come back are not wasted either — the three most recent are shown
   * below, which is the other thing an employer wants on landing.
   */
  const { opportunities, summary, isLoading, loadError } = useMyOpportunities();

  const total = summary?.total ?? 0;
  const recent = opportunities.slice(0, 3);

  return (
    <DashboardLayout
      title="Industry dashboard"
      subtitle="Post opportunities and find candidates whose skills you can verify."
    >
      <div className="space-y-5">
        {loadError ? (
          <Alert
            variant="warning"
            title="Could not load your opportunities"
            message={`${loadError.message} Your account details are unaffected.`}
          />
        ) : null}

        <Card
          title="Your opportunities"
          description={
            total === 0 && !isLoading
              ? 'You have not posted anything yet.'
              : 'Internships, jobs, apprenticeships and live projects you have posted.'
          }
          action={
            <Link
              to="/industry/opportunities/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              Post an opportunity
            </Link>
          }
        >
          {total === 0 && !isLoading && !loadError ? (
            <p className="text-sm text-slate-600">
              Describe a role and the skills it needs, and students can start finding it straight
              away. You can save a draft first and publish it when you are ready.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {COUNTS.map((count) => (
                <CountTile
                  key={count.key}
                  label={count.label}
                  value={summary?.[count.key] ?? 0}
                  hint={count.hint}
                  isLoading={isLoading}
                />
              ))}
            </div>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4">
            {isLoading ? (
              <div className="flex items-center gap-2.5 text-sm text-slate-500">
                <Spinner size="sm" />
                Loading your opportunities…
              </div>
            ) : recent.length > 0 ? (
              <>
                <p className="text-xs font-medium text-slate-500">Most recent</p>

                <ul className="mt-2 space-y-1.5">
                  {recent.map((opportunity) => (
                    <li key={opportunity.id}>
                      <Link
                        to={`/industry/opportunities/${opportunity.id}/edit`}
                        className="block truncate text-sm text-primary-700 transition hover:text-primary-800"
                      >
                        {opportunity.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <Link
              to="/industry/opportunities"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 transition hover:text-primary-800"
            >
              Manage all opportunities
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Card>

        <DashboardPlaceholder upcoming={UPCOMING} />
      </div>
    </DashboardLayout>
  );
}
