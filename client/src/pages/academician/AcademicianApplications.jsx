/**
 * Applications and registrations an academician has submitted — /academician/applications.
 *
 * ONE ENDPOINT, AND IT NEVER NAMES A ROLE. GET /applications/me is guarded by
 * `allowRoles(...APPLICANT_ROLE_VALUES)` — students and academicians are both
 * applicants — and the service scopes the list by the applicant on the token. So this
 * page asks for "mine" and the server decides what mine means. No academician id is
 * sent, which is what makes the ownership rule structural rather than a check someone
 * could forget to write.
 *
 * TWO WORDS FOR ONE RECORD, AND THE ROW USES THE TRUE ONE. A Research Collaboration is
 * something you *apply* to; a Faculty Development Programme is something you *register*
 * for. Same document, same statuses, same endpoint — but calling an FDP seat an
 * "application" reads as though a company is still deciding, so `isCollaborationType`
 * picks the verb per row. Nothing about the data changes.
 *
 * THE STATUS IS THE POINT OF THE PAGE, so it leads every row. The timeline is one click
 * away rather than always open, because five stages times eight rows is a page of
 * scrolling for information most rows do not have yet.
 *
 * FILTERING IS SERVER-SIDE. The list is paginated, so narrowing the current page in the
 * browser would hide matching rows sitting on page two — `?status=` goes to the API.
 *
 * THE SCORE IS THE SNAPSHOT, LABELLED AS ONE. `matchScoreAtApplication` is what it was
 * on the day, so improving a profile afterwards does not change what the company sees.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchMyApplications } from '../../api/application.api.js';
import ApplicationStatusTimeline from '../../components/student/ApplicationStatusTimeline.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import {
  APPLICATION_STATUS_VALUES,
  formatApplicationDate,
  relativeDays,
  statusLabel,
  statusMeaning,
  statusVariant,
} from '../../constants/applications.js';
import { isCollaborationType, typeLabel, workModeLabel } from '../../constants/opportunities.js';

/** The filter chips. "All" is a value of null rather than a status. */
const FILTERS = [{ value: null, label: 'All' }].concat(
  APPLICATION_STATUS_VALUES.map((value) => ({ value, label: statusLabel(value) })),
);

/**
 * "Applied" or "Registered", from the posting's type.
 *
 * Falls back to the application wording when the posting is gone: a record with no
 * opportunity attached cannot be classified, and "Applied" is the safer of the two
 * because it claims less.
 */
const verbFor = (opportunity) =>
  opportunity && !isCollaborationType(opportunity.type) ? 'Registered' : 'Applied';

