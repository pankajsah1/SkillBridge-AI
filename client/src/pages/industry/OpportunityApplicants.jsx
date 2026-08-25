/**
 * Applicants for one posting, ranked.
 *
 * THE RANKING IS THE FEATURE. A recruiter with forty applications does not want a
 * list, they want an order — so the server sorts by the match score each student
 * applied at and hands back a global rank. This page renders that order and never
 * re-sorts it in the browser: a second ordering computed here would disagree with
 * the rank numbers on the cards the moment either changed.
 *
 * THE COUNTS COVER THE WHOLE POSTING, NOT THE VISIBLE PAGE. `statusCounts` comes
 * from an aggregate over every application, so the tab that says "3 shortlisted"
 * is right even while the filter is hiding them. Counting the rows on screen would
 * be wrong the instant there was a page two.
 *
 * FILTERING IS SERVER-SIDE, for the same reason it is on the student's list.
 *
 * A STATUS CHANGE REFETCHES RATHER THAN PATCHES THE ROW IN PLACE. Moving a
 * candidate can push them out of the current filter, change three counts and shift
 * everyone's rank; reconciling all of that in the browser is how a list starts
 * disagreeing with the database. One reload, one source of truth.
 *
 * OWNERSHIP IS THE SERVER'S CALL. This page is behind an INDUSTRY role route, but
 * the role only proves the visitor is *an* employer. The API refuses applications
 * for a posting this account does not own, and a 403 is rendered as exactly that
 * rather than as a generic failure.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  fetchOpportunityApplications,
  updateApplicationStatus,
} from '../../api/application.api.js';
import CandidateCard from '../../components/industry/CandidateCard.jsx';
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
  statusLabel,
} from '../../constants/applications.js';
import {
  availabilityBadge,
  availabilityFor,
  formatDeadline,
  typeLabel,
} from '../../constants/opportunities.js';
import { errorDetailsForBanner } from '../../utils/apiErrors.js';

export default function OpportunityApplicants() {
  const { id } = useParams();

  const [applications, setApplications] = useState([]);
  const [opportunity, setOpportunity] = useState(null);
  const [statusCounts, setStatusCounts] = useState({});
  const [pagination, setPagination] = useState(null);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState(null);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await fetchOpportunityApplications(id, {
        status: status ?? undefined,
        page,
      });

      setApplications(result.applications);
      setOpportunity(result.opportunity);
      setStatusCounts(result.statusCounts ?? {});
      setPagination(result.pagination);
      setTotal(result.total);
    } catch (error) {
      setLoadError(error);
      setApplications([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  /* Back to page one on a filter change — see MyApplications for why. */
  const changeFilter = (value) => {
    setStatus(value);
    setPage(1);
    setActionError(null);
    setActionMessage(null);
  };

  const changeStatus = async (applicationId, { status: next, note }) => {
    setUpdatingId(applicationId);
    setActionError(null);
    setActionMessage(null);

    try {
      const updated = await updateApplicationStatus(applicationId, { status: next, note });

      setActionMessage(
        `${updated.student?.name ?? 'This candidate'} is now marked "${statusLabel(updated.status)}".`,
      );

      await load();
    } catch (error) {
      setActionError(error);
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading && applications.length === 0 && !loadError) {
    return (
      <DashboardLayout title="Applicants" subtitle="Loading the candidates…">
        <Card>
          <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
            <Spinner />
            Loading applicants…
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  if (loadError) {
    const isForbidden = loadError.status === 403;
    const isMissing = loadError.status === 404;

    return (
      <DashboardLayout title="Applicants" subtitle="These candidates could not be shown.">
        <div className="space-y-5">
          <BackLink to="/industry/opportunities">Back to your opportunities</BackLink>

          <Alert
            variant={isForbidden || isMissing ? 'warning' : 'error'}
            title={
              isForbidden
                ? 'This posting belongs to another company'
                : isMissing
                  ? 'That opportunity could not be found'
                  : 'The applicants could not be loaded'
            }
            message={
              isForbidden
                ? 'You can only see applicants for opportunities your account posted.'
                : isMissing
                  ? 'It may have been deleted. Your other postings are still here.'
                  : (loadError.message ?? 'Please try again.')
            }
          >
            {isForbidden || isMissing ? null : (
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={() => load()}>
                  Try again
                </Button>
              </div>
            )}
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  const availability = opportunity ? availabilityFor(opportunity) : null;
  const badge = availability ? availabilityBadge(availability) : null;
  const isFiltered = status !== null;

  /* "All" carries the summed total; each status carries its own aggregate count.
     A status nobody is in still shows, with a 0 — a recruiter learning that
     nothing is at "Interview" is a real answer, and a tab that disappears when
     empty makes the pipeline look shorter than it is. */
  const allCount = APPLICATION_STATUS_VALUES.reduce(
    (sum, value) => sum + (statusCounts[value] ?? 0),
    0,
  );

  const tabs = [{ value: null, label: 'All', count: allCount }].concat(
    APPLICATION_STATUS_VALUES.map((value) => ({
      value,
      label: statusLabel(value),
      count: statusCounts[value] ?? 0,
    })),
  );

  return (
    <DashboardLayout
      title={opportunity?.title ? `Applicants — ${opportunity.title}` : 'Applicants'}
      subtitle="Ranked by the skill match each candidate applied at."
    >
      <div className="space-y-5">
        <BackLink to="/industry/opportunities">Back to your opportunities</BackLink>

        {actionError ? (
          <Alert
            variant="error"
            title="That change could not be saved"
            message={actionError.message ?? 'Please try again.'}
            errors={errorDetailsForBanner(actionError)}
          />
        ) : null}

        {actionMessage ? <Alert variant="success" message={actionMessage} /> : null}

        {opportunity ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">{opportunity.title}</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {typeLabel(opportunity.type)}
                  {opportunity.openings
                    ? ` · ${opportunity.openings} ${opportunity.openings === 1 ? 'opening' : 'openings'}`
                    : ''}
                  {opportunity.deadline ? ` · closes ${formatDeadline(opportunity.deadline)}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
                <Link
                  to={`/industry/opportunities/${id}/edit`}
                  className="text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  Edit posting →
                </Link>
              </div>
            </div>
          </Card>
        ) : null}

        <Card
          title={isFiltered ? `${statusLabel(status)} candidates` : 'All candidates'}
          description={
            allCount > 0
              ? `${allCount} ${allCount === 1 ? 'person has' : 'people have'} applied. The order is by skill match at the time of applying — the same number each candidate saw.`
              : 'Nobody has applied to this posting yet.'
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {tabs.map((tab) => {
                const isActive = tab.value === status;
                const count = tab.value === null ? allCount : tab.count;

                return (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => changeFilter(tab.value)}
                    aria-pressed={isActive}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-medium transition',
                      isActive
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-700',
                    ].join(' ')}
                  >
                    {tab.label}
                    {/* The count is part of the label, not a coloured dot — a
                        recruiter deciding which tab to open needs the number. */}
                    <span className={isActive ? 'text-primary-100' : 'text-slate-400'}>
                      {' '}
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {isLoading ? (
              <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
                <Spinner />
                Loading applicants…
              </div>
            ) : applications.length === 0 ? (
              <EmptyState
                title={
                  isFiltered
                    ? `No candidate is ${statusLabel(status).toLowerCase()}`
                    : 'No applications yet'
                }
                description={
                  isFiltered
                    ? 'Try another status, or clear the filter to see everyone who applied.'
                    : 'Students who apply will appear here, ranked by how well their verified skills match what this posting asks for.'
                }
                action={
                  isFiltered ? (
                    <Button size="sm" variant="secondary" onClick={() => changeFilter(null)}>
                      Show everyone
                    </Button>
                  ) : null
                }
              />
            ) : (
              <>
                <div className="space-y-4">
                  {applications.map((application) => (
                    <CandidateCard
                      key={application.id}
                      application={application}
                      onChangeStatus={changeStatus}
                      isUpdating={updatingId === application.id}
                    />
                  ))}
                </div>

                <Pagination
                  pagination={pagination}
                  onPageChange={setPage}
                  isLoading={isLoading}
                  label="candidates"
                />

                {total > applications.length ? (
                  <p className="text-xs text-slate-500">
                    Showing {applications.length} of {total}. Ranks run across the whole list, not
                    the page — this page starts at #{applications[0]?.rank}.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
