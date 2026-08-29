/**
 * The verification state of one portfolio record, as a pill.
 *
 * WHY THE WORDING IS SO CAREFUL. Nothing in this build is verified — there is no
 * reviewer, no institution approval queue, no issuer callback. Every record a
 * student creates is born `pending` and stays there. So this badge has one job
 * beyond decoration: it must not let the portfolio imply a check that never
 * happened, and it must not make the normal state look like a problem.
 *
 * Hence "Awaiting verification" rather than a red "Unverified", and `outline`
 * rather than `warning`. A student who has just added an honest project should not
 * see something that reads as an error.
 *
 * The `verified` and `rejected` branches exist because the model and the API both
 * carry those values, so the UI should render them correctly the day a reviewer
 * exists. They are unreachable today, which is the point: nothing here can invent
 * a "Verified" pill, because the only thing that decides is the server's field.
 */

import Badge from '../ui/Badge.jsx';
import { VERIFICATION_META, VERIFICATION_STATUSES } from '../../constants/portfolio.js';

/** Small tick / clock / cross, drawn inline rather than pulling in an icon set. */
function StatusIcon({ status }) {
  if (status === VERIFICATION_STATUSES.VERIFIED) {
    return (
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
        <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === VERIFICATION_STATUSES.REJECTED) {
    return (
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l2.5 2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {'pending'|'verified'|'rejected'} props.status the server's value, verbatim
 * @param {boolean} [props.short] use the one-word label, for a crowded card header
 */
export default function VerificationBadge({ status, short = false }) {
  // An unrecognised value falls back to pending rather than rendering nothing: a
  // record with no visible status would read as verified by omission, which is
  // exactly the false claim this component exists to prevent.
  const meta = VERIFICATION_META[status] ?? VERIFICATION_META[VERIFICATION_STATUSES.PENDING];

  return (
    <Badge variant={meta.variant} size="sm" className="gap-1">
      <span className="inline-flex items-center gap-1">
        <StatusIcon status={status} />
        {short ? meta.shortLabel : meta.label}
      </span>
    </Badge>
  );
}
