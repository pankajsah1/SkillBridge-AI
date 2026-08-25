/**
 * One opportunity, in full.
 *
 * THE APPLY BOX IS A COMPONENT, NOT A BUTTON HERE. Step 4 shipped this page with
 * a sentence saying applications were not open, because there was no Application
 * model to point one at and a disabled button would have been a promise the build
 * could not keep. Phase 6 is that model, so the sentence is gone and ApplyCard is
 * in its place — it owns the five states applying actually has (checking, form,
 * submitting, already applied, posting closed) so this page does not have to.
 *
 * THE MATCH SCORE IS THE SERVER'S, AND IT SHOWS ITS WORKING. Step 4 deliberately
 * left this page without a fit number, because a percentage invented in the
 * browser would be read as the portal's verified judgement. Phase 5 is the engine
 * that number was waiting for: GET /students/matches/:id returns the score, the
 * four weighted parts behind it and the sentences that explain them, and this page
 * renders them without recomputing anything.
 *
 * THE SCORE IS PASSED DOWN TO THE APPLY BOX FOR DISPLAY ONLY. The number stored
 * with an application is calculated server-side at creation; handing this one to
 * ApplyCard lets it say "you are applying at 78%" rather than making the browser
 * the source of a figure a recruiter will later act on.
 *
 * A MISSING MATCH IS NOT AN ERROR HERE. The breakdown fails quietly — the posting
 * is the page, and an error banner over a perfectly readable job description
 * because a secondary request failed would cost the student more than it tells
 * them.
 *
 * A CLOSED OR EXPIRED POSTING RENDERS RATHER THAN 404s. The API returns it on
 * purpose — a bookmark or a shared link deserves "this closed on 12 August" over a
 * page that implies it never existed — so this page reads `availability` and says so.
 * A draft is the one exception, and the API answers that with a 404 for everyone but
 * its owner, which this page shows as-is.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchOpportunityMatch } from '../../api/matching.api.js';
import ApplyCard from '../../components/student/ApplyCard.jsx';
import MatchBreakdown from '../../components/student/MatchBreakdown.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import {
  AVAILABILITY,
  availabilityBadge,
  deadlineCountdown,
  durationLabel,
  formatDeadline,
  hasMeaningfulDuration,
  typeLabel,
  workModeLabel,
} from '../../constants/opportunities.js';
import { levelLabelForScore, styleForScore } from '../../constants/skills.js';
import useOpportunity from '../../hooks/useOpportunity.js';

/** What to say when a posting can no longer be acted on. */
const UNAVAILABLE_NOTICE = {
  [AVAILABILITY.EXPIRED]: {
    variant: 'warning',
    title: 'The deadline for this opportunity has passed',
    message:
      'It is still here so you can see what it asked for, but it is no longer accepting applicants.',
  },
  [AVAILABILITY.CLOSED]: {
    variant: 'info',
    title: 'This opportunity has been closed',
    message: 'The company is no longer looking for candidates for this role.',
  },
  [AVAILABILITY.DRAFT]: {
    variant: 'info',
    title: 'This opportunity has not been published',
    message: 'It is still a draft, so nothing about it is final.',
  },
};

/** "Graduating between 2026 and 2028", or one open-ended half of that. */
const graduationWindow = ({ minGraduationYear, maxGraduationYear }) => {
  if (minGraduationYear && maxGraduationYear) {
    return minGraduationYear === maxGraduationYear
      ? `Graduating in ${minGraduationYear}`
      : `Graduating between ${minGraduationYear} and ${maxGraduationYear}`;
  }

  if (minGraduationYear) return `Graduating in ${minGraduationYear} or later`;
  if (maxGraduationYear) return `Graduating in ${maxGraduationYear} or earlier`;
  return null;
};

