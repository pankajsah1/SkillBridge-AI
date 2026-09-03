/**
 * The publisher's own learning programmes: what they listed, and what to do about it.
 *
 * ONE MANAGEMENT LIST, NOT A NEW DASHBOARD. This is the learning twin of
 * MyOpportunities and deliberately reads like it — same header, same filter row, same
 * status buttons, same native confirm before anything irreversible. A publisher who has
 * used one page already knows this one.
 *
 * THE STATUS BUTTONS COME FROM THE TRANSITION TABLE, not from a hardcoded list.
 * `programStatusActionsFor` mirrors the server's rules, so a button the API would refuse
 * cannot appear — and "Publish" versus "Restore" is decided by where the programme is
 * coming from, because those are different promises to the person clicking.
 *
 * THERE IS NO UNPUBLISH, only Archive. Learners may already be enrolled, and making
 * their programme vanish is not something a publisher should be able to do. Archiving is
 * visible, honest and reversible — the same judgement recorded on the server's
 * transition table.
 *
 * NUMBERS, NEVER NAMES. Each row shows its enrolment and completion counts because that
 * is what the API sends a publisher. Who enrolled is the learner's business, and there
 * is nowhere on this page it could leak from.
 */

import { Link } from 'react-router-dom';

import ProgramCard from '../../components/learning/ProgramCard.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import SearchInput from '../../components/opportunities/SearchInput.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Select from '../../components/ui/Select.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import {
  LEARNING_PROGRAM_STATUSES,
  LEARNING_PROGRAM_STATUS_LABELS,
  LEARNING_PROGRAM_STATUS_VALUES,
  LEARNING_PROGRAM_TYPE_LABELS,
  LEARNING_PROGRAM_TYPE_ORDER,
  programStatusActionsFor,
} from '../../constants/learning.js';
import useMyLearningPrograms from '../../hooks/useMyLearningPrograms.js';

const statusOptions = LEARNING_PROGRAM_STATUS_VALUES.map((status) => ({
  value: status,
  label: LEARNING_PROGRAM_STATUS_LABELS[status],
}));

const typeOptions = LEARNING_PROGRAM_TYPE_ORDER.map((type) => ({
  value: type,
  label: LEARNING_PROGRAM_TYPE_LABELS[type],
}));

