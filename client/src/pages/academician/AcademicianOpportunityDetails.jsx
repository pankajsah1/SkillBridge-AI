/**
 * One opportunity, in full, for an academician — /academician/opportunities/:id.
 *
 * THE STUDENT PAGE'S STRUCTURE, THE STUDENT PAGE'S COMPONENTS. `useOpportunity` reads
 * the posting (GET /opportunities/:id is authenticated but not role-gated, because a
 * posting is the same document whoever is reading it), `MatchBreakdown` renders the
 * four weighted parts, and `ApplyCard` owns applying with its five states. What is
 * academician-specific is one card and four strings.
 *
 * TWO REQUESTS, NOT ONE, AND ON PURPOSE. GET /academicians/matches/:id also returns the
 * opportunity, so this page could have been a single call — but then a failure in the
 * scoring path would take the job description down with it. Split, the posting renders
 * and the match card degrades on its own, which is the student page's behaviour too.
 *
 * THE PHASE 7 CARD IS THE ONE GENUINELY NEW THING: which required expertise this
 * academician has, which additional (employer-preferred) expertise they bring, and
 * which required expertise is missing — the server's own three groups, in the server's
 * own order, under the brief's own headings. Every level shown is a stored number; the
 * page compares nothing.
 *
 * `reason: 'no-profile'` IS AN INVITATION, NOT AN ERROR, exactly as on the matches
 * page: there is nothing to score against yet, which is a first-run condition.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchMatchForOpportunity } from '../../api/academician.api.js';
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
  isCollaborationType,
  typeLabel,
  workModeLabel,
} from '../../constants/opportunities.js';
import { levelLabelForScore, styleForScore } from '../../constants/skills.js';
import useOpportunity from '../../hooks/useOpportunity.js';

/** What to say when a posting can no longer be applied to. */
const UNAVAILABLE_NOTICE = {
  [AVAILABILITY.EXPIRED]: {
    variant: 'warning',
    title: 'The deadline for this opportunity has passed',
    message:
      'It is still here so you can see what it asked for, but it is no longer accepting applications.',
  },
  [AVAILABILITY.CLOSED]: {
    variant: 'info',
    title: 'This opportunity has been closed',
    message: 'The company is no longer taking part in this collaboration or programme.',
  },
  [AVAILABILITY.DRAFT]: {
    variant: 'info',
    title: 'This opportunity has not been published',
    message: 'It is still a draft, so nothing about it is final.',
  },
};

/**
 * The three Phase 7 group headings, in the brief's own words.
 *
 * The keys are `summariseExpertiseMatch`'s, so a group cannot be relabelled here
 * without the data behind it changing name too.
 */
const EXPERTISE_GROUPS = [
  {
    key: 'strongMatch',
    heading: 'Strong expertise match',
    blurb: 'Expertise this opportunity asks for that you already have at the level asked.',
    variant: 'success',
  },
  {
    key: 'additionalExpertise',
    heading: 'Additional relevant expertise',
    blurb: 'Expertise the company listed as preferred rather than required, and you have it.',
    variant: 'primary',
  },
  {
    key: 'gaps',
    heading: 'Expertise this opportunity also asks for',
    blurb: 'Required expertise your profile does not show yet, or shows below the level asked.',
    variant: 'outline',
  },
];

/**
 * One labelled fact in the summary grid, and a skill tag with the level asked.
 *
 * Deliberately local copies of the two helpers on the student's details page rather
 * than an extraction both pages import. They are fifteen lines of presentation each,
 * and lifting them would mean editing a verified student page to no functional end —
 * the one kind of change this step is least allowed to risk.
 */
