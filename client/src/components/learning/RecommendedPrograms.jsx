/**
 * "Recommended for you" — programmes chosen from this student's real skill gaps.
 *
 * DELIBERATELY NOT components/student/RecommendedLearning.jsx, AND NOT A REPLACEMENT
 * FOR IT. That card recommends SKILLS to work on and lives next to the gap analysis
 * that produced them. This one recommends PROGRAMMES that teach those skills and
 * lives on the Learning Hub, where enrolling is possible. Same engine underneath —
 * the programme rows are scored from the same gaps, by the same `priorityBand` — two
 * different questions on screen.
 *
 * EVERY NUMBER AND EVERY SENTENCE COMES FROM THE SERVER: `priority`, the ordering,
 * `coverage` with its current and target levels, `reasons`, `levelFitNote`,
 * `readinessScore`. This file decides layout and colour, nothing else. A ranking
 * recomputed in the browser would eventually contradict the readiness page for the
 * same student, and a student would be right to trust neither.
 *
 * `reason` IS A STATE, NOT AN ERROR — 'no-profile', 'no-career-goal', 'no-gaps' and
 * 'no-programs' each mean the list is empty for a different reason and each gets
 * different words, because "we have nothing for you" and "you are not missing
 * anything" are opposite pieces of news.
 *
 * `uncoveredGaps` IS SHOWN EVEN WHEN THERE ARE RECOMMENDATIONS. It is the honest
 * answer to "why is there nothing for Docker?", and hiding it would make a thin
 * catalogue look complete.
 */

import { Link } from 'react-router-dom';

import { priorityBadge } from '../../constants/learning.js';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import EmptyState from '../ui/EmptyState.jsx';

/** What each empty state says. The key is the server's `reason`. */
const EMPTY_STATES = {
  'no-profile': {
    title: 'Set up your profile first',
    description:
      'Recommendations come from the gap between your skills and the role you are aiming at, so they need your profile before they can say anything useful.',
    to: '/student/profile',
    cta: 'Set up profile',
  },
  'no-career-goal': {
    title: 'Choose a role to aim at',
    description:
      'A recommendation is only meaningful against a target. Add a career goal and the hub will work out which programmes close the gaps to it.',
    to: '/student/profile#career-goals',
    cta: 'Set career goals',
  },
  'no-gaps': {
    title: 'No gaps against this role',
    description:
      'Every skill it asks for is already at or above the level required, so there is nothing to recommend. Aiming at a more senior role will surface the next things worth learning.',
    to: '/student/readiness',
    cta: 'See your readiness',
  },
  'no-programs': {
    title: 'Nothing in the catalogue covers your gaps yet',
    description:
      'Your gaps are real, but no published program teaches them at the moment. Browsing the full catalogue below is still worthwhile — and the gaps are listed so you know what to watch for.',
    to: null,
    cta: null,
  },
};

/**
 * One gap this programme closes, with the evidence that makes it arguable.
 *
 * The two numbers are shown rather than summarised for the same reason the readiness
 * page shows them: "45 → 70" is evidence, "you need AWS" is an assertion.
 */
function CoverageChip({ entry }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
      <span className="font-medium text-slate-700">{entry.skillName}</span>
      <span className="tabular-nums text-slate-500">
        {entry.currentLevel} → {entry.targetLevel}
      </span>
    </span>
  );
}

/**
 * One recommended programme.
 *
 * The rank is the array position rather than a field, because position IS the rank
 * and a second number claiming to be it could disagree with the order drawn.
 */
