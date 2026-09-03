/**
 * The progress control on one enrolment: where the learner is, and how they say so.
 *
 * SELF-REPORTED, AND THE COMPONENT SAYS SO. Nothing here observes what a learner
 * actually did — there is no course player to observe. The number is their own claim
 * about their own learning, which is exactly why it is learning *evidence* and never a
 * skill score. The line under the control is the whole product principle in one
 * sentence: finishing this changes your record of learning, not your measured skill.
 *
 * THE SLIDER'S MINIMUM IS THE STORED VALUE, NOT ZERO, because the server refuses a
 * decrease ("Progress cannot go backwards", rule 3 of updateEnrollment). A control that
 * can be dragged to a value the API is certain to reject is a 400 waiting to happen, so
 * the range is narrowed to what is actually allowed rather than the error being
 * explained afterwards.
 *
 * 100% IS COMPLETION AND THE BUTTON SAYS SO BEFORE IT IS CLICKED. `impliedStatusForProgress`
 * mirrors the server's derivation, so the promise on the label is the one the API keeps.
 * Completion is terminal there, so it must not look casual here.
 *
 * WHEN COMPLETE, THE CONTROLS GO. Not disabled — gone. A disabled slider on a finished
 * programme invites the reading that it could be reopened, and it cannot be.
 */

import { useEffect, useState } from 'react';

import {
  ENROLLMENT_STATUSES,
  PROGRESS_ON_COMPLETION,
  clampProgress,
  enrollmentStatusBadge,
  formatLearningDate,
  impliedStatusForProgress,
  isTerminalEnrollmentStatus,
  progressLabel,
} from '../../constants/learning.js';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';

/** Coarse enough to drag accurately, fine enough to be a real answer. */
const STEP = 5;

export default function EnrollmentProgress({
  enrollment,
  /** (progress) => Promise. Omitted makes this a read-only display. */
  onSave,
  isSaving = false,
  disabled = false,
}) {
  const stored = clampProgress(enrollment?.progress ?? 0);
  const isComplete = isTerminalEnrollmentStatus(enrollment?.status);

  const [draft, setDraft] = useState(stored);

  /**
   * Resyncs when the stored figure changes — after a successful save, or when the
   * parent hands over a different enrolment. A rejected save leaves `stored` alone, so
   * the attempted value survives for a retry instead of snapping back.
   */
  useEffect(() => {
    setDraft(stored);
  }, [stored]);

  const badge = enrollmentStatusBadge(enrollment?.status);
  const isDirty = draft !== stored;
  const willComplete = impliedStatusForProgress(draft) === ENROLLMENT_STATUSES.COMPLETED;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Badge variant={badge.variant} size="sm">
          {badge.label}
        </Badge>

        {isComplete && enrollment?.completedAt ? (
          <span className="text-xs text-slate-500">
            Completed {formatLearningDate(enrollment.completedAt)}
          </span>
        ) : null}
      </div>

      <div className="mt-2.5">
        <ProgressBar
          value={stored}
          label="Your progress"
          valueLabel={progressLabel(stored)}
          barClassName={isComplete ? 'bg-success-600' : 'bg-primary-600'}
        />
      </div>

      {isComplete ? (
        <p className="mt-2.5 text-xs text-slate-500">
          Completion is recorded and cannot be wound back. It is evidence that you did the
          program — your skill levels still come from assessments.
        </p>
      ) : onSave ? (
        <div className="mt-3.5 space-y-2.5">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">
              Update progress:{' '}
              <span className="tabular-nums text-slate-900">{progressLabel(draft)}</span>
            </span>

            <input
              type="range"
              min={stored}
              max={PROGRESS_ON_COMPLETION}
              step={STEP}
              value={draft}
              onChange={(event) => setDraft(clampProgress(event.target.value))}
              disabled={disabled || isSaving}
              className="mt-1.5 w-full accent-primary-600 disabled:cursor-not-allowed"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onSave(draft)}
              isLoading={isSaving && isDirty}
              disabled={disabled || !isDirty}
            >
              {willComplete ? 'Save and complete' : 'Save progress'}
            </Button>

            {/* Offered separately because "I have finished" is a different intention
                from "I am further along", and dragging to exactly 100 to express it
                is fiddly. Both end up as the same request. */}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onSave(PROGRESS_ON_COMPLETION)}
              disabled={disabled || isSaving}
            >
              Mark complete
            </Button>
          </div>

          <p className="text-xs text-slate-500">
            {willComplete
              ? 'Saving 100% marks this program complete, which cannot be undone.'
              : 'Progress is what you report yourself, and it only moves forward. Completing a program records that you did it — your skill levels change when you reassess, not before.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