/** What each irreversible-feeling action asks first. */
const CONFIRMATIONS = {
  [LEARNING_PROGRAM_STATUSES.ARCHIVED]:
    'Archive this program? Learners will no longer find it in the catalogue, and anyone already enrolled keeps their record. You can restore it later.',
};
export default function MyLearningPrograms() {
  const {
    programs,
    total,
    summary,
    pagination,
    filters,
    applyFilters,
    clearFilters,
    hasActiveFilters,
    setPage,
    isLoading,
    loadError,
    reload,
    isSaving,
    saveError,
    successMessage,
    clearFeedback,
    remove,
    changeStatus,
  } = useMyLearningPrograms();

  const counts = summary ?? {};

  const runStatusChange = async (program, to) => {
    const question = CONFIRMATIONS[to];
    // A native confirm, matching MyOpportunities. A dialog component would be the
    // better answer if there were five of these; for two it is a component to build,
    // style and make accessible for no gain over what the browser already does.
    if (question && !window.confirm(question)) return;

    try {
      await changeStatus(program, to);
    } catch {
      // The hook holds the error and the banner above renders it.
    }
  };

  const runDelete = async (program) => {
    if (
      !window.confirm(
        `Delete "${program.title}"? This cannot be undone. If learners are enrolled the server will refuse — archive it instead.`,
      )
    ) {
      return;
    }

    try {
      await remove(program.id);
    } catch {
      // Same: already on screen. A refused delete ("learners are enrolled") is the
      // case that matters, and it is the server's sentence, not one invented here.
    }
  };

  const actionsFor = (program) => (
    <>
      <Link
        to={`/industry/learning-programs/${program.id}/edit`}
        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Edit
      </Link>

      {programStatusActionsFor(program.status).map((action) => (
        <Button
          key={action.to}
          size="sm"
          variant={action.variant}
          onClick={() => runStatusChange(program, action.to)}
          disabled={isSaving}
        >
          {action.label}
        </Button>
      ))}

      <Button
        size="sm"
        variant="ghost"
        className="text-error-600 hover:bg-error-50"
        onClick={() => runDelete(program)}
        disabled={isSaving}
      >
        Delete
      </Button>
    </>
  );
  return (
    <DashboardLayout
      title="Your learning programs"
      subtitle="Courses, certifications, workshops, training and mentorships you have listed — including drafts only you can see."
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackLink to="/industry">Back to dashboard</BackLink>

          <Link
            to="/industry/learning-programs/new"
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            New program
          </Link>
        </div>

        {/* The counts are the server's, computed over every programme rather than the
            page on screen. `enrollments` and `completions` are the only learner
            information a publisher is given anywhere in this feature. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Open', value: counts.open ?? 0 },
            { label: 'Drafts', value: counts.drafts ?? 0 },
            { label: 'Enrollments', value: counts.enrollments ?? 0 },
            { label: 'Completions', value: counts.completions ?? 0 },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {saveError ? (
          <Alert
            variant="error"
            title="That did not work"
            message={saveError.message}
            errors={saveError.errors}
          />
        ) : null}

        {successMessage ? <Alert variant="success" message={successMessage} /> : null}

        <Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <SearchInput
                value={filters.search}
                onChange={(search) => {
                  clearFeedback();
                  applyFilters({ search });
                }}
                label="Search your programs"
                placeholder="Title, provider or instructor"
                disabled={isSaving}
              />
            </div>

            <Select
              label="Status"
              value={filters.status}
              onChange={(event) => {
                clearFeedback();
                applyFilters({ status: event.target.value });
              }}
              options={statusOptions}
              placeholder="Any status"
              disabled={isSaving}
            />

            <Select
              label="Type"
              value={filters.type}
              onChange={(event) => {
                clearFeedback();
                applyFilters({ type: event.target.value });
              }}
              options={typeOptions}
              placeholder="Any type"
              disabled={isSaving}
            />
          </div>

          {hasActiveFilters ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  clearFeedback();
                  clearFilters();
                }}
                disabled={isSaving}
              >
                Clear filters
              </Button>
            </div>
          ) : null}
        </Card>

        {loadError ? (
          <Alert
            variant="error"
            title="Your programs could not be loaded"
            message={loadError.message}
          >
            <Button size="sm" variant="secondary" onClick={() => reload()}>
              Try again
            </Button>
          </Alert>
        ) : null}

        {isLoading ? (
          <Card>
            <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
              <Spinner />
              Loading your programs…
            </div>
          </Card>
        ) : null}

        {!isLoading && !loadError && programs.length === 0 ? (
          <Card>
            {/* Two different empty lists, and conflating them is how someone concludes
                their programmes were deleted when they are one filter away. */}
            {hasActiveFilters ? (
              <EmptyState
                title="No programs match these filters"
                description="Try a different status or type, or clear the filters to see everything you have listed."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="You have not listed a program yet"
                description="List a course, certification, workshop, training or mentorship and it can be recommended to the students whose skill gaps it closes."
                action={
                  <Link
                    to="/industry/learning-programs/new"
                    className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
                  >
                    List your first program
                  </Link>
                }
              />
            )}
          </Card>
        ) : null}

        {!isLoading && !loadError && programs.length > 0 ? (
          <>
            <p className="text-sm text-slate-500">
              {total} {total === 1 ? 'program' : 'programs'}
              {hasActiveFilters ? ' matching these filters' : ''}, newest first.
            </p>

            <ul className="space-y-3">
              {programs.map((program) => (
                <li key={program.id}>
                  <ProgramCard
                    program={program}
                    titleTo={`/industry/learning-programs/${program.id}/edit`}
                    // `enrollment` on a publisher's row is a set of counts, which is
                    // why it is passed under a differently named prop — ProgramCard
                    // refuses to guess which meaning it holds.
                    enrollmentCounts={program.enrollment}
                    actions={actionsFor(program)}
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
        ) : null}
      </div>
    </DashboardLayout>
  );
}

