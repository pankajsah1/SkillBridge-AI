/**
 * Matched opportunities for an academician — /academician/matches.
 *
 * THE STUDENT PAGE, SAME SHAPE, SAME NUMBERS. This is `pages/student/MatchedOpportunities.jsx`
 * pointed at GET /academicians/matches: no filters, because the ranking *is* the
 * filter, and the row is the existing `OpportunityCard` because a matched posting is
 * still a posting.
 *
 * ONE SCORING ENGINE, NOT TWO. The server scores an academician with the same
 * `calculateMatch` it uses for students — expertise levels stand in for skill levels
 * and research interests for career goals — so a 78 here and a 78 on the student side
 * mean the same four things. Nothing on this page adds, sorts or rounds a number.
 *
 * WHAT IS ACADEMICIAN-SPECIFIC IS THE EXPLANATION. Each row carries `expertise`, the
 * Phase 7 summary: which required expertise the posting asked for and this academician
 * has, which additional (employer-preferred) expertise they bring, and which required
 * expertise is missing. Rendered as three labelled groups under each card, in the
 * matcher's own order — heaviest-weighted skill first.
 *
 * `reason: 'no-profile'` IS NOT AN ERROR. It means there is nothing to match against
 * yet, which is a first-run condition, so it renders as an invitation rather than a
 * red banner.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchMyMatches } from '../../api/academician.api.js';
import { MatchScoreChip } from '../../components/student/MatchBreakdown.jsx';
import OpportunityCard from '../../components/opportunities/OpportunityCard.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';

/** Enough to be a shortlist, short enough to be read — the student page's number. */
const PAGE_LIMIT = 10;

const ACTION_LINK =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700';

/**
 * One labelled group of expertise names, or nothing at all when the group is empty.
 *
 * Names only, no levels: the number belongs on the detail page next to what the posting
 * asked for, and a level with no requirement beside it invites the wrong comparison.
 */
function ExpertiseGroup({ label, rows = [], variant }) {
  if (rows.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      {rows.map((row) => (
        <Badge key={row.skillId ?? row.name} variant={variant} size="sm">
          {row.name}
        </Badge>
      ))}
    </span>
  );
}

export default function AcademicianMatches() {
  const [matches, setMatches] = useState([]);
  const [consideredCount, setConsideredCount] = useState(0);
  const [weights, setWeights] = useState(null);
  const [reason, setReason] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await fetchMyMatches({ limit: PAGE_LIMIT });
      setMatches(result.matches);
      setConsideredCount(result.consideredCount);
      setWeights(result.weights);
      setReason(result.reason);
    } catch (error) {
      setLoadError(error);
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout
      title="Matched for you"
      subtitle="Open collaborations and faculty programmes, ranked by how well they fit your expertise."
    >
      <div className="space-y-5">
        <BackLink to="/academician">Back to dashboard</BackLink>

        {loadError ? (
          <Alert
            variant="error"
            title="Could not work out your matches"
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

        {/* Said once, at the top, rather than on every row. The weights are read from
            the response, so this sentence cannot go stale — and it is the same
            four-part score the student side shows, which is the point. */}
        {weights ? (
          <Card title="How these are ranked">
            <p className="text-sm text-slate-600">
              Each posting is scored out of 100:{' '}
              <span className="font-medium text-slate-900">{weights.skills}%</span> on how far your
              expertise levels meet what it asks for,{' '}
              <span className="font-medium text-slate-900">{weights.careerInterest}%</span> on how
              well it lines up with your research interests,{' '}
              <span className="font-medium text-slate-900">{weights.eligibility}%</span> on any
              conditions the company stated, and{' '}
              <span className="font-medium text-slate-900">{weights.profileCompleteness}%</span> on
              how complete your profile is. Open any posting to see its full breakdown.
            </p>
          </Card>
        ) : null}

        {isLoading ? (
          <Card>
            <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
              <Spinner />
              Scoring open opportunities against your expertise…
            </div>
          </Card>
        ) : reason === 'no-profile' ? (
          <Card>
            <EmptyState
              title="You have not set up your profile yet"
              description="Matching compares your expertise and skills against what each posting asks for, so it needs your profile first. Your institution, designation and a few areas of expertise are enough to start."
              action={
                <Link to="/academician/profile" className={ACTION_LINK}>
                  Set up profile
                </Link>
              }
            />
          </Card>
        ) : matches.length === 0 ? (
          <Card>
            <EmptyState
              title="No open opportunities to match against"
              description="Nothing is currently accepting applications. The full list is still worth a look — postings that have closed show what companies have been asking academics for."
              action={
                <Link to="/academician/opportunities" className={ACTION_LINK}>
                  Browse all opportunities
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Showing your top {matches.length} of {consideredCount} open{' '}
              {consideredCount === 1 ? 'posting' : 'postings'}.
            </p>

            <div className="space-y-5">
              {matches.map(({ opportunity, match, expertise }) => (
                <div key={opportunity.id} className="space-y-2">
                  <OpportunityCard
                    opportunity={opportunity}
                    titleTo={`/academician/opportunities/${opportunity.id}`}
                    showIndustry
                    note={match?.recommendation}
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

                  {/* The Phase 7 explanation, under the card it explains. Three groups
                      at most, and each disappears when empty rather than printing a
                      label with nothing after it. */}
                  <div className="flex flex-wrap gap-x-5 gap-y-2 px-1">
                    <ExpertiseGroup
                      label="Strong match:"
                      rows={expertise?.strongMatch}
                      variant="success"
                    />
                    <ExpertiseGroup
                      label="Also relevant:"
                      rows={expertise?.additionalExpertise}
                      variant="primary"
                    />
                    <ExpertiseGroup
                      label="Also asks for:"
                      rows={expertise?.gaps}
                      variant="outline"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Card>
              <div className="flex flex-wrap gap-3">
                <Link to="/academician/profile" className={ACTION_LINK}>
                  Add the expertise behind these scores
                </Link>
                <Link
                  to="/academician/opportunities"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Browse everything
                </Link>
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
