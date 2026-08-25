/**
 * The match score, and the four numbers that made it.
 *
 * A MATCH PERCENTAGE ON ITS OWN IS A GUESS THE STUDENT CANNOT ARGUE WITH. So the
 * headline number is never shown alone: every part is listed with the weight the
 * server used, the share earned, and a sentence saying what that share was
 * counted from. "78% match" becomes "70 x skill match, and 4 of 6 required skills
 * are met" — checkable rather than merely confident.
 *
 * NOTHING IS CALCULATED HERE. `matchScore`, every `earned`, every `detail`
 * sentence and the recommendation all arrive from GET /students/matches. Even the
 * weights are read from the response rather than written into this file, so the
 * labels cannot claim 70/15/10/5 while the server scores something else.
 */

import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';
import { levelLabelForScore } from '../../constants/skills.js';

/** How each band reads and looks. The band itself is the server's decision. */
const BAND_STYLES = {
  strong: { label: 'Strong match', variant: 'success', bar: 'bg-success-500', chip: 'bg-success-50 text-success-700' },
  good: { label: 'Good match', variant: 'primary', bar: 'bg-primary-600', chip: 'bg-primary-50 text-primary-700' },
  possible: { label: 'Possible match', variant: 'warning', bar: 'bg-warning-500', chip: 'bg-warning-50 text-warning-700' },
  stretch: { label: 'A stretch', variant: 'outline', bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600' },
};

const bandStyle = (level) => BAND_STYLES[level] ?? BAND_STYLES.possible;

/**
 * The compact form — a pill for a list row, where the full breakdown would not
 * fit and the detail page is one click away.
 */
export function MatchScoreChip({ score, level }) {
  const style = bandStyle(level);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.chip}`}
    >
      <span className="tabular-nums">{score}%</span>
      <span className="font-medium">{style.label}</span>
    </span>
  );
}

/** One weighted component: what it is worth, what was earned, and why. */
function BreakdownRow({ part }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-slate-900">{part.label}</span>
        <span className="text-xs tabular-nums text-slate-500">
          <span className="font-semibold text-slate-900">{part.earned}</span> of {part.weight}{' '}
          points
        </span>
      </div>

      <ProgressBar
        value={part.sharePercent}
        className="mt-1.5"
        size="sm"
        barClassName={part.sharePercent >= 60 ? 'bg-primary-600' : 'bg-warning-500'}
      />

      <p className="mt-1.5 text-xs text-slate-500">{part.detail}</p>
    </div>
  );
}

/** One skill line in the matched / missing lists. */
function SkillLine({ row }) {
  const met = row.gap === 0;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 py-2 last:border-0">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-900">{row.name}</span>
        {row.isPreferred ? (
          <Badge variant="outline" size="sm">
            Nice to have
          </Badge>
        ) : null}
        {row.isVerified ? (
          <Badge variant="success" size="sm">
            Verified
          </Badge>
        ) : null}
      </span>

      <span className="flex items-center gap-2 text-xs tabular-nums text-slate-500">
        <span>
          You: <span className="font-medium text-slate-700">{row.studentLevel}</span> · Asked:{' '}
          <span className="font-medium text-slate-700">{row.requiredLevel}</span>
        </span>
        {met ? (
          <span className="font-medium text-success-700">{levelLabelForScore(row.studentLevel)}</span>
        ) : (
          <span className="font-semibold text-error-700">+{row.gap}</span>
        )}
      </span>
    </div>
  );
}

export default function MatchBreakdown({
  match,
  isLoading = false,
  /** Rendered when there is no profile to match on yet. */
  emptyState = null,
  action,
}) {
  if (isLoading) {
    return (
      <Card title="Your match">
        <p className="py-1 text-sm text-slate-500">Working out how well this fits you…</p>
      </Card>
    );
  }

  if (!match) {
    return (
      <Card title="Your match" action={action}>
        {emptyState ?? (
          <p className="text-sm text-slate-600">
            Set up your profile and the portal will score every posting against your skills,
            your career goals and the eligibility employers state.
          </p>
        )}
      </Card>
    );
  }

  const style = bandStyle(match.recommendationLevel);
  const breakdown = match.breakdown ?? [];
  const matched = match.matchedSkills ?? [];
  const missing = match.missingSkills ?? [];

  return (
    <Card
      title="Your match"
      description="Scored on your skills, your career goals, the eligibility stated, and how complete your profile is."
      action={
        <span className="flex flex-wrap items-center gap-3">
          <Badge variant={style.variant} size="md">
            {style.label}
          </Badge>
          {action}
        </span>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-slate-600">Overall match</span>
            <span className="text-2xl font-semibold tabular-nums text-slate-900">
              {match.matchScore}%
            </span>
          </div>
          <ProgressBar value={match.matchScore} className="mt-2" barClassName={style.bar} />
        </div>

        {/* The one sentence that answers "should I apply?". Eligibility overrides
            the band inside the server, so this can read "you do not meet the
            eligibility" on a high score — which is the honest answer. */}
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{match.recommendation}</p>

        {match.isEligible === false ? (
          <div className="rounded-lg border border-warning-200 bg-warning-50 p-3">
            <p className="text-sm font-medium text-warning-800">
              You do not currently meet the stated eligibility
            </p>
            <ul className="mt-1.5 space-y-1">
              {(match.eligibilityRules ?? [])
                .filter((rule) => !rule.passed)
                .map((rule) => (
                  <li key={rule.key} className="text-xs text-warning-700">
                    {rule.label}
                    {rule.isUnknown ? ' — your profile does not say' : ''}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}

        {match.strengths?.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium text-slate-900">Why you are a fit</h4>
            <ul className="mt-1.5 space-y-1">
              {match.strengths.map((strength) => (
                <li key={strength} className="flex gap-2 text-sm text-slate-600">
                  <span aria-hidden="true" className="text-success-600">
                    +
                  </span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {breakdown.length > 0 ? (
          <div className="border-t border-slate-100 pt-2">
            <h4 className="text-sm font-medium text-slate-900">How the score was built</h4>
            <div className="mt-1">
              {breakdown.map((part) => (
                <BreakdownRow key={part.key} part={part} />
              ))}
            </div>
          </div>
        ) : null}

        {missing.length > 0 ? (
          <div className="border-t border-slate-100 pt-3">
            <h4 className="text-sm font-medium text-slate-900">
              What this posting wants that you do not have yet
            </h4>
            <div className="mt-1">
              {missing.map((row) => (
                <SkillLine key={`${row.skillId}-missing`} row={row} />
              ))}
            </div>
          </div>
        ) : null}

        {matched.length > 0 ? (
          <div className="border-t border-slate-100 pt-3">
            <h4 className="text-sm font-medium text-slate-900">Where you already meet the bar</h4>
            <div className="mt-1">
              {matched.map((row) => (
                <SkillLine key={`${row.skillId}-matched`} row={row} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
