/**
 * Browse opportunities — the academician's discovery page (/academician/opportunities).
 *
 * NO NEW ENDPOINT, AND NOTHING FOR ONE TO DO. GET /opportunities derives the audience
 * from the caller's role, so this page asks for the same list the student page asks
 * for and the server decides which postings that means. An academician cannot see
 * student internships here and a student cannot see FDPs there, without either page
 * naming an audience.
 *
 * THE HOOK IS `useOpportunities` UNCHANGED — same four filter dimensions, same
 * pagination, same stale-response guard. `StudentFilterBar` is the same bar too; it
 * takes the type vocabulary as a prop, and this page passes the academician one.
 *
 * ONE TYPE AT A TIME, AND DELIBERATELY NO "ALL COLLABORATIONS" OPTION. The discovery
 * endpoint's `type` parameter takes a single value. A group filter would have to fire
 * four requests and merge them, and the merged list's total and page count would then
 * be numbers the server never said — the previous version of this page filtered by
 * `COLLABORATION_TYPES[0]` and silently showed one type out of four. So the dropdown
 * offers the eight types individually, and the note above it says which are which.
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
import {
  AUDIENCES,
  COLLABORATION_TYPES,
  PROGRAMME_TYPES,
  typeLabel,
  typeOrderFor,
} from '../../constants/opportunities.js';

/**
 * The eight academician types, in the constants' own display order.
 *
 * Derived rather than listed, for the same reason the dashboard derives its two
 * cards: `TYPES_BY_AUDIENCE` is what the server will accept, so a ninth type appears
 * in this dropdown by being added there and nowhere else.
 */
const TYPE_OPTIONS = typeOrderFor(AUDIENCES.ACADEMICIAN).map((type) => ({
  value: type,
  label: typeLabel(type),
}));

/** "Research Collaboration, Consultancy, Mentorship and Guest Lecture". */
const nameList = (types) => {
  const labels = types.map(typeLabel);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
};

const COLLABORATION_NAMES = nameList(COLLABORATION_TYPES);
const PROGRAMME_NAMES = nameList(PROGRAMME_TYPES);

const BROWSE_LINK =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50';

export default function AcademicianOpportunities() {
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
   * The same catalogue the profile's skills section reads.
   *
   * The skills filter sends ids, so the names have to come from somewhere, and that
   * somewhere is GET /skills — the same list an academician's own skills are chosen
   * from, which is what makes a filter and a profile comparable at all.
   */
  const { catalogue, isLoading: isLoadingCatalogue, error: catalogueError } = useSkillCatalogue();

  return (
    <DashboardLayout
      title="Opportunities"
      subtitle="Collaborations and faculty programmes that companies have open to academics right now."
    >
      <div className="space-y-5">
        <BackLink to="/academician">Back to dashboard</BackLink>

        {/* Said once, above the filter, because the type names in the dropdown do not
            say it themselves — "Industrial Training" does not announce that you are
            the one being trained. Both sentences are generated from the same two
            arrays the dashboard sums with, so a type cannot end up described here as
            one thing and counted there as the other. */}
        <Card title="Two kinds of posting">
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">Collaborations</span> —{' '}
            {COLLABORATION_NAMES} — are where you bring the expertise.{' '}
            <span className="font-medium text-slate-900">Programmes</span> —{' '}
            {PROGRAMME_NAMES} — are where you gain it. Both are listed together below;
            filter by type to see one at a time.
          </p>
        </Card>

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
          typeOptions={TYPE_OPTIONS}
        />

        {loadError ? (
          <Alert
            variant="error"
            title="Opportunities could not be loaded"
            message={loadError.message}
            errors={loadError.errors}
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
                different facts, and telling someone the second when the first is true
                is how they conclude the portal is empty. */}
            {hasActiveFilters ? (
              <EmptyState
                title="No opportunities match these filters"
                description="Try a different type or work mode, widen the location, or clear the filters to see every collaboration and programme that is open."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="Nothing is open right now"
                description="No collaborations or faculty programmes are currently accepting applications. Keep your expertise and skills up to date so matching has something to work with when the next one is posted."
                action={
                  <Link to="/academician/profile" className={BROWSE_LINK}>
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
              {/* Soonest deadline first, which is the server's ordering — this page
                  does not rank by fit. That is what /academician/matches is for, and
                  saying so keeps the two lists from looking like the same list in a
                  different order. */}
              <span className="text-slate-400"> · closing soonest first</span>
            </p>

            <ul className="space-y-3">
              {opportunities.map((opportunity) => (
                <li key={opportunity.id}>
                  <OpportunityCard
                    opportunity={opportunity}
                    showIndustry
                    titleTo={`/academician/opportunities/${opportunity.id}`}
                    actions={
                      <Link
                        to={`/academician/opportunities/${opportunity.id}`}
                        className={BROWSE_LINK}
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
