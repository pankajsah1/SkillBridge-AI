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
 * PHASE 7 ADDS ONE NUMBER THAT IS NOT ABOUT POSTINGS. `needsReview` is how many
 * applications nobody has looked at yet, and it is the only figure on this page
 * worth a second request: an employer opens the dashboard to find out whether
 * anything is waiting on them, and "6 people are waiting" is that answer. It fails
 * silently — the opportunity counts are the page, and an error banner over them
 * because a secondary count failed would cost more than it tells anyone.
 *
 * STEP 8 ADDS ONE CARD, NOT A SECOND DASHBOARD. Learning programmes are published by
 * this same role, so the way in belongs here beside the postings — and like the
 * application counts it is a secondary request that is allowed to fail quietly. The
 * numbers it shows are `summary` from the same GET /industry/learning-programs that the
 * management list calls, so the two pages cannot disagree.
 *
 * The "coming later" list stays as Step 2 left it, minus the items since delivered.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchRecruitmentSummary } from '../../api/application.api.js';
import { fetchMyLearningPrograms } from '../../api/learning.api.js';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import DashboardPlaceholder from '../../components/dashboard/DashboardPlaceholder.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Card from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { APPLICATION_STATUSES, statusLabel } from '../../constants/applications.js';
import useMyOpportunities from '../../hooks/useMyOpportunities.js';

const UPCOMING = [
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

      {/* Optional: the learning tiles below carry their meaning in the label alone. */}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
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

  /**
   * Pipeline totals across every posting. Counts only, and allowed to fail.
   *
   * A second request rather than a field on the opportunity summary, because the
   * two are different aggregates over different collections — and this one is
   * cheap, so a page that renders without it is better than one endpoint that
   * fails as a unit.
   */
  const [recruitment, setRecruitment] = useState(null);
  const [isLoadingRecruitment, setIsLoadingRecruitment] = useState(true);

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const result = await fetchRecruitmentSummary();
        if (isActive) setRecruitment(result);
      } catch {
        if (isActive) setRecruitment(null);
      } finally {
        if (isActive) setIsLoadingRecruitment(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  /**
   * Learning programme counts. Same deal as the pipeline above: one cheap request,
   * silent on failure.
   *
   * `page: 1` is asked for and only `summary` is used — the counts are the server's,
   * over the whole catalogue rather than the rows that came back.
   */
  const [learning, setLearning] = useState(null);
  const [isLoadingLearning, setIsLoadingLearning] = useState(true);

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const result = await fetchMyLearningPrograms({ page: 1, limit: 3 });
        if (isActive) setLearning(result);
      } catch {
        if (isActive) setLearning(null);
      } finally {
        if (isActive) setIsLoadingLearning(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const total = summary?.total ?? 0;
  const recent = opportunities.slice(0, 3);

  const applicationTotal = recruitment?.total ?? 0;
  const needsReview = recruitment?.needsReview ?? 0;
  const byStatus = recruitment?.byStatus ?? {};

  /* The statuses worth naming: the ones the employer has already acted on. */
  const movedOn = [
    APPLICATION_STATUSES.SHORTLISTED,
    APPLICATION_STATUSES.INTERVIEW,
    APPLICATION_STATUSES.SELECTED,
  ].filter((value) => (byStatus[value] ?? 0) > 0);

  const learningSummary = learning?.summary ?? {};
  const learningTotal = learningSummary.total ?? 0;

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

        {/* Second, not first: the postings are the thing an employer owns here, and
            the applicants only exist because of them. */}
        <Card
          title="Applications"
          description={
            isLoadingRecruitment
              ? 'Counting across all your postings…'
              : applicationTotal === 0
                ? 'Nobody has applied to your postings yet.'
                : `${applicationTotal} ${applicationTotal === 1 ? 'application' : 'applications'} across your postings.`
          }
          action={
            <Link
              to="/industry/opportunities"
              className="text-sm font-medium text-primary-700 hover:text-primary-800"
            >
              Open a posting →
            </Link>
          }
        >
          {isLoadingRecruitment ? (
            <div className="flex items-center gap-2.5 text-sm text-slate-500">
              <Spinner size="sm" />
              Loading your pipeline…
            </div>
          ) : applicationTotal === 0 ? (
            <p className="text-sm text-slate-600">
              Once students apply, each posting gets a ranked list of candidates — ordered by how
              well their verified skills matched the role at the time they applied.
            </p>
          ) : (
            <div className="space-y-3">
              {needsReview > 0 ? (
                <p className="text-sm text-slate-700">
                  <span className="text-2xl font-semibold tabular-nums text-slate-900">
                    {needsReview}
                  </span>{' '}
                  {needsReview === 1 ? 'application is' : 'applications are'} waiting on you —
                  nobody has reviewed {needsReview === 1 ? 'it' : 'them'} yet.
                </p>
              ) : (
                <p className="text-sm text-slate-700">
                  Every application has been reviewed. Nothing is waiting on you.
                </p>
              )}

              {movedOn.length > 0 ? (
                <p className="text-sm text-slate-500">
                  {movedOn
                    .map((value) => `${byStatus[value]} ${statusLabel(value).toLowerCase()}`)
                    .join(' · ')}
                </p>
              ) : null}

              {/* Per-posting numbers deliberately are not here: this card answers
                  "is anything waiting?", and "which posting?" is the applicants
                  page, one click away. */}
              <p className="text-xs text-slate-400">
                Open a posting to see its candidates ranked by skill match.
              </p>
            </div>
          )}
        </Card>

        {/* Third: what you teach, after what you offer and who applied. The counts are
            enrolments and completions, never the learners' names — the same line the
            management list holds. */}
        <Card
          title="Learning programs"
          description={
            isLoadingLearning
              ? 'Counting your programs…'
              : learningTotal === 0
                ? 'You have not listed a course, certification, workshop, training or mentorship yet.'
                : `${learningTotal} ${learningTotal === 1 ? 'program' : 'programs'} listed.`
          }
          action={
            <Link
              to="/industry/learning-programs/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              List a program
            </Link>
          }
        >
          {isLoadingLearning ? (
            <div className="flex items-center gap-2.5 text-sm text-slate-500">
              <Spinner size="sm" />
              Loading your programs…
            </div>
          ) : learningTotal === 0 ? (
            <p className="text-sm text-slate-600">
              List one with the skills it teaches, and it can be recommended to the students whose
              skill gaps it closes — the same skills your postings ask for.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Open to learners', value: learningSummary.open ?? 0 },
                { label: 'Drafts', value: learningSummary.drafts ?? 0 },
                { label: 'Enrollments', value: learningSummary.enrollments ?? 0 },
                { label: 'Completions', value: learningSummary.completions ?? 0 },
              ].map((tile) => (
                <CountTile key={tile.label} label={tile.label} value={tile.value} />
              ))}
            </div>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4">
            <Link
              to="/industry/learning-programs"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 transition hover:text-primary-800"
            >
              Manage learning programs
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Card>

        <DashboardPlaceholder upcoming={UPCOMING} />
      </div>
    </DashboardLayout>
  );
}
