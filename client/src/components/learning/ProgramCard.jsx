/**
 * One learning programme, summarised.
 *
 * ONE COMPONENT FOR BOTH AUDIENCES, exactly as OpportunityCard is. The learner's
 * catalogue and the publisher's management list show the same facts — what it
 * teaches, who runs it, how long it takes, when it runs — and differ only in what
 * you can do about it. So the body is shared and the buttons arrive as `actions`.
 *
 * `availability` COMES FROM THE API AND IS DISPLAYED AS GIVEN. It is also why one
 * badge serves both lists: the server's four states already distinguish a draft from
 * an archived programme and a published one from one whose end date has passed, so
 * neither audience needs a badge of its own. A browser with a wrong clock must not be
 * able to make an ended programme look open.
 *
 * `enrollment` IS NOT READ HERE, because that key means two different things
 * depending on which list the row came from — the caller's own enrolment on the
 * learner list, aggregate counts on the publisher's. Each page passes what it wants
 * shown (`enrollmentCounts`, or a progress line inside `note`), so this component can
 * never misread one as the other.
 */

import { Link } from 'react-router-dom';

import {
  deliveryModeLabel,
  durationLabel,
  programAvailabilityBadge,
  programLevelLabel,
  programTypeLabel,
  programWindowLabel,
} from '../../constants/learning.js';
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

const ClockIcon = (
  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);

const CalendarIcon = (
  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M8 3.5V6M16 3.5V6M3.5 10h17" strokeLinecap="round" />
  </svg>
);

const UsersIcon = (
  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11a3 3 0 1 0 0-6M18 20a6.6 6.6 0 0 0-1.6-4.3" strokeLinecap="round" />
  </svg>
);

/**
 * The learner counts on a publisher's row, as numbers only.
 *
 * "12 learners · 4 completed" and never a name: the API sends counts to publishers on
 * purpose, and a card is not the place to start wanting more than that.
 */
function EnrollmentCounts({ counts }) {
  if (!counts || !counts.total) {
    return <span className="text-slate-400">No learners yet</span>;
  }

  return (
    <MetaItem icon={UsersIcon}>
      <span className="tabular-nums">
        {counts.total} {counts.total === 1 ? 'learner' : 'learners'}
        {counts.completed > 0 ? ` · ${counts.completed} completed` : ''}
      </span>
    </MetaItem>
  );
}

export default function ProgramCard({
  program,
  /** Buttons or links for this row. */
  actions,
  /** Where the title links to. Plain text when omitted. */
  titleTo,
  /** Shows the publishing organisation. Off in the publisher's own list — it is always them. */
  showPublisher = false,
  /** `{total, enrolled, inProgress, completed}` from the publisher's list. */
  enrollmentCounts,
  /** An extra node under the footer, e.g. a progress bar or "Edited 2 days ago". */
  note,
}) {
  if (!program) return null;

  const badge = programAvailabilityBadge(program.availability);
  const duration = durationLabel(program.durationHours);

  const skills = program.targetSkills ?? [];
  const visible = skills.slice(0, VISIBLE_SKILLS);
  const hidden = skills.length - visible.length;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">
            {titleTo ? (
              <Link to={titleTo} className="transition hover:text-primary-700">
                {program.title}
              </Link>
            ) : (
              program.title
            )}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-medium text-slate-600">{programTypeLabel(program.type)}</span>

            {program.provider ? (
              <>
                <Dot />
                <span>{program.provider}</span>
              </>
            ) : null}

            {/* Only when it is not the reader's own list. The provider is who runs
                the programme; the publisher is the account that listed it, and on
                the catalogue both are worth knowing. */}
            {showPublisher && program.publisher?.name && program.publisher.name !== program.provider ? (
              <>
                <Dot />
                <span>Listed by {program.publisher.name}</span>
              </>
            ) : null}

            <Dot />
            <span>{programLevelLabel(program.level)}</span>

            <Dot />
            <span>{deliveryModeLabel(program.deliveryMode)}</span>

            {duration ? (
              <>
                <Dot />
                <MetaItem icon={ClockIcon}>{duration}</MetaItem>
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

      {program.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-slate-600">{program.description}</p>
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
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <MetaItem icon={CalendarIcon}>{programWindowLabel(program)}</MetaItem>

          {enrollmentCounts !== undefined ? (
            <>
              <Dot />
              <EnrollmentCounts counts={enrollmentCounts} />
            </>
          ) : null}
        </p>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {note ? <div className="mt-3">{note}</div> : null}
    </article>
  );
}