function Fact({ label, children }) {
  if (!children) return null;

  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

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

/** One expertise row: the name, then your level against the level asked. */
function ExpertiseRow({ row }) {
  const hasLevel = typeof row.level === 'number' && row.level > 0;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 py-2 last:border-0">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-900">{row.name}</span>
        {row.isPreferred ? (
          <Badge variant="outline" size="sm">
            Preferred
          </Badge>
        ) : null}
      </span>

      <span className="text-xs tabular-nums text-slate-500">
        {hasLevel ? (
          <>
            You: <span className="font-medium text-slate-700">{row.level}</span>
          </>
        ) : (
          <span className="text-slate-500">Not on your profile</span>
        )}
        {typeof row.requiredLevel === 'number' ? (
          <>
            {' '}
            · Asked: <span className="font-medium text-slate-700">{row.requiredLevel}</span>
          </>
        ) : null}
      </span>
    </div>
  );
}

export default function AcademicianOpportunityDetails() {
  const { id } = useParams();
  const { opportunity, isLoading, loadError, reload } = useOpportunity(id);

  /**
   * The score, the expertise explanation, and whether there is a profile at all.
   *
   * Its own request, and its own failure: the posting is the page, and an error
   * banner over a readable description because a secondary call failed costs the
   * reader more than it tells them.
   */
  const [match, setMatch] = useState(null);
  const [expertise, setExpertise] = useState(null);
  const [reason, setReason] = useState(null);
  const [isLoadingMatch, setIsLoadingMatch] = useState(true);

  useEffect(() => {
    let isActive = true;
    setIsLoadingMatch(true);

    (async () => {
      try {
        const result = await fetchMatchForOpportunity(id);
        if (!isActive) return;
        setMatch(result.match);
        setExpertise(result.expertise);
        setReason(result.reason);
      } catch {
        if (isActive) {
          setMatch(null);
          setExpertise(null);
          setReason(null);
        }
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
          <BackLink to="/academician/opportunities">Back to opportunities</BackLink>

          <Alert
            variant={isMissing ? 'warning' : 'error'}
            title={
              isMissing
                ? 'That opportunity is not available'
                : 'This opportunity could not be loaded'
            }
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
  const hasConditions = branches.length > 0 || Boolean(eligibility.notes);

  /* Which half of the academician catalogue this is — the same predicate the
     dashboard counts with, so a posting cannot be a collaboration on one page and a
     programme on another. */
  const isCollaboration = isCollaborationType(opportunity.type);

  const hasExpertise = EXPERTISE_GROUPS.some((group) => (expertise?.[group.key] ?? []).length > 0);

  return (
    <DashboardLayout
      title={opportunity.title}
      subtitle={opportunity.industry?.name ?? 'Opportunity details'}
    >
      <div className="space-y-5">
        <BackLink to="/academician/opportunities">Back to opportunities</BackLink>

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

          {/* Which kind of posting this is, said in a sentence rather than left to be
              inferred from the type name. */}
          <p className="mt-3 text-sm text-slate-600">
            {isCollaboration
              ? 'A collaboration — you bring the expertise.'
              : 'A programme — the company brings the expertise and you take part.'}
          </p>

          <dl className="mt-5 grid gap-x-4 gap-y-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Location">
              {opportunity.location} · {workModeLabel(opportunity.workMode)}
            </Fact>

            <Fact label="Duration">{duration}</Fact>

            <Fact label="Places">
              {opportunity.openings} {opportunity.openings === 1 ? 'place' : 'places'}
            </Fact>

            <Fact label="Apply by">
              {formatDeadline(opportunity.deadline)}
              {countdown ? <span className="font-normal text-slate-500"> · {countdown}</span> : null}
            </Fact>
          </dl>
        </Card>

        {/* "Does this fit me?" is the question this page was opened with, so the
            answer sits above the description. Same component, same numbers and same
            four weights as the student side — only the sentence under the heading and
            the empty state are worded for an academician. */}
        <MatchBreakdown
          match={match}
          isLoading={isLoadingMatch}
          description="Scored on your expertise levels, your research interests, any conditions the company stated, and how complete your profile is."
          emptyState={
            reason === 'no-profile' ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Scoring compares your expertise and skills against what this posting asks for,
                  so it needs your profile first. Your institution, designation and a few areas of
                  expertise are enough to start.
                </p>
                <Link
                  to="/academician/profile"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
                >
                  Set up profile
                </Link>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                We could not work out your match for this posting just now. Everything below is
                still what the company asked for.
              </p>
            )
          }
          action={
            <Link
              to="/academician/matches"
              className="text-sm font-medium text-primary-700 hover:text-primary-800"
            >
              All your matches →
            </Link>
          }
        />

        {/* PHASE 7, IN THE BRIEF'S OWN THREE GROUPS. Rendered only when the server
            actually returned expertise for this posting: three empty headings under a
            title would read as "we found nothing about you", which is a different claim
            from "we have not scored you yet" — and that one is MatchBreakdown's to make. */}
        {hasExpertise ? (
          <Card
            title="Your expertise against this opportunity"
            description="Grouped by the server that scored you, in the order it ranked them — the expertise worth most to this posting first."
          >
            <div className="space-y-5">
              {EXPERTISE_GROUPS.map((group) => {
                const rows = expertise?.[group.key] ?? [];
                if (rows.length === 0) return null;

                return (
                  <div key={group.key}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <h4 className="text-sm font-medium text-slate-900">{group.heading}</h4>
                      <Badge variant={group.variant} size="sm">
                        {rows.length}
                      </Badge>
                    </div>

                    <p className="mt-0.5 text-xs text-slate-500">{group.blurb}</p>

                    <div className="mt-1.5">
                      {rows.map((row) => (
                        <ExpertiseRow key={`${group.key}-${row.skillId ?? row.name}`} row={row} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}

        <Card title="About this opportunity">
          {/* The company typed paragraphs; `whitespace-pre-line` keeps them as
              paragraphs instead of collapsing the posting into one block. */}
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {opportunity.description}
          </p>
        </Card>

        {requiredSkills.length > 0 || preferredSkills.length > 0 ? (
          <Card
            title="What this opportunity asks for"
            description="The level beside each skill is the level the company asked for, not a score of yours."
          >
            <div className="space-y-4">
              {requiredSkills.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-slate-900">Required</h4>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {requiredSkills.map((entry) => (
                      <SkillTag key={entry.skillId ?? entry.name} entry={entry} />
                    ))}
                  </div>
                </div>
              ) : null}

              {preferredSkills.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-slate-900">Preferred</h4>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Not required — these count towards your match but never against it.
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {preferredSkills.map((entry) => (
                      <SkillTag key={entry.skillId ?? entry.name} entry={entry} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        {hasConditions ? (
          <Card title="Conditions the company stated">
            <div className="space-y-3">
              {eligibility.notes ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {eligibility.notes}
                </p>
              ) : null}

              {branches.length > 0 ? (
                <div>
                  <p className="text-xs text-slate-500">Disciplines named</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {branches.map((branch) => (
                      <Badge key={branch} variant="outline" size="md">
                        {branch}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Said plainly because the score would otherwise imply a check that did
                  not happen: an academician profile carries no branch or graduation
                  year, so the eligibility rules the matcher looks for find nothing to
                  test and that part of the score is awarded in full. Reading these
                  conditions is therefore yours to do. */}
              <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                These are read by you, not by the scoring: your profile records expertise and
                research interests rather than a discipline or graduation year, so nothing above
                was checked against them. Apply if the conditions fit you.
              </p>
            </div>
          </Card>
        ) : null}

        {/* Same card, same endpoint, same one-application-per-posting rule as the
            student side — POST /applications reads the applicant from the token, so
            nothing about applying is role-specific. Four strings are: where the two
            links point, and the two sentences that would otherwise promise a company
            "measured skill levels", which is true of assessed student skills and not of
            self-reported expertise. */}
        <ApplyCard
          opportunityId={id}
          availability={opportunity.availability}
          matchScore={match?.matchScore ?? null}
          applicationsTo="/academician/applications"
          browseTo="/academician/matches"
          submittedMessage="The company can now see your profile — your institution, designation, expertise and research interests — alongside your application."
          formDescription="Your profile, your areas of expertise and your research interests are sent with every application."
        />
      </div>
    </DashboardLayout>
  );
}