/** One application or registration. Collapsed to a summary until it is opened. */
function ApplicationRow({ application }) {
  const [isOpen, setIsOpen] = useState(false);

  const opportunity = application.opportunity;
  const title = opportunity?.title ?? 'This opportunity';
  const company = opportunity?.industry?.name ?? null;
  const submitted = relativeDays(application.appliedAt);
  const verb = verbFor(opportunity);

  return (
    <li className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(application.status)}>
              {statusLabel(application.status)}
            </Badge>
            {submitted ? (
              <span className="text-xs text-slate-500">
                {verb} {submitted}
              </span>
            ) : null}
          </div>

          {/* The posting may have been closed or removed since. The row still stands
              on its own — your own history should not disappear because a company
              tidied up — so the link only appears when there is one to make. */}
          {opportunity ? (
            <Link
              to={`/academician/opportunities/${opportunity.id}`}
              className="mt-2 block text-sm font-semibold text-slate-900 hover:text-primary-700"
            >
              {title}
            </Link>
          ) : (
            <p className="mt-2 text-sm font-semibold text-slate-900">{title}</p>
          )}

          <p className="mt-0.5 text-xs text-slate-500">
            {[
              company,
              opportunity?.type ? typeLabel(opportunity.type) : null,
              opportunity?.location
                ? `${opportunity.location}${opportunity.workMode ? ` · ${workModeLabel(opportunity.workMode)}` : ''}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'This posting is no longer listed.'}
          </p>
        </div>

        {typeof application.matchScoreAtApplication === 'number' ? (
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums text-slate-900">
              {application.matchScoreAtApplication}%
            </p>
            <p className="text-[11px] leading-tight text-slate-500">
              match at the time
              <br />
              you {verb.toLowerCase()}
            </p>
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-slate-600">{statusMeaning(application.status)}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        <Button size="sm" variant="secondary" onClick={() => setIsOpen((value) => !value)}>
          {isOpen ? 'Hide progress' : 'Show progress'}
        </Button>

        {formatApplicationDate(application.appliedAt) ? (
          <span className="text-xs text-slate-500">
            Submitted {formatApplicationDate(application.appliedAt)}
          </span>
        ) : null}
      </div>

      {isOpen ? (
        <div className="mt-4">
          <ApplicationStatusTimeline
            status={application.status}
            statusHistory={application.statusHistory}
          />

          {application.coverNote ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500">The note you sent</p>
              <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                {application.coverNote}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function AcademicianApplications() {
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await fetchMyApplications({ status: status ?? undefined, page });
      setApplications(result.applications);
      setPagination(result.pagination);
      setTotal(result.total);
    } catch (error) {
      setLoadError(error);
      setApplications([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  /* Changing the filter goes back to page one — page 3 of "all" is rarely page 3 of
     "shortlisted", and landing on an empty page reads as "none found". */
  const changeFilter = (value) => {
    setStatus(value);
    setPage(1);
  };

  const isFiltered = status !== null;

  return (
    <DashboardLayout
      title="Your applications and registrations"
      subtitle="Every collaboration you have applied to and every programme you have registered for, and where each one stands."
    >
      <div className="space-y-5">
        <BackLink to="/academician">Back to dashboard</BackLink>

        {loadError ? (
          <Alert
            variant="error"
            title="Your applications could not be loaded"
            message={loadError.message ?? 'Please try again.'}
            errors={loadError.errors}
          >
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => load()}>
                Try again
              </Button>
            </div>
          </Alert>
        ) : null}

        <Card
          title={isFiltered ? `${statusLabel(status)} submissions` : 'Everything you have submitted'}
          description={
            total > 0
              ? `${total} ${total === 1 ? 'submission' : 'submissions'}${isFiltered ? ' with this status' : ''}.`
              : 'Applications and registrations you submit will appear here.'
          }
          action={
            <Link
              to="/academician/matches"
              className="text-sm font-medium text-primary-700 hover:text-primary-800"
            >
              Find opportunities →
            </Link>
          }
        >

          <div className="space-y-4">
            {/* Buttons rather than a Select: six options is few enough to show, and
                the current filter being visible saves opening a menu to remember
                what is being looked at. */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {FILTERS.map((filter) => {
                const isActive = filter.value === status;

                return (
                  <button
                    key={filter.label}
                    type="button"
                    onClick={() => changeFilter(filter.value)}
                    aria-pressed={isActive}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-medium transition',
                      isActive
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-700',
                    ].join(' ')}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {isLoading ? (
              <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
                <Spinner />
                Loading your applications…
              </div>
            ) : applications.length === 0 ? (
              <EmptyState
                title={
                  isFiltered
                    ? `Nothing is ${statusLabel(status).toLowerCase()}`
                    : 'You have not applied to anything yet'
                }
                description={
                  isFiltered
                    ? 'Try another status, or clear the filter to see everything you have submitted.'
                    : 'Browse the collaborations and faculty programmes companies have posted, or start with the ones matched to your expertise — every submission records the match score it was made at.'
                }
                action={
                  isFiltered ? (
                    <Button size="sm" variant="secondary" onClick={() => changeFilter(null)}>
                      Show all
                    </Button>
                  ) : (
                    <Link
                      to="/academician/matches"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
                    >
                      See your matches
                    </Link>
                  )
                }
              />
            ) : (
              <>
                <ul className="space-y-3">
                  {applications.map((application) => (
                    <ApplicationRow key={application.id} application={application} />
                  ))}
                </ul>

                <Pagination
                  pagination={pagination}
                  onPageChange={setPage}
                  isLoading={isLoading}
                  label="submissions"
                />
              </>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
