/**
 * Institution dashboard.
 *
 * Reachable only by INSTITUTION, guarded here by the route and again on the endpoint.
 *
 * PHASE 8 REPLACES THE PLACEHOLDER WITH THE THING THIS ROLE EXISTS FOR. A college
 * does not want a list of its students — it wants to know whether its students are
 * employable, and where they are not. So the page reads top to bottom as one
 * argument: how big the cohort is, how ready it is, what employers are asking for
 * that it cannot supply, which departments those students are in, and what has
 * actually come of their applications.
 *
 * ONE REQUEST, ONE PAGE. Every figure comes from a single GET, so the header cannot
 * say 40 students while the table under it describes 39. That also means a failure
 * is total rather than partial, which is why this page shows a real error state
 * instead of the silent-failure pattern the industry dashboard uses for its
 * secondary count.
 *
 * THE SKILL GAP IS THE HEADLINE FEATURE, AND IT IS ASYMMETRIC ON PURPOSE. Supply is
 * this institution's students; demand is every live posting from every employer.
 * That is what makes it curriculum advice rather than a report card.
 *
 * NOTHING IS COMPUTED HERE. Shares, averages, bands and gaps all arrive finished
 * from the server. This file lays out numbers; it does not produce any.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchInstitutionAnalytics } from '../../api/analytics.api.js';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import DashboardPlaceholder from '../../components/dashboard/DashboardPlaceholder.jsx';
import {
  BranchChart,
  ReadinessChart,
  SkillGapChart,
} from '../../components/institution/AnalyticsCharts.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Card from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { APPLICATION_STATUSES, statusLabel } from '../../constants/applications.js';
import { errorDetailsForBanner } from '../../utils/apiErrors.js';

/**
 * What this dashboard still does not do. Three items shipped in Phase 8, and
 * "Curriculum alignment insights" shipped in Phase 9 as the intelligence page — so it
 * is removed rather than left on a list of things that already exist.
 */
const UPCOMING = ['Industry collaboration management'];

