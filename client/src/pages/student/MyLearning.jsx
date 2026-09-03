/**
 * My Learning — everything this student is learning, and where they are in it.
 *
 * THE COUNTS COME FROM THE SERVER'S SUMMARY, NOT FROM THE ROWS ON SCREEN. The API
 * computes them over every enrolment in the database, so page two still says "6
 * programs" rather than "2". Counting the current page would make the header lie the
 * moment the list is filtered or paginated.
 *
 * "CONTINUE WHERE YOU LEFT OFF" IS ALSO THE SERVER'S PICK — the most recently touched
 * unfinished enrolment, `summary.continueWith`. The first row of page one is the newest
 * enrolment, which is a different thing.
 *
 * THE REASSESSMENT PROMPT APPEARS ON THE ROW THAT JUST COMPLETED, AND ONLY THERE.
 * `completion.justCompleted` is a one-shot event, so a list of finished programmes does
 * not become a wall of identical prompts; the standing invitation lives on each
 * programme's own page, where there is room for it.
 *
 * NOTHING HERE RAISES A SKILL LEVEL. Progress and completion are the student's own
 * report of their learning. Skill levels come from assessments, and the prompt is how
 * this page says so.
 */

import { Link } from 'react-router-dom';

import EnrollmentProgress from '../../components/learning/EnrollmentProgress.jsx';
import ProgramCard from '../../components/learning/ProgramCard.jsx';
import ReassessmentPrompt from '../../components/learning/ReassessmentPrompt.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { ENROLLMENT_PIPELINE, enrollmentStatusLabel } from '../../constants/learning.js';
import useMyLearning from '../../hooks/useMyLearning.js';

/** The tabs: everything, then the three statuses in the order they happen. */
const TABS = [{ value: '', label: 'All' }].concat(
  ENROLLMENT_PIPELINE.map((status) => ({ value: status, label: enrollmentStatusLabel(status) })),
);

/** Which summary number belongs under which tab. */
const TAB_COUNT_KEYS = Object.freeze({
  '': 'total',
  enrolled: 'enrolled',
  in_progress: 'inProgress',
  completed: 'completed',
});

/** One number in the header strip. */
function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
export default function MyLearning() {
  const {
    enrollments,
    total,
    summary,
    pagination,
    status,
    applyStatus,
    hasActiveFilters,
    setPage,
    isLoading,
    loadError,
    reload,
    savingId,
    saveError,
    successMessage,
    completion,
    saveProgress,
  } = useMyLearning();

  const counts = summary ?? {};
  const continueWith = summary?.continueWith ?? null;

  return (
    <DashboardLayout
      title="My learning"
      subtitle="Your enrollments, the progress you have reported, and what to reassess once you finish."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackLink to="/student">Back to dashboard</BackLink>

          <Link
            to="/student/learning"
            className="text-sm font-medium text-primary-700 transition hover:text-primary-800"
          >
            Find something new to learn →
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Programs" value={counts.total ?? 0} />
          <Stat label="Not started" value={counts.enrolled ?? 0} />
          <Stat label="In progress" value={counts.inProgress ?? 0} />
          <Stat label="Completed" value={counts.completed ?? 0} />
        </div>

        {/* Only worth showing when there is somewhere to resume. Repeating the top row
            of the list below it would be noise. */}
        {continueWith?.program ? (
          <Card title="Continue where you left off">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{continueWith.program.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {continueWith.program.provider} · {continueWith.progress}% reported
                </p>
              </div>

              <Link
                to={`/student/learning/${continueWith.programId}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Continue
              </Link>
            </div>
          </Card>
        ) : null}

        {successMessage ? <Alert variant="success" message={successMessage} /> : null}

        {saveError ? (
          <Alert
            variant="error"
            title="That progress did not save"
            message={saveError.message}
            errors={saveError.errors}
          />
        ) : null}

        {/* Tabs rather than a select: three states, each with a number worth seeing at
            a glance. The count comes from the summary, so it is the whole total for
            that status and not this page's share of it. */}
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter by status">
          {TABS.map((tab) => {
            const isActive = status === tab.value;
            const count = counts[TAB_COUNT_KEYS[tab.value]];

            return (
              <button
                key={tab.value || 'all'}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => applyStatus(tab.value)}
                disabled={isLoading}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
                  isActive
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                {tab.label}
                {typeof count === 'number' ? (
                  <span className="ml-1.5 tabular-nums text-slate-400">{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {loadError ? (
          <Alert
            variant="error"
            title="Your learning could not be loaded"
            message={loadError.message}
            errors={loadError.errors}
          >
            <Button type="button" variant="secondary" size="sm" onClick={reload}>
              Try again
            </Button>
          </Alert>
        ) : null}

        {isLoading ? (
          <Card>
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          </Card>
        ) : enrollments.length === 0 ? (
          <Card>
            {/* "Nothing in this tab" and "nothing at all" are different situations, and
                only the second one means the student has not started. */}
            {hasActiveFilters ? (
              <EmptyState
                title={`Nothing is ${enrollmentStatusLabel(status).toLowerCase()}`}
                description="Your other programs are under the remaining tabs."
                action={
                  <Button type="button" variant="secondary" size="sm" onClick={() => applyStatus('')}>
                    Show all
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="You have not enrolled in anything yet"
                description="The learning hub recommends programs from the gaps between your skills and your target role — that is the quickest way to find one worth your time."
                action={
                  <Link
                    to="/student/learning"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
                  >
                    Browse the learning hub
                  </Link>
                }
              />
            )}
          </Card>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              {total} {total === 1 ? 'program' : 'programs'}
              {hasActiveFilters ? ` ${enrollmentStatusLabel(status).toLowerCase()}` : ''}, newest
              enrollment first.
            </p>

            <ul className="space-y-3">
              {enrollments.map((enrollment) => (
                <li key={enrollment.id}>
                  <ProgramCard
                    program={enrollment.program}
                    titleTo={`/student/learning/${enrollment.programId}`}
                    note={
                      <div className="space-y-3">
                        <EnrollmentProgress
                          enrollment={enrollment}
                          onSave={(progress) => saveProgress(enrollment.id, progress).catch(() => {})}
                          isSaving={savingId === enrollment.id}
                          disabled={Boolean(savingId) && savingId !== enrollment.id}
                        />

                        {/* Only on the row that just crossed 100%. */}
                        {completion?.justCompleted && completion.enrollmentId === enrollment.id ? (
                          <ReassessmentPrompt
                            skills={completion.skillsToReassess}
                            programTitle={enrollment.program?.title}
                            justCompleted
                          />
                        ) : null}
                      </div>
                    }
                  />
                </li>
              ))}
            </ul>

            <Pagination
              pagination={pagination}
              onPageChange={setPage}
              isLoading={isLoading}
              label="programs"
            />
          </>
        )}

      </div>
    </DashboardLayout>
  );
}

