/**
 * Recommended learning — the numbered list of what to study next.
 *
 * A section rather than a page, because a recommendation is only meaningful next
 * to the gap that produced it. Splitting them would mean a student reads "learn
 * Docker" on one screen and "you are 40 points short on Docker" on another, with
 * nothing tying the two together.
 *
 * EVERY NUMBER AND EVERY REASON COMES FROM THE SERVER. `priorityScore`,
 * `priority`, the ordering and the `reason` sentence are all computed in
 * recommendation.service.js. This file decides colours and layout, nothing else —
 * the same rule the assessment result and readiness pages follow.
 */

import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';
import EmptyState from '../ui/EmptyState.jsx';

/** How each priority band is shown. The band itself is the server's decision. */
const PRIORITY_STYLES = {
  high: { variant: 'error', label: 'Do this first' },
  medium: { variant: 'warning', label: 'Do this next' },
  low: { variant: 'outline', label: 'Later' },
};

/** What kind of thing this is. Mirrors TRD.md section 18's `type` values. */
const TYPE_LABELS = {
  course: 'Course',
  workshop: 'Workshop',
  certification: 'Certification',
  mentorship: 'Mentorship',
};

/**
 * One recommendation: what to learn, why, and the evidence behind it.
 *
 * The rank number is rendered from the array position rather than sent by the
 * server — position *is* the rank, and a second field claiming to be the rank
 * could disagree with the order the list is drawn in.
 */
function RecommendationRow({ item, rank }) {
  const priority = PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.medium;

  return (
    <li className="flex gap-3 border-b border-slate-100 py-3.5 first:pt-0 last:border-0 last:pb-0">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold tabular-nums text-primary-700">
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-sm font-medium text-slate-900">{item.title}</span>
          <Badge variant={priority.variant} size="sm">
            {priority.label}
          </Badge>
        </div>

        {/* "Why:" verbatim from his brief — the label makes the sentence read as
            justification rather than description. */}
        <p className="mt-1 text-sm text-slate-600">
          <span className="font-medium text-slate-500">Why: </span>
          {item.reason}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="tabular-nums">
            {item.currentLevel} → {item.targetLevel}
          </span>
          <span>{TYPE_LABELS[item.type] ?? 'Course'}</span>
          <span className="capitalize">{item.level}</span>
          {item.demandCount > 0 ? (
            <span className="tabular-nums">
              {item.demandCount} open {item.demandCount === 1 ? 'role wants' : 'roles want'} it
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function RecommendedLearning({
  recommendations = [],
  isLoading = false,
  roleTitle,
  action,
}) {
  return (
    <Card
      title="Recommended learning"
      description={
        recommendations.length > 0
          ? `Ordered by gap size, then how much ${roleTitle ?? 'the role'} depends on the skill, then how many open roles ask for it.`
          : undefined
      }
      action={action}
    >
      {isLoading ? (
        <p className="py-1 text-sm text-slate-500">Working out what to recommend…</p>
      ) : recommendations.length === 0 ? (
        <EmptyState
          title="Nothing to recommend right now"
          description="Recommendations come from your skill gaps, and there are none against this role. Aiming at a more senior role will surface the next things worth learning."
        />
      ) : (
        <ol>
          {recommendations.map((item, index) => (
            <RecommendationRow key={item.skillId} item={item} rank={index + 1} />
          ))}
        </ol>
      )}
    </Card>
  );
}
