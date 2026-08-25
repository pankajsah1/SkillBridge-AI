/**
 * Where an application actually stands, as a timeline.
 *
 * A STATUS BADGE ANSWERS "WHAT". THIS ANSWERS "WHEN, AND WHAT NEXT". "Under
 * review" on its own leaves a student refreshing the page; the same word with
 * "since 14 August" beside it, and the two stages still ahead greyed out below,
 * tells them there is nothing to do yet — which is the honest and the useful
 * answer at once.
 *
 * DRAWN FROM `statusHistory`, NOT FROM `status`. Every completed step carries the
 * date the server recorded for it. Nothing here infers a date it was not given,
 * so a stage with no history entry renders as pending even if a later stage has
 * been reached — that would be a server bug, and inventing a plausible timestamp
 * would hide it.
 *
 * NO CHART LIBRARY. Two divs and a border are enough for five steps, and a
 * dependency would be a bigger change to this project than the feature.
 */

import Badge from '../ui/Badge.jsx';
import {
  APPLICATION_PIPELINE,
  APPLICATION_STATUSES,
  formatApplicationDate,
  statusLabel,
  statusMeaning,
  statusVariant,
} from '../../constants/applications.js';

/** The most recent history entry for a status, or null. */
const entryFor = (history, status) => {
  const matches = (history ?? []).filter((entry) => entry.status === status);
  return matches.length > 0 ? matches[matches.length - 1] : null;
};

/** A filled dot for what has happened, a hollow one for what has not. */
function Marker({ state }) {
  if (state === 'done') {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-500 text-[11px] font-bold text-white"
      >
        ✓
      </span>
    );
  }

  if (state === 'current') {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 ring-4 ring-primary-100"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-slate-200 bg-white"
    />
  );
}

/** One stage. `state` is 'done' | 'current' | 'pending'. */
function Step({ status, state, entry, isLast }) {
  const reached = state !== 'pending';
  const date = formatApplicationDate(entry?.changedAt);

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <Marker state={state} />
        {isLast ? null : (
          <span
            aria-hidden="true"
            className={`mt-1 w-0.5 flex-1 ${state === 'done' ? 'bg-success-200' : 'bg-slate-200'}`}
          />
        )}
      </div>

      <div className={`pb-5 ${isLast ? 'pb-0' : ''}`}>
        <p
          className={`text-sm font-medium ${reached ? 'text-slate-900' : 'text-slate-400'}`}
        >
          {statusLabel(status)}
          {/* The screen-reader equivalent of the dot, since colour and a tick
              glyph are not a state a screen reader can read. */}
          <span className="sr-only">
            {state === 'done' ? ' — completed' : state === 'current' ? ' — current stage' : ' — not reached yet'}
          </span>
        </p>

        {date ? <p className="mt-0.5 text-xs text-slate-500">{date}</p> : null}

        {entry?.note ? (
          <p className="mt-1.5 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600">
            “{entry.note}”
          </p>
        ) : null}

        {state === 'current' ? (
          <p className="mt-1 text-xs text-slate-600">{statusMeaning(status)}</p>
        ) : null}
      </div>
    </li>
  );
}

export default function ApplicationStatusTimeline({ status, statusHistory = [] }) {
  const isRejected = status === APPLICATION_STATUSES.REJECTED;

  /**
   * A rejection is an outcome, not stage 6 of 5.
   *
   * It can arrive at any point, so it is drawn as its own block above the
   * pipeline rather than placed on it — putting it inline would mean either
   * guessing which stage it interrupted or implying every application ends there.
   */
  const rejection = isRejected ? entryFor(statusHistory, APPLICATION_STATUSES.REJECTED) : null;

  /**
   * The furthest stage reached. Read from the history rather than from `status`
   * so that skipped stages (applied straight to shortlisted, which the server
   * allows) stay correctly marked as never having happened.
   */
  const reachedIndexes = APPLICATION_PIPELINE.map((step, index) =>
    entryFor(statusHistory, step) ? index : -1,
  ).filter((index) => index >= 0);

  const currentIndex = isRejected
    ? -1
    : Math.max(APPLICATION_PIPELINE.indexOf(status), ...reachedIndexes, 0);

  return (
    <div>
      {rejection ? (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(APPLICATION_STATUSES.REJECTED)}>
              {statusLabel(APPLICATION_STATUSES.REJECTED)}
            </Badge>
            {formatApplicationDate(rejection.changedAt) ? (
              <span className="text-xs text-slate-500">
                {formatApplicationDate(rejection.changedAt)}
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {statusMeaning(APPLICATION_STATUSES.REJECTED)} The stages below show how far it got.
          </p>

          {rejection.note ? (
            <p className="mt-2 rounded-lg bg-white p-2.5 text-xs leading-relaxed text-slate-600">
              “{rejection.note}”
            </p>
          ) : null}
        </div>
      ) : null}

      <ol className={rejection ? 'opacity-70' : ''}>
        {APPLICATION_PIPELINE.map((step, index) => {
          const entry = entryFor(statusHistory, step);

          let state = 'pending';
          if (!isRejected && index === currentIndex) state = 'current';
          else if (entry) state = 'done';

          return (
            <Step
              key={step}
              status={step}
              state={state}
              entry={entry}
              isLast={index === APPLICATION_PIPELINE.length - 1}
            />
          );
        })}
      </ol>
    </div>
  );
}