/** One labelled fact in the summary grid. */
function Fact({ label, children }) {
  if (!children) return null;

  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

/** A skill tag, with the expected level when there is one. */
function SkillTag({ entry }) {
  const name = entry.name ?? 'Skill';

  if (entry.requiredLevel === undefined || entry.requiredLevel === null) {
    return (
      <Badge variant="outline" size="md">
        {name}
      </Badge>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-700">
      {name}
      <span className={`rounded-full px-2 py-0.5 text-xs ${styleForScore(entry.requiredLevel).chip}`}>
        {levelLabelForScore(entry.requiredLevel)}
      </span>
    </span>
  );
}

export default function OpportunityDetails() {
  const { id } = useParams();
  const { opportunity, isLoading, loadError, reload } = useOpportunity(id);

  /**
   * The match breakdown for this posting.
   *
   * Its own request rather than part of `useOpportunity`, because the two answer
   * different questions: the posting is public to any signed-in viewer, the match
   * is about one student. Keeping them separate is also what lets this one fail
   * without taking the page down.
   */
  const [match, setMatch] = useState(null);
  const [isLoadingMatch, setIsLoadingMatch] = useState(true);

  useEffect(() => {
    let isActive = true;
    setIsLoadingMatch(true);

    (async () => {
      try {
        const result = await fetchOpportunityMatch(id);
        if (isActive) setMatch(result.match);
      } catch {
        if (isActive) setMatch(null);
      } finally {
        if (isActive) setIsLoadingMatch(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <DashboardLayout title="Opportunity" subtitle="Loading the details…">
        <Card>
          <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
            <Spinner />
            Loading this opportunity…
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  if (loadError || !opportunity) {
    const isMissing = loadError?.status === 404;

    return (
      <DashboardLayout
        title="Opportunity"
        subtitle={isMissing ? 'This one is not available.' : 'Something went wrong.'}
      >
        <div className="space-y-5">
          <BackLink to="/student/opportunities">Back to opportunities</BackLink>

          <Alert
            variant={isMissing ? 'warning' : 'error'}
            title={isMissing ? 'That opportunity is not available' : 'This opportunity could not be loaded'}
            message={
              isMissing
                ? 'It may have been removed by the company, or it was never published. Browse what is open instead.'
                : (loadError?.message ?? 'Please try again.')
            }
          >
            {/* Retrying a 404 would just produce the same 404. */}
            {isMissing ? null : (
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={() => reload()}>
                  Try again
                </Button>
              </div>
            )}
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  const badge = availabilityBadge(opportunity.availability);
  const notice = UNAVAILABLE_NOTICE[opportunity.availability];
  const countdown = deadlineCountdown(opportunity.deadline);
  const duration = hasMeaningfulDuration(opportunity.type)
    ? durationLabel(opportunity.durationMonths)
    : null;

  const requiredSkills = opportunity.requiredSkills ?? [];
  const preferredSkills = opportunity.preferredSkills ?? [];

  const eligibility = opportunity.eligibility ?? {};
  const branches = eligibility.branches ?? [];
  const years = graduationWindow(eligibility);
  const hasEligibility = branches.length > 0 || Boolean(years) || Boolean(eligibility.notes);

  return (
    <DashboardLayout
      title={opportunity.title}
      subtitle={opportunity.industry?.name ?? 'Opportunity details'}
    >
      <div className="space-y-5">
        <BackLink to="/student/opportunities">Back to opportunities</BackLink>

        {notice ? (
          <Alert variant={notice.variant} title={notice.title} message={notice.message} />
        ) : null}

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">{opportunity.title}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {typeLabel(opportunity.type)}
                {opportunity.industry?.name ? ` · ${opportunity.industry.name}` : ''}
              </p>
            </div>

            {/* The label lives inside the badge, so availability never depends on
                colour alone — DESIGN.md section 40. */}
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>

          <dl className="mt-5 grid gap-x-4 gap-y-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Location">
              {opportunity.location} · {workModeLabel(opportunity.workMode)}
            </Fact>

            <Fact label="Duration">{duration}</Fact>

            <Fact label="Openings">
              {opportunity.openings} {opportunity.openings === 1 ? 'position' : 'positions'}
            </Fact>

            <Fact label="Apply by">
              {formatDeadline(opportunity.deadline)}
              {countdown ? <span className="font-normal text-slate-500"> · {countdown}</span> : null}
            </Fact>
          </dl>
        </Card>

        {/* Directly under the facts, above the description: "does this fit me?" is
            the question a student came here with, and the answer should not be
            below the fold. */}
        <MatchBreakdown
          match={match}
          isLoading={isLoadingMatch}
          action={
            <Link
              to="/student/matches"
              className="text-sm font-medium text-primary-700 hover:text-primary-800"
            >
              All your matches →
            </Link>
          }
        />

        <Card title="About this opportunity">
          {/* whitespace-pre-line so the paragraph breaks the employer typed survive.
              The description is plain text and is rendered as text — never as HTML,
              which would make a posting a way to inject markup into every student's
              browser. */}
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {opportunity.description}
          </p>
        </Card>

        <Card
          title="Skills"
          description="What this role asks for. Levels use the same scale as the skills on your profile."
        >
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Required
              </h3>

              {requiredSkills.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {requiredSkills.map((entry) => (
                    <SkillTag key={entry.skillId} entry={entry} />
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-slate-500">
                  No specific skills were listed as required.
                </p>
              )}
            </div>

            {preferredSkills.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nice to have
                </h3>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {preferredSkills.map((entry) => (
                    <SkillTag key={entry.skillId} entry={entry} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        {hasEligibility ? (
          <Card title="Who can apply">
            <div className="space-y-4">
              {branches.length > 0 ? (
                <div>
                  <p className="text-xs text-slate-500">Branches</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {branches.map((branch) => (
                      <Badge key={branch} variant="neutral" size="sm">
                        {branch}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {years ? (
                <div>
                  <p className="text-xs text-slate-500">Graduation year</p>
                  <p className="mt-0.5 text-sm text-slate-700">{years}</p>
                </div>
              ) : null}

              {eligibility.notes ? (
                <div>
                  <p className="text-xs text-slate-500">Also worth knowing</p>
                  <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {eligibility.notes}
                  </p>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        {/* Last, deliberately: a student should read what the role asks for and
            who can apply before deciding to. The card checks whether they have
            already applied, so it is safe to render for any availability. */}
        <ApplyCard
          opportunityId={id}
          availability={opportunity.availability}
          matchScore={typeof match?.matchScore === 'number' ? match.matchScore : null}
        />
      </div>
    </DashboardLayout>
  );
}
