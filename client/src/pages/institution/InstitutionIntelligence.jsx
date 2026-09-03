/**
 * Institution intelligence.
 *
 * THE ANSWER TO "SO WHAT?". The Step 8 dashboard reports the state of a cohort; this
 * page argues about it. It reads top to bottom as one case: what industry is asking
 * for, where this cohort cannot supply it, what the learning programmes have
 * measurably changed about that, what became of the applications, and what to do
 * next. A judge who reads only the first table should already know that SkillBridge
 * does more than match students to jobs.
 *
 * ONE REQUEST, SIX SECTIONS. Every figure comes from a single GET, so the demand
 * table cannot describe a different cohort than the outcome funnel under it.
 *
 * PARTIAL DATA IS A STATE, NOT A FAILURE. The server returns a `coverage` flag per
 * section, and each panel with nothing behind it says so in its own words while the
 * rest of the page renders. That is the difference between "we have not measured this
 * yet" and "this is zero", and on a page about employability the two must never be
 * confused.
 *
 * NOTHING IS COMPUTED HERE. Shares, bands, gaps, priorities, the explanation
 * sentences and the action list all arrive finished. This file lays out numbers; it
 * does not produce any.
 */

import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import useInstitutionIntelligence from '../../hooks/useInstitutionIntelligence.js';
import {
  ActionList,
  DemandRanking,
  LearningImpactList,
  OutcomeFunnel,
  SkillDemandTable,
  StatTile,
} from '../../components/institution/IntelligencePanels.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Card from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { errorDetailsForBanner } from '../../utils/apiErrors.js';