function RecommendationRow({ item, rank, onEnroll, isEnrolling, disabled }) {
  const priority = priorityBadge(item.priority);
  const program = item.program;
  const isEnrolled = Boolean(item.enrollment);

  return (
    <li className="flex gap-3 border-b border-slate-100 py-4 first:pt-0 last:border-0 last:pb-0">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold tabular-nums text-primary-700">
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h4 className="text-sm font-medium text-slate-900">
            <Link
              to={`/student/learning/${program.id}`}
              className="transition hover:text-primary-700"
            >
              {program.title}
            </Link>
          </h4>

          <Badge variant={priority.variant} size="sm">
            {priority.label}
          </Badge>
        </div>

        <p className="mt-0.5 text-xs text-slate-500">{program.provider}</p>

        {/* "Why:" verbatim from his brief — the label makes the sentences read as
            justification rather than description. Each reason is its own line
            because each is a separate claim the server is willing to defend. */}
        {item.reasons?.length > 0 ? (
          <div className="mt-2 text-sm text-slate-600">
            <span className="font-medium text-slate-500">Why: </span>
            <ul className="mt-0.5 space-y-0.5">
              {item.reasons.map((reason) => (
                <li key={reason} className="flex gap-1.5">
                  <span className="text-slate-300" aria-hidden="true">
                    —
                  </span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {item.coverage?.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {item.coverage.map((entry) => (
              <CoverageChip key={entry.skillId} entry={entry} />
            ))}
          </div>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-xs text-slate-500">{item.levelFitNote}</p>

          <div className="flex flex-wrap items-center gap-2">
            {isEnrolled ? (
              <Link
                to="/student/my-learning"
                className="text-sm font-medium text-primary-700 transition hover:text-primary-800"
              >
                Continue in My Learning →
              </Link>
            ) : onEnroll ? (
              <Button
                type="button"
                size="sm"
                onClick={() => onEnroll(program.id)}
                isLoading={isEnrolling}
                disabled={disabled}
              >
                Enroll
              </Button>
            ) : null}

            <Link
              to={`/student/learning/${program.id}`}
              className="text-sm font-medium text-slate-600 transition hover:text-slate-800"
            >
              Details
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function RecommendedPrograms({
  recommendations = [],
  isLoading = false,
  /** The role the recommendations are measured against. */
  careerRole = null,
  readinessScore = null,
  reason = null,
  gapsConsidered = 0,
  uncoveredGaps = [],
  /** (programId) => Promise. Omitted makes the rows read-only. */
  onEnroll,
  enrollingId = null,
  action,
}) {
  const roleTitle = careerRole?.title;

  /**
   * The heading's subtitle names what the list is measured against, because a
   * recommendation with no stated basis is just an advert.
   */
  const description =
    recommendations.length > 0
      ? `Chosen from the ${gapsConsidered} ${gapsConsidered === 1 ? 'gap' : 'gaps'} between your skills and ${roleTitle ?? 'your target role'}${
          readinessScore === null ? '' : `, where you are ${readinessScore}% ready`
        }.`
      : undefined;

  const empty = EMPTY_STATES[reason] ?? EMPTY_STATES['no-programs'];

  return (
    <Card title="Recommended for you" description={description} action={action}>
      {isLoading ? (
        <p className="py-1 text-sm text-slate-500">Working out what to recommend…</p>
      ) : recommendations.length === 0 ? (
        <EmptyState
          title={empty.title}
          description={empty.description}
          action={
            empty.to ? (
              <Link
                to={empty.to}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                {empty.cta}
              </Link>
            ) : null
          }
        />
      ) : (
        <ol>
          {recommendations.map((item, index) => (
            <RecommendationRow
              key={item.program.id}
              item={item}
              rank={index + 1}
              onEnroll={onEnroll}
              isEnrolling={enrollingId === item.program.id}
              disabled={Boolean(enrollingId) && enrollingId !== item.program.id}
            />
          ))}
        </ol>
      )}

      {/* Shown in both states: with recommendations it is the caveat, without them
          it is the whole explanation. */}
      {!isLoading && uncoveredGaps.length > 0 ? (
        <div className="mt-4 rounded-lg bg-slate-50 p-3.5">
          <p className="text-xs font-medium text-slate-600">
            No program covers {uncoveredGaps.length === 1 ? 'this gap' : 'these gaps'} yet
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {uncoveredGaps.map((gap) => (
              <Badge key={gap.skillId} variant="outline" size="sm">
                {gap.skillName}{' '}
                <span className="tabular-nums text-slate-400">+{gap.gap}</span>
              </Badge>
            ))}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            An assessment is still the fastest way to move these — a measured score replaces an
            assumed one.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
