/**
 * Matched opportunities — every live posting, scored against this student, best
 * first.
 *
 * THE DIFFERENCE FROM BROWSE IS THE ORDER. Browse is a catalogue: filters, search,
 * newest or soonest first. This page has no filters at all, deliberately — its
 * whole value is that the ranking already is the filter, and offering a dozen
 * controls next to it would invite the student to reorder a list whose order is
 * the answer.
 *
 * EVERY SCORE COMES FROM GET /students/matches. Nothing on this page adds, sorts
 * or rounds a number, so the score in this list and the breakdown on the detail
 * page cannot disagree about the same posting.
 *
 * The row is the existing OpportunityCard, unchanged: a matched posting is still
 * a posting, and a second card component would drift from the first one within a
 * week.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchMyMatches } from '../../api/matching.api.js';
import { MatchScoreChip } from '../../components/student/MatchBreakdown.jsx';
import OpportunityCard from '../../components/opportunities/OpportunityCard.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';

/** Enough to be a shortlist, short enough to be read. */
const PAGE_LIMIT = 10;

export default function MatchedOpportunities() {
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
      subtitle="Open postings ranked by how well they fit your skills and goals."
    >
      <div className="space-y-5">
        <BackLink to="/student">Back to dashboard</BackLink>

        {loadError ? (
          <Alert variant="error" title="Could not work out your matches" message={loadError.message}>
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={load}>
                Try again
              </Button>
            </div>
          </Alert>
        ) : null}

        {/* Said once, at the top, rather than repeated on every row: the score is
            arithmetic and these are its four parts. The weights are read from the
            response so this sentence cannot go stale. */}
        {weights ? (
          <Card title="How these are ranked">
            <p className="text-sm text-slate-600">
              Each posting is scored out of 100:{' '}
              <span className="font-medium text-slate-900">{weights.skills}%</span> on how well your
              skill levels meet what it asks for,{' '}
              <span className="font-medium text-slate-900">{weights.careerInterest}%</span> on
              whether it matches your career goals,{' '}
              <span className="font-medium text-slate-900">{weights.eligibility}%</span> on the
              eligibility the employer stated, and{' '}
              <span className="font-medium text-slate-900">{weights.profileCompleteness}%</span> on
              how complete your profile is. Open any posting to see its full breakdown.
            </p>
          </Card>
        ) : null}

        {isLoading ? (
          <Card>
            <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
              <Spinner />
              Scoring open opportunities against your profile…
            </div>
          </Card>
        ) : reason === 'no-profile' ? (
          <Card>
            <EmptyState
              title="You have not set up your profile yet"
              description="Matching compares your skills against what each posting asks for, so it needs your profile first. It takes a minute."
              action={
                <Link
                  to="/student/profile"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
                >
                  Set up profile
                </Link>
              }
            />
          </Card>
        ) : matches.length === 0 ? (
          <Card>
            <EmptyState
              title="No open opportunities to match against"
              description="Nothing is currently open for applications. The full list is worth a look — postings that have closed still show what employers are asking for."
              action={
                <Link
                  to="/student/opportunities"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
                >
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

            <div className="space-y-4">
              {matches.map(({ opportunity, match }) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  titleTo={`/student/opportunities/${opportunity.id}`}
                  showIndustry
                  note={match.recommendation}
                  actions={
                    <>
                      <MatchScoreChip score={match.matchScore} level={match.recommendationLevel} />
                      <Link
                        to={`/student/opportunities/${opportunity.id}`}
                        className="text-sm font-medium text-primary-700 hover:text-primary-800"
                      >
                        See why →
                      </Link>
                    </>
                  }
                />
              ))}
            </div>

            <Card>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/student/readiness"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                >
                  Close the gaps behind these scores
                </Link>
                <Link
                  to="/student/opportunities"
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