/** A number and what it means. `value` may be null, which prints as a dash, not a 0. */
function StatTile({ label, value, suffix = '', hint }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3.5">
      <p className="text-xs font-medium text-slate-500">{label}</p>

      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">
        {value === null || value === undefined ? (
          /* A null average means "nobody has been assessed", which is not zero.
             Printing 0% there would be a lie the institution could act on. */
          <span className="text-slate-300">—</span>
        ) : (
          <>
            {value}
            {suffix ? <span className="text-base font-medium text-slate-500">{suffix}</span> : null}
          </>
        )}
      </p>

      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export default function InstitutionDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const result = await fetchInstitutionAnalytics();
        if (isActive) {
          setAnalytics(result);
          setLoadError(null);
        }
      } catch (error) {
        if (isActive) setLoadError(error);
      } finally {
        if (isActive) setIsLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const cohort = analytics?.cohort ?? null;
  const pipeline = analytics?.pipeline ?? null;
  const students = cohort?.students ?? 0;

  /* Statuses worth naming, in pipeline order, and only where something exists. */
  const pipelineStages = [
    APPLICATION_STATUSES.APPLIED,
    APPLICATION_STATUSES.UNDER_REVIEW,
    APPLICATION_STATUSES.SHORTLISTED,
    APPLICATION_STATUSES.INTERVIEW,
    APPLICATION_STATUSES.SELECTED,
    APPLICATION_STATUSES.REJECTED,
  ].filter((value) => (pipeline?.byStatus?.[value] ?? 0) > 0);

  return (
    <DashboardLayout
      title="Institution dashboard"
      subtitle="Track readiness and placement outcomes across your cohorts."
    >
      <div className="space-y-5">
        {loadError ? (
          <Alert
            variant="error"
            title="Could not load your cohort analytics"
            message={loadError.message ?? 'Please refresh the page to try again.'}
            errors={errorDetailsForBanner(loadError)}
          />
        ) : null}

        {isLoading ? (
          <Card title="Cohort readiness">
            <div className="flex items-center gap-2.5 text-sm text-slate-500">
              <Spinner size="sm" />
              Reading your cohort…
            </div>
          </Card>
        ) : !analytics ? null : students === 0 ? (
          /* THE EMPTY STATE IS THE MOST LIKELY FIRST VIEW, so it explains the one
             thing that makes this page work: students are matched to an institution
             by the name they type on their own profile. */
          <Card title="No students matched yet">
            <p className="text-sm text-slate-600">
              No student profile lists <strong>{analytics.institution.name}</strong> as its
              institution, so there is nothing to analyse yet.
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Students are matched by the institution name on their own profile, spelled exactly as
              your account name. Once they fill that in and complete a skill assessment, their
              readiness appears here.
            </p>

            <p className="mt-3 text-xs text-slate-400">
              {analytics.demand.livePostings} live{' '}
              {analytics.demand.livePostings === 1 ? 'opportunity' : 'opportunities'} are currently
              posted by employers, asking for {analytics.demand.skillsInDemand} distinct{' '}
              {analytics.demand.skillsInDemand === 1 ? 'skill' : 'skills'}.
            </p>
          </Card>
        ) : (
          <>
            <Card
              title="Cohort"
              description={`${students} ${students === 1 ? 'student profile lists' : 'student profiles list'} ${analytics.institution.name}.`}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="Students"
                  value={cohort.students}
                  hint={`${cohort.assessed} assessed · ${cohort.notAssessed} not yet`}
                />

                <StatTile
                  label="Average readiness"
                  value={cohort.averageReadiness}
                  suffix="%"
                  hint={
                    cohort.assessed === 0
                      ? 'No assessments completed yet'
                      : `Across the ${cohort.assessed} assessed`
                  }
                />

                <StatTile
                  label="Profile completion"
                  value={cohort.averageProfileCompletion}
                  suffix="%"
                  hint="Averaged over every student in the cohort"
                />

                <StatTile
                  label="Skills claimed"
                  value={cohort.skillEntries}
                  hint={`${cohort.verifiedSkillEntries} verified by assessment · ${cohort.distinctSkills} distinct`}
                />
              </div>

              {cohort.notAssessed > 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  {cohort.notAssessed} of {cohort.students}{' '}
                  {cohort.notAssessed === 1 ? 'student has' : 'students have'} not completed a skill
                  assessment. Their readiness is unknown rather than low, and they are left out of
                  every average on this page.
                </p>
              ) : null}
            </Card>

            <Card
              title="Career readiness"
              description="Where the assessed students sit across the five proficiency bands."
            >
              <ReadinessChart bands={analytics.readiness} assessed={cohort.assessed} />
            </Card>

            <Card
              title="Skill gaps against live hiring"
              description={`What employers ask for across ${analytics.demand.livePostings} live ${analytics.demand.livePostings === 1 ? 'posting' : 'postings'}, against what this cohort holds.`}
            >
              <SkillGapChart
                gaps={analytics.skillGaps}
                livePostings={analytics.demand.livePostings}
                students={students}
              />

              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                Demand is measured across every employer on the platform, not only the roles your
                students applied to — so a high gap is a curriculum signal, not a placement result.
              </p>
            </Card>

            {analytics.strengths.length > 0 ? (
              <Card
                title="Strongest skills in this cohort"
                description="Most widely held, verified counts as the tiebreak."
              >
                <ul className="flex flex-wrap gap-2">
                  {analytics.strengths.map((skill) => (
                    <li key={skill.skillId}>
                      <Badge variant={skill.verifiedStudents > 0 ? 'success' : 'neutral'}>
                        {skill.name} · {skill.students} ({skill.share}%)
                        {skill.verifiedStudents > 0 ? ` · ${skill.verifiedStudents} verified` : ''}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Card
              title="Readiness by department"
              description="Bars show cohort size, because an average over three students is not an average worth acting on."
            >
              <BranchChart branches={analytics.branches} totalStudents={students} />
            </Card>

            <Card
              title="Placement pipeline"
              description="Every application made by a student in this cohort."
            >
              {pipeline.total === 0 ? (
                <p className="text-sm text-slate-600">
                  No student in this cohort has applied to an opportunity yet.{' '}
                  {analytics.demand.livePostings > 0
                    ? `${analytics.demand.livePostings} ${analytics.demand.livePostings === 1 ? 'role is' : 'roles are'} open to them right now.`
                    : 'There are no live roles open right now.'}
                </p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatTile
                      label="Students applying"
                      value={pipeline.applicants}
                      hint={`${pipeline.total} ${pipeline.total === 1 ? 'application' : 'applications'} in total`}
                    />

                    <StatTile
                      label="In progress"
                      value={pipeline.inProgress}
                      hint="Applied, under review, shortlisted or interviewing"
                    />

                    <StatTile
                      label="Selected"
                      value={pipeline.selected}
                      hint="Offered a place by an employer"
                    />

                    <StatTile
                      label="Not yet applying"
                      value={students - pipeline.applicants}
                      hint="Students with no application on record"
                    />
                  </div>

                  {pipelineStages.length > 0 ? (
                    <p className="mt-4 text-sm text-slate-500">
                      {pipelineStages
                        .map(
                          (value) =>
                            `${pipeline.byStatus[value]} ${statusLabel(value).toLowerCase()}`,
                        )
                        .join(' · ')}
                    </p>
                  ) : null}
                </>
              )}
            </Card>

            {/* THE ONE LINK OUT OF THIS PAGE. Phase 9 gives the institution a second
                surface, so the page no longer has to close on the reading of its own
                numbers: the gap table here says which skills are short, and the
                intelligence page says what is being done about them and whether it
                has worked. */}
            <Card
              title="What to do with this"
              action={
                <Link
                  to="/institution/intelligence"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
                >
                  Open intelligence
                </Link>
              }
            >
              <p className="text-sm text-slate-600">
                The gap table is the shortest route to a curriculum decision: the skills at the top
                are the ones employers are hiring for and this cohort cannot supply. The readiness
                distribution is the shortest route to a student one — the students in the lowest two
                bands are the ones an assessment has already identified as needing help.
              </p>

              <p className="mt-2 text-sm text-slate-600">
                Institution intelligence takes those gaps further: it ranks them by priority,
                reports what the learning programmes have measurably changed, and turns the
                placement pipeline above into internship and job outcomes.
              </p>
            </Card>
          </>
        )}

        <DashboardPlaceholder upcoming={UPCOMING} />
      </div>
    </DashboardLayout>
  );
}