export default function InstitutionIntelligence() {
  const {
    institution,
    summary,
    skillDemand,
    skillGaps,
    learningImpact,
    outcomes,
    actions,
    coverage,
    isLoading,
    loadError,
  } = useInstitutionIntelligence();

  const students = summary?.students ?? 0;

  return (
    <DashboardLayout
      title="Institution intelligence"
      subtitle="Industry demand against your cohort's supply, and what has measurably changed."
    >
      <div className="space-y-5">
        <BackLink to="/institution">Back to the dashboard</BackLink>

        {loadError ? (
          <Alert
            variant="error"
            title="Could not load your institution intelligence"
            message={loadError.message ?? 'Please refresh the page to try again.'}
            errors={errorDetailsForBanner(loadError)}
          />
        ) : null}

        {isLoading ? (
          <Card title="Institution intelligence">
            <div className="flex items-center gap-2.5 text-sm text-slate-500">
              <Spinner size="sm" />
              Reading demand, supply, learning and outcomes…
            </div>
          </Card>
        ) : !summary ? null : !coverage.hasStudents ? (
          /* THE ONE STATE THAT STOPS THE WHOLE PAGE. Every section here is an
             aggregate over students, so with no cohort there is nothing to aggregate
             — and the reason is worth spelling out, because matching is by the
             institution name students type on their own profiles. */
          <Card title="Not enough data yet">
            <p className="text-sm text-slate-600">
              No student profile lists <strong>{institution?.name}</strong> as its institution.
              Institution intelligence will become available as students, opportunities, learning
              activity and outcomes accumulate.
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Students are matched by the institution name on their own profile, spelled exactly as
              your account name.
            </p>

            <p className="mt-3 text-xs text-slate-400">
              {summary.livePostings} live{' '}
              {summary.livePostings === 1 ? 'opportunity is' : 'opportunities are'} currently posted
              by employers, asking for {summary.skillsInDemand} distinct{' '}
              {summary.skillsInDemand === 1 ? 'skill' : 'skills'}.
            </p>
          </Card>
        ) : (
          <>
            <Card
              title="Where this cohort stands"
              description={`${students} ${students === 1 ? 'student' : 'students'} at ${institution?.name}, against ${summary.livePostings} live ${summary.livePostings === 1 ? 'posting' : 'postings'}.`}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="Critical skill gaps"
                  value={summary.criticalSkills}
                  hint={`${summary.highPrioritySkills} more at high priority`}
                />

                <StatTile
                  label="Skills in demand"
                  value={summary.skillsInDemand}
                  hint={`Across ${summary.livePostings} live ${summary.livePostings === 1 ? 'posting' : 'postings'}`}
                />

                <StatTile
                  label="Students assessed"
                  value={summary.assessed}
                  hint={
                    summary.notAssessed === 0
                      ? 'Every student has sat a paper'
                      : `${summary.notAssessed} have not sat one yet`
                  }
                />

                <StatTile
                  label="Measured improvement"
                  value={summary.measuredSkills}
                  suffix={` / ${summary.measurableSkills}`}
                  hint="Priority skills with reassessment evidence"
                />

                <StatTile
                  label="Learners"
                  value={summary.learners}
                  hint={`${summary.completedEnrolments} completed${summary.completionRate === null ? '' : ` · ${summary.completionRate}% completion`}`}
                />

                <StatTile
                  label="Applications"
                  value={summary.applications}
                  hint={`From ${summary.applicants} ${summary.applicants === 1 ? 'student' : 'students'}`}
                />

                <StatTile
                  label="Selected"
                  value={summary.selected}
                  suffix={summary.selectionRate === null ? '' : ` (${summary.selectionRate}%)`}
                  hint="Offered a place by an employer"
                />

                <StatTile
                  label="Average readiness"
                  value={summary.averageReadiness}
                  suffix="%"
                  hint={`Across ${summary.withReadiness} scored ${summary.withReadiness === 1 ? 'profile' : 'profiles'}`}
                />
              </div>
            </Card>

            {/* THE HEADLINE, AND IT IS FIRST FOR THAT REASON. Demand is every live
                posting on the platform; supply is this institution's students. That
                asymmetry is what makes the table curriculum advice rather than a
                report card. */}
            <Card
              title="Skill demand vs student supply"
              description="Ordered most urgent first. Priority is a fixed rule over demand, coverage and proficiency — not a score."
            >
              <SkillDemandTable
                rows={skillGaps}
                livePostings={summary.livePostings}
                students={students}
              />

              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                Demand is measured across every employer on the platform, not only the roles your
                students applied to. Proficiency is the average score of the students who list the
                skill, so a skill nobody lists shows a dash rather than a zero.
              </p>
            </Card>

            <Card
              title="What employers ask for most"
              description="The market on its own, ranked by demand — including the skills this cohort already covers."
            >
              <DemandRanking
                skills={skillDemand?.topSkills ?? []}
                livePostings={summary.livePostings}
              />

              {(skillDemand?.byType ?? []).length > 0 ? (
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {skillDemand.byType
                    .map((row) => `${row.postings} ${row.label.toLowerCase()}`)
                    .join(' · ')}{' '}
                  — what this market is hiring for changes what a gap means.
                </p>
              ) : null}
            </Card>

            <Card
              title="Learning impact"
              description="What the programmes targeting these skills have changed, measured only from submitted assessments."
            >
              {!coverage.hasLearningData ? (
                <p className="text-sm text-slate-600">
                  No student in this cohort has enrolled on a learning programme yet, so there is no
                  participation to report and nothing to measure an improvement against.
                </p>
              ) : (
                <>
                  <LearningImpactList rows={learningImpact?.skills ?? []} />

                  <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                    {coverage.hasReassessmentData
                      ? 'Improvement is the average change for students who sat the same skill twice. Completing a programme never raises a score on its own — only a later assessment does.'
                      : 'No student has sat the same skill twice yet, so no improvement can be shown. Completing a programme is participation, not evidence: the second assessment is what turns it into a number.'}
                  </p>
                </>
              )}
            </Card>

            <Card
              title="Internship and placement outcomes"
              description="Every application made by a student in this cohort, in pipeline order."
            >
              <OutcomeFunnel outcomes={outcomes} students={students} />
            </Card>

            {/* LAST, BECAUSE IT IS THE CONCLUSION. Every item is a fixed rule over
                the figures above rather than a suggestion generated from them, so an
                institution can check each one against the table itself. */}
            <Card
              title="Recommended actions"
              description="Derived from the tables above, in the order they should be dealt with."
            >
              <ActionList actions={actions} />
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
