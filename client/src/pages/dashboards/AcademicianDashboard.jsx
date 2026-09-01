/**
 * The academician dashboard — /academician.
 *
 * FIVE CARDS, ONE REQUEST. Profile completion, relevant opportunities, active
 * applications, collaboration opportunities and upcoming programmes all come out of
 * GET /academicians/dashboard. Every number in that payload is a MongoDB count over a
 * whole collection, so nothing here is hardcoded and nothing is added up in the
 * browser: the two type cards read `opportunities.collaborations` and
 * `opportunities.programmes`, both summed server-side from the same per-type counts
 * listed beneath them.
 *
 * NO ID IS SENT. `fetchDashboard()` takes no argument — the server reads the
 * academician from the token — which is why "show me someone else's dashboard" is not
 * a check that could be forgotten here.
 *
 * THE COMPLETION CARD IS THE PORTFOLIO'S PANEL. `profileCompletion` has exactly the
 * shape it renders, so the score, the missing sections and the server's own advice
 * arrive without a second implementation of the scoring rules. Its destinations are
 * routes rather than in-page anchors, because from here the thing to edit is on
 * another page.
 *
 * A FIRST VISIT IS NOT AN ERROR. `hasProfile: false` replaces the panel with a create
 * prompt, and `matches.reason === 'no-profile'` replaces the ranked list with the same
 * invitation — matching has nothing to compare against until a profile exists.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchDashboard } from '../../api/academician.api.js';
import {
  APPLICATION_STATUS_VALUES,
  statusLabel,
  statusVariant,
} from '../../constants/applications.js';
import {
  AUDIENCES,
  TYPES_BY_AUDIENCE,
  isCollaborationType,
  isProgrammeType,
  typeLabel,
} from '../../constants/opportunities.js';
import { completionMessage } from '../../constants/academicians.js';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import OpportunityCard from '../../components/opportunities/OpportunityCard.jsx';
import PortfolioCompletionPanel from '../../components/portfolio/PortfolioCompletionPanel.jsx';
import { MatchScoreChip } from '../../components/student/MatchBreakdown.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';

/** The shared style for a card's primary action, as every other dashboard writes it. */
const ACTION_LINK =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700';

/**
 * Completion key -> where to fix it, as a route.
 *
 * The same keys the profile page maps, pointing at that page instead of at anchors on
 * this one. The hash suffixes match the ids `AcademicianProfile` renders, so a click
 * lands on the right card once the page has loaded.
 */
const DESTINATIONS = Object.freeze({
  summary: { to: '/academician/profile', label: 'Edit your details' },
  position: { to: '/academician/profile', label: 'Edit your details' },
  expertise: { to: '/academician/profile', label: 'Add areas' },
  researchInterests: { to: '/academician/profile', label: 'Add interests' },
  skills: { to: '/academician/profile#skills', label: 'Manage skills' },
  education: {
    to: '/academician/profile#academician-education',
    label: 'Add a qualification',
  },
  experience: {
    to: '/academician/profile#academician-experiences',
    label: 'Add a position',
  },
  industryExperience: {
    to: '/academician/profile#academician-experiences',
    label: 'Add industry work',
  },
  achievements: {
    to: '/academician/profile#academician-achievements',
    label: 'Add an achievement',
  },
});

/**
 * Which types belong on which card, derived rather than listed.
 *
 * `TYPES_BY_AUDIENCE` fixes the order and `isCollaborationType`/`isProgrammeType` are
 * the single definition of the split — the same two predicates the server sums with.
 * Adding a ninth academician type updates both cards without touching this file.
 */
const ACADEMICIAN_TYPES = TYPES_BY_AUDIENCE[AUDIENCES.ACADEMICIAN];
const COLLABORATION_TYPE_ORDER = ACADEMICIAN_TYPES.filter(isCollaborationType);
const PROGRAMME_TYPE_ORDER = ACADEMICIAN_TYPES.filter(isProgrammeType);

