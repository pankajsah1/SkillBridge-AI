/**
 * Browse opportunities — the student's discovery page.
 *
 * WHAT THIS PAGE DELIBERATELY DOES NOT HAVE, and it is not an oversight: no Apply
 * button, no application form, no match percentage, no "recommended for you". Every
 * one of those depends on a model or an engine that this step does not build, and a
 * button that looks like it applies but does nothing is worse at a demo than no
 * button — the first thing a judge does is click it.
 *
 * The list only ever contains postings a student can act on, and that is enforced
 * in the API rather than here: GET /opportunities filters to `status: active` with a
 * deadline that has not passed. A browser with a wrong clock cannot make an expired
 * posting appear, and this page never second-guesses what it was sent.
 */

import { Link } from 'react-router-dom';

import OpportunityCard from '../../components/opportunities/OpportunityCard.jsx';
import StudentFilterBar from '../../components/opportunities/StudentFilterBar.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import useOpportunities from '../../hooks/useOpportunities.js';
import useSkillCatalogue from '../../hooks/useSkillCatalogue.js';

export default function BrowseOpportunities() {
  const {
    opportunities,
    total,
    pagination,
    filters,
    applyFilters,
    toggleSkill,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    setPage,
    isLoading,
    loadError,
    reload,
  } = useOpportunities();

  /**
   * The same catalogue endpoint the profile and the employer's form use.
   *
   * Skills are filtered by id, so the names have to come from somewhere — and that
   * somewhere is the one shared catalogue, not a list copied into this page.
   */
  const { catalogue, isLoading: isLoadingCatalogue, error: catalogueError } = useSkillCatalogue();

  return (
    <DashboardLayout
      title="Opportunities"
      subtitle="Internships, entry-level jobs, apprenticeships and live projects that are open now."
    >
      <div className="space-y-5">
        <BackLink to="/student">Back to dashboard</BackLink>

        <StudentFilterBar
          filters={filters}
          onChange={applyFilters}
          onToggleSkill={toggleSkill}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          catalogue={catalogue}
          isLoadingCatalogue={isLoadingCatalogue}
          catalogueError={catalogueError}
        />

        {loadError ? (
          <Alert
            variant="error"
            title="Opportunities could not be loaded"
            message={loadError.message}
          >
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => reload()}>
                Try again
              </Button>
            </div>
          </Alert>
        ) : null}

        {isLoading ? (
          <Card>
            <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
              <Spinner />
              Finding opportunities…
            </div>
          </Card>
        ) : null}

        {!isLoading && !loadError && opportunities.length === 0 ? (
          <Card>
            {/* "Nothing matches your filters" and "nothing is open at all" are
                different facts, and telling a student the second when the first is
                true is how they conclude the portal is empty. */}
            {hasActiveFilters ? (
              <EmptyState
                title="No opportunities match these filters"
                description="Try a different type or work mode, widen the location, or clear the filters to see everything that is open."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No opportunities are open right now"
                description="Nothing has been posted yet, or everything that was posted has passed its deadline. Keep your profile and skills up to date so you are ready when something opens."
                action={
                  <Link
                    to="/student/profile"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Update your profile
                  </Link>
                }
              />
            )}
          </Card>
        ) : null}

        {!isLoading && opportunities.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              <span className="font-medium tabular-nums text-slate-700">{total}</span>{' '}
              {total === 1 ? 'opportunity' : 'opportunities'}
              {hasActiveFilters ? ' match your filters' : ' open now'}
              {/* Soonest deadline first, which is the server's ordering. Said out
                  loud because an unexplained order looks arbitrary. */}
              <span className="text-slate-400"> · closing soonest first</span>
            </p>

            <ul className="space-y-3">
              {opportunities.map((opportunity) => (
                <li key={opportunity.id}>
                  <OpportunityCard
                    opportunity={opportunity}
                    showIndustry
                    titleTo={`/student/opportunities/${opportunity.id}`}
                    actions={
                      <Link
                        to={`/student/opportunities/${opportunity.id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        View details
                      </Link>
                    }
                  />
                </li>
              ))}
            </ul>

            <Pagination
              pagination={pagination}
              onPageChange={setPage}
              isLoading={isLoading}
              label="opportunities"
            />
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
