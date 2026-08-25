/**
 * One opportunity, summarised.
 *
 * ONE COMPONENT FOR BOTH AUDIENCES. The employer's management list and the
 * student's browse list show the same facts — what the role is, where, by when —
 * and differ only in what you can do about it. So the body is shared and the
 * buttons arrive as `actions`. Two cards would drift apart the first time a field
 * was added to one of them.
 *
 * Follows DESIGN.md section 18 for the card contents: title, type, work mode,
 * location, deadline, and the required skills as tags.
 *
 * `availability` comes from the API and is displayed as given, never recomputed.
 * The server is the authority on whether a posting is still open — a browser with
 * a wrong clock must not be able to make an expired posting look live.
 */

import { Link } from 'react-router-dom';

import {
  availabilityBadge,
  deadlineCountdown,
  durationLabel,
  formatDeadline,
  hasMeaningfulDuration,
  typeLabel,
  workModeLabel,
} from '../../constants/opportunities.js';
import Badge from '../ui/Badge.jsx';

/** How many skill tags fit before the rest become a count. */
const VISIBLE_SKILLS = 5;

/** A dot separator that screen readers skip. */
function Dot() {
  return (
    <span className="text-slate-300" aria-hidden="true">
      ·
    </span>
  );
}

function MetaItem({ icon, children }) {
  if (!children) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  );
}

const PinIcon = (
  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Z" strokeLinecap="round" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const ClockIcon = (
  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);

const UsersIcon = (
  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11a3 3 0 1 0 0-6M18 20a6.6 6.6 0 0 0-1.6-4.3" strokeLinecap="round" />
  </svg>
);

export default function OpportunityCard({
  opportunity,
  /** Buttons or links for this row. */
  actions,
  /** Where the title links to. Plain text when omitted. */
  titleTo,
  /** Shows the posting company. Off in the employer's own list — it is always them. */
  showIndustry = false,
  /** An extra line under the meta row, e.g. "Edited 2 days ago". */
  note,
}) {
  if (!opportunity) return null;

  const badge = availabilityBadge(opportunity.availability);
  const countdown = deadlineCountdown(opportunity.deadline);
  const duration = hasMeaningfulDuration(opportunity.type)
    ? durationLabel(opportunity.durationMonths)
    : null;

  const skills = opportunity.requiredSkills ?? [];
  const visible = skills.slice(0, VISIBLE_SKILLS);
  const hidden = skills.length - visible.length;

  const title = (
    <h3 className="text-base font-semibold text-slate-900">
      {titleTo ? (
        <Link to={titleTo} className="transition hover:text-primary-700">
          {opportunity.title}
        </Link>
      ) : (
        opportunity.title
      )}
    </h3>
  );

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {title}

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-medium text-slate-600">{typeLabel(opportunity.type)}</span>

            {showIndustry && opportunity.industry?.name ? (
              <>
                <Dot />
                <span>{opportunity.industry.name}</span>
              </>
            ) : null}

            <Dot />
            <MetaItem icon={PinIcon}>
              {opportunity.location} · {workModeLabel(opportunity.workMode)}
            </MetaItem>

            {duration ? (
              <>
                <Dot />
                <MetaItem icon={ClockIcon}>{duration}</MetaItem>
              </>
            ) : null}

            {opportunity.openings > 1 ? (
              <>
                <Dot />
                <MetaItem icon={UsersIcon}>{opportunity.openings} openings</MetaItem>
              </>
            ) : null}
          </div>
        </div>

        {/* The label is inside the badge, so the state never depends on colour
            alone — DESIGN.md section 40. */}
        <Badge variant={badge.variant} size="sm">
          {badge.label}
        </Badge>
      </div>

      {opportunity.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-slate-600">{opportunity.description}</p>
      ) : null}

      {visible.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {visible.map((entry) => (
            <Badge key={entry.skillId} variant="outline" size="sm">
              {/* `name` is populated by the API on every read. The id is a last
                  resort so a tag can never render as "undefined". */}
              {entry.name ?? 'Skill'}
            </Badge>
          ))}

          {hidden > 0 ? <span className="text-xs text-slate-500">+{hidden} more</span> : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-600">Apply by {formatDeadline(opportunity.deadline)}</span>
          {countdown ? (
            <>
              {' '}
              <Dot /> {countdown}
            </>
          ) : null}
        </p>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {note ? <p className="mt-2 text-xs text-slate-400">{note}</p> : null}
    </article>
  );
}