/**
 * One of the two "what is open" cards: a headline count, then the same count broken
 * down by type so the number is auditable rather than asserted.
 *
 * Types with nothing open are still listed, at zero. A card that silently drops them
 * would leave an academician unable to tell "no consultancy postings" from "this portal
 * does not do consultancy".
 */
function TypeCountCard({ title, description, total, singular, plural, types, byType, note }) {
  return (
    <Card
      title={title}
      description={description}
      action={
        <Link to="/academician/opportunities" className={ACTION_LINK}>
          Browse
        </Link>
      }
    >
      <p className="text-3xl font-semibold tabular-nums text-slate-900">{total ?? 0}</p>
      <p className="mt-0.5 text-sm text-slate-600">open {total === 1 ? singular : plural}</p>

      <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3.5">
        {types.map((type) => (
          <li key={type} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600">{typeLabel(type)}</span>
            <span className="font-medium tabular-nums text-slate-900">{byType?.[type] ?? 0}</span>
          </li>
        ))}
      </ul>

      {!total ? <p className="mt-3.5 text-xs text-slate-500">{note}</p> : null}
    </Card>
  );
}

export default function AcademicianDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      setDashboard(await fetchDashboard());
    } catch (error) {
      setLoadError(error);
      setDashboard(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completion = dashboard?.profileCompletion ?? null;
  const hasProfile = Boolean(dashboard?.hasProfile);
  const opportunities = dashboard?.opportunities ?? {};
  const applications = dashboard?.applications ?? {};
  const matches = dashboard?.matches ?? {};

  const byStatus = applications.byStatus ?? {};
  // Only statuses this academician actually has, in the pipeline's own order — a row
  // of zeroes would say nothing about where their applications stand.
  const reportedStatuses = APPLICATION_STATUS_VALUES.filter(
    (status) => (byStatus[status] ?? 0) > 0,
  );

  const topMatches = matches.topMatches ?? [];

  return (
    <DashboardLayout
      title="Academician dashboard"
      subtitle="Your expertise, the collaborations and programmes open to it, and where your applications stand."
    >
      <div className="space-y-5">
        {loadError ? (
          <Alert
            variant="error"
            title="Could not load your dashboard"
            message={loadError.message}
            errors={loadError.errors}
          >
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={load}>
                Try again
              </Button>
            </div>
          </Alert>
        ) : null}

        {isLoading ? (
          <Card>
            <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
              <Spinner />
              Loading your dashboard…
            </div>
          </Card>
        ) : !dashboard ? null : (
          <>
            {/* 1 — Profile completion. The panel when there is a profile to score, an
                invitation when there is not: a 0% bar with nine missing sections is a
                worse first impression than a sentence explaining what to do. */}
            {hasProfile ? (
              <PortfolioCompletionPanel
                completion={completion}
                id="academician-completion"
                title="Profile completion"
                description="Worked out by the server from what you have filled in — the same profile a company reads when it matches your expertise."
                destinations={DESTINATIONS}
                message={completionMessage}
              />
            ) : (
              <Card
                title="Create your profile"
                description="Nothing else on this page can work until there is something to match against."
                action={
                  <Link to="/academician/profile" className={ACTION_LINK}>
                    Create profile
                  </Link>
                }
              >
                <p className="text-sm text-slate-600">
                  Your institution, designation, areas of expertise and skills are what
                  collaboration matching reads. Filling in what you can takes a few minutes —
                  qualifications, positions and publications can follow afterwards.
                </p>
              </Card>
            )}

            {/* 2 — Relevant opportunities. The server's top three, with the server's
                score and the server's expertise sentence. */}
            <Card
              title="Relevant opportunities"
              description={
                matches.consideredCount > 0
                  ? `Your best ${topMatches.length} of ${matches.consideredCount} open ${
                      matches.consideredCount === 1 ? 'posting' : 'postings'
                    }, ranked by how well they fit your expertise.`
                  : 'Open postings ranked against your areas of expertise.'
              }
              action={
                <Link to="/academician/matches" className={ACTION_LINK}>
                  See all matches
                </Link>
              }
            >
              {matches.reason === 'no-profile' ? (
                <EmptyState
                  title="Matching needs your profile first"
                  description="Ranking compares your expertise and skills against what each posting asks for, so there is nothing to compare until your profile exists."
                  action={
                    <Link to="/academician/profile" className={ACTION_LINK}>
                      Create profile
                    </Link>
                  }
                />
              ) : topMatches.length === 0 ? (
                <EmptyState
                  title="Nothing open to match against"
                  description="No collaborations or faculty programmes are currently accepting applications. The full list is still worth a look — closed postings show what companies have been asking for."
                  action={
                    <Link to="/academician/opportunities" className={ACTION_LINK}>
                      Browse opportunities
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {topMatches.map(({ opportunity, match, expertise }) => (
                    <OpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      titleTo={`/academician/opportunities/${opportunity.id}`}
                      showIndustry
                      /* The Phase 7 sentence when there is one — "Strong expertise
                         match: Python, Machine Learning" says more than a score band —
                         falling back to the matcher's own recommendation. */
                      note={expertise?.highlights?.[0] ?? match?.recommendation}
                      actions={
                        <>
                          <MatchScoreChip
                            score={match?.matchScore ?? 0}
                            level={match?.recommendationLevel}
                          />
                          <Link
                            to={`/academician/opportunities/${opportunity.id}`}
                            className="text-sm font-medium text-primary-700 hover:text-primary-800"
                          >
                            See why →
                          </Link>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* 3 — Active applications. Counted server-side over the whole
                collection, so the figure does not depend on a page size. */}
            <Card
              title="Active applications"
              description={
                applications.total > 0
                  ? 'Where each application you have sent stands right now.'
                  : 'Apply to a collaboration or a programme and track it from here.'
              }
              action={
                <Link to="/academician/applications" className={ACTION_LINK}>
                  {applications.total > 0 ? 'Track applications' : 'View applications'}
                </Link>
              }
            >
              {applications.total > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="primary">
                      {applications.total}{' '}
                      {applications.total === 1 ? 'application' : 'applications'}
                    </Badge>
                    <Badge variant={applications.active > 0 ? 'success' : 'outline'}>
                      {applications.active} still in play
                    </Badge>
                  </div>

                  {/* Each status the academician actually has, in the pipeline's order. */}
                  <div className="flex flex-wrap items-center gap-2">
                    {reportedStatuses.map((status) => (
                      <Badge key={status} variant={statusVariant(status)} size="sm">
                        {byStatus[status]} {statusLabel(status).toLowerCase()}
                      </Badge>
                    ))}
                  </div>

                  <p className="text-sm text-slate-500">
                    Still in play means not yet decided. The server works it out from the same
                    status rules each application's timeline draws, so the two cannot disagree.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Nothing sent yet. Your profile travels with every application, so a company
                  reviewing one sees your expertise, qualifications and positions alongside it.
                </p>
              )}
            </Card>

            {/* 4 and 5 — the two halves of what industry posts for academicians, side
                by side because they answer opposite questions: where you bring the
                expertise, and where you go to gain something. */}
            <div className="grid gap-5 sm:grid-cols-2">
              <TypeCountCard
                title="Collaboration opportunities"
                description="Where you bring the expertise: research, consultancy, mentorship and guest lectures."
                total={opportunities.collaborations}
                singular="collaboration"
                plural="collaborations"
                types={COLLABORATION_TYPE_ORDER}
                byType={opportunities.byType}
                note="Nothing open right now. New postings appear here as companies publish them."
              />

              <TypeCountCard
                title="Upcoming programmes"
                description="Where you gain: faculty internships, industrial training, FDPs and workshops."
                total={opportunities.programmes}
                singular="programme"
                plural="programmes"
                types={PROGRAMME_TYPE_ORDER}
                byType={opportunities.byType}
                note="Nothing open right now. Programmes are usually posted a term ahead."
              />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
