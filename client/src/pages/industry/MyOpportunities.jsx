/**
 * The company's own opportunities: list, filter, and every action on them.
 *
 * WHY THE STATUS ACTIONS LIVE HERE AND NOT ON THE FORM. Publish, close and reopen
 * are one-click decisions about a posting, not edits to its contents — an employer
 * closing a filled role should not have to open a form with twenty fields in it.
 * The form deliberately never sends `status` for the same reason: the server reads
 * it as a transition, and a title correction is not a transition.
 *
 * Which buttons appear comes from STATUS_TRANSITIONS, mirrored from the server's
 * copy, so a button the API would refuse cannot be rendered. The API still checks —
 * a tab left open while the posting changed elsewhere would otherwise be a way past
 * the rule.
 */

import { Link, useNavigate } from 'react-router-dom';

import OpportunityCard from '../../components/opportunities/OpportunityCard.jsx';
import OwnerFilterBar from '../../components/opportunities/OwnerFilterBar.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import {
  AVAILABILITY,
  OPPORTUNITY_STATUSES,
  statusActionsFor,
} from '../../constants/opportunities.js';
import useMyOpportunities from '../../hooks/useMyOpportunities.js';
import { errorDetailsForBanner } from '../../utils/apiErrors.js';

/** The primary-styled link to the form. Button renders a <button>, so this is a link. */
const newOpportunityLink = (
  <Link
    to="/industry/opportunities/new"
    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
  >
    Post an opportunity
  </Link>
);

/**
 * The one thing worth saying about a posting that its badge does not.
 *
 * "Draft" and "Deadline passed" say what the state is; these say what it means and
 * what to do about it. Nothing is returned for an open posting — there is nothing
 * to explain.
 */
const ownerNote = (opportunity) => {
  if (opportunity.availability === AVAILABILITY.DRAFT) {
    return 'Only you can see this. Publish it when you are ready.';
  }

  if (opportunity.availability === AVAILABILITY.EXPIRED) {
    return 'The deadline has passed, so students no longer see this. Change the deadline to reopen it to applicants.';
  }

  if (opportunity.availability === AVAILABILITY.CLOSED) {
    return 'Closed by you. Students no longer see it.';
  }

  return null;
};

/** What each destructive or irreversible-feeling action asks before doing it. */
const CONFIRMATIONS = {
  [OPPORTUNITY_STATUSES.CLOSED]:
    'Close this opportunity? Students will no longer see it. You can reopen it later.',
};

export default function MyOpportunities() {
  const navigate = useNavigate();

  const {
    opportunities,
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
  } = useMyOpportunities();

  const runStatusChange = async (opportunity, to) => {
    const question = CONFIRMATIONS[to];
    // A native confirm, matching the one destructive action in Step 3's skills
    // section. A dialog component would be the better answer if there were five of
    // these; for two, it is a component to build, style and make accessible for no
    // gain over what the browser already does correctly.
    if (question && !window.confirm(question)) return;

    try {
      await changeStatus(opportunity, to);
    } catch {
      // The hook holds the error and the banner above renders it.
    }
  };

  const runDelete = async (opportunity) => {
    if (
      !window.confirm(
        `Delete "${opportunity.title}"? This cannot be undone. If you only want to stop receiving applicants, close it instead.`,
      )
    ) {
      return;
    }

    try {
      await remove(opportunity.id);
    } catch {
      // Same: already on screen.
    }
  };

  const actionsFor = (opportunity) => (
    <>
      <Link
        to={`/industry/opportunities/${opportunity.id}/edit`}
        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Edit
      </Link>

      {statusActionsFor(opportunity.status).map((action) => (
        <Button
          key={action.to}
          size="sm"
          variant={action.variant}
          onClick={() => runStatusChange(opportunity, action.to)}
          disabled={isSaving}
        >
          {action.label}
        </Button>
      ))}

      <Button
        size="sm"
        variant="ghost"
        className="text-error-600 hover:bg-error-50"
        onClick={() => runDelete(opportunity)}
        disabled={isSaving}
      >
        Delete
      </Button>
    </>
  );

  return (
    <DashboardLayout
      title="Your opportunities"
      subtitle="Everything you have posted, including drafts only you can see."
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackLink to="/industry">Back to dashboard</BackLink>
          {newOpportunityLink}
        </div>

        {saveError ? (
          <Alert
            variant="error"
            title="That did not work"
            message={saveError.message}
            // Fields stripped on purpose: "choose a new deadline before reopening"
            // is the actionable half of that error and there is no deadline input
            // on this page for Alert to defer to.
            errors={errorDetailsForBanner(saveError)}
          />
        ) : null}

        {successMessage ? <Alert variant="success" message={successMessage} /> : null}

        <OwnerFilterBar
          filters={filters}
          onChange={(next) => {
            clearFeedback();
            applyFilters(next);
          }}
          onClear={() => {
            clearFeedback();
            clearFilters();
          }}
          hasActiveFilters={hasActiveFilters}
          disabled={isSaving}
        />

        {loadError ? (
          <Alert
            variant="error"
            title="Your opportunities could not be loaded"
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
              Loading your opportunities…
            </div>
          </Card>
        ) : null}

        {!isLoading && !loadError && opportunities.length === 0 ? (
          <Card>
            {/* Two different empty lists, and conflating them is how someone
                concludes their postings were deleted when they are one filter
                away. */}
            {hasActiveFilters ? (
              <EmptyState
                title="No opportunities match these filters"
                description="Try a different status or type, or clear the filters to see everything you have posted."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="You have not posted anything yet"
                description="Post your first opportunity and students can start finding it straight away."
                action={
                  <Button onClick={() => navigate('/industry/opportunities/new')}>
                    Post an opportunity
                  </Button>
                }
              />
            )}
          </Card>
        ) : null}

        {!isLoading && opportunities.length > 0 ? (
          <div className="space-y-4">
            <ul className="space-y-3">
              {opportunities.map((opportunity) => (
                <li key={opportunity.id}>
                  <OpportunityCard
                    opportunity={opportunity}
                    titleTo={`/industry/opportunities/${opportunity.id}/edit`}
                    actions={actionsFor(opportunity)}
                    note={ownerNote(opportunity)}
                  />
                </li>
              ))}
            </ul>

            <Pagination
              pagination={pagination}
              onPageChange={setPage}
              isLoading={isLoading || isSaving}
              label="opportunities"
            />
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
