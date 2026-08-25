/**
 * One applicant, as a recruiter reads them.
 *
 * TWO KINDS OF NUMBER, LABELLED AS SUCH, AND THAT IS THE WHOLE POINT OF THIS
 * CARD. The match percentage is a snapshot: it is what the portal calculated on
 * the day this student applied, it is what the student themselves was shown, and
 * it does not move afterwards. Everything else — institution, readiness, skill
 * coverage — is read live from the profile as it stands now. A card that mixed
 * the two silently would leave a recruiter unable to trust either, so the
 * snapshot says "at the time of applying" in words next to it.
 *
 * THE RANK IS THE SERVER'S, NOT THE ARRAY INDEX. It is computed from the page
 * offset, so #13 stays #13 on page two. Recomputing it here from `index` would
 * quietly restart the numbering on every page.
 *
 * ONLY LEGAL MOVES ARE OFFERED. The buttons come from the transition map, so a
 * recruiter is never shown "Move to interview" on an application nobody has
 * shortlisted. The server enforces the same rule; this only avoids offering a
 * click that would come back as a 400.
 *
 * REJECTION ASKS FIRST. `window.confirm` on "Not selected" and on "Select",
 * because both are terminal — the server refuses any further move once an
 * application reaches them, so a misclick is not undoable.
 */

import { useState } from 'react';

import ApplicationStatusTimeline from '../student/ApplicationStatusTimeline.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';
import Textarea from '../ui/Textarea.jsx';
import {
  APPLICATION_LIMITS,
  APPLICATION_STATUSES,
  formatApplicationDate,
  isTerminalStatus,
  nextStatusesFor,
  relativeDays,
  statusActionLabel,
  statusActionVariant,
  statusLabel,
  statusVariant,
} from '../../constants/applications.js';
import { levelLabelForScore, styleForScore } from '../../constants/skills.js';

/** What to warn about before a move that cannot be taken back. */
const CONFIRM_BEFORE = {
  [APPLICATION_STATUSES.SELECTED]:
    'Mark this candidate as selected? This is final — the application cannot be changed afterwards.',
  [APPLICATION_STATUSES.REJECTED]:
    'Mark this candidate as not selected? This is final — the application cannot be changed afterwards.',
};

/** One labelled fact. Renders nothing rather than an empty row. */
function Fact({ label, children }) {
  if (children === null || children === undefined || children === '') return null;

  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

/** "Third year · Graduating 2027", built from whichever halves exist. */
const studyLine = (profile) => {
  const parts = [];
  if (profile.degree) parts.push(profile.degree);
  if (profile.branch) parts.push(profile.branch);
  return parts.length > 0 ? parts.join(' · ') : null;
};

export default function CandidateCard({ application, onChangeStatus, isUpdating = false }) {
  const [noteText, setNoteText] = useState('');
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const { student, profile, coverage, status, rank } = application;
  const score = application.matchScoreAtApplication;
  const moves = nextStatusesFor(status);

  const handleMove = (next) => {
    const question = CONFIRM_BEFORE[next];
    if (question && !window.confirm(question)) return;

    onChangeStatus(application.id, { status: next, note: noteText });
    setNoteText('');
    setIsNoteOpen(false);
  };

  return (
    <Card className="border-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-start gap-3">
          {/* The rank sits before the name because the list is ordered and the
              order is the recruiter's shortcut. */}
          <span className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
            {rank}
          </span>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {student?.name ?? 'Candidate'}
            </h3>
            <p className="truncate text-xs text-slate-500">{student?.email}</p>
            {profile?.headline ? (
              <p className="mt-1 text-sm text-slate-600">{profile.headline}</p>
            ) : null}
          </div>
        </div>

        <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
      </div>

      {/* The snapshot score. Its caption is not decoration — it is the sentence
          that stops a recruiter reading it as today's number. */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {typeof score === 'number' ? (
          <>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Skill match
              </span>

              <span className="flex shrink-0 items-baseline gap-2">
                <span className="text-sm font-semibold tabular-nums text-slate-900">{score}%</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${styleForScore(score).chip}`}>
                  {levelLabelForScore(score)}
                </span>
              </span>
            </div>

            <ProgressBar value={score} max={100} size="sm" />

            <p className="mt-1.5 text-xs text-slate-500">
              Calculated at the time of applying, from this student&apos;s verified and
              self-reported skills. It is not recalculated later.
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-500">
            No match score was recorded for this application. Everything below is read from the
            candidate&apos;s profile as it stands now.
          </p>
        )}
      </div>

      {profile ? (
        <dl className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Institution">{profile.institutionName}</Fact>
          <Fact label="Studying">{studyLine(profile)}</Fact>
          <Fact label="Graduating">{profile.graduationYear}</Fact>
          <Fact label="Location">{profile.location}</Fact>
          <Fact label="CGPA">{profile.cgpa}</Fact>

          {/* Live, and said so: the readiness figure moves as the student takes
              assessments, unlike the match score above it. */}
          <Fact label="Career readiness (today)">
            {typeof profile.readinessScore === 'number' ? `${profile.readinessScore}%` : null}
          </Fact>

          <Fact label="Required skills met">
            {coverage?.total > 0
              ? `${coverage.met} of ${coverage.total}${
                  coverage.verified > 0 ? ` · ${coverage.verified} verified` : ''
                }`
              : 'This posting listed no required skills'}
          </Fact>

          <Fact label="Skills on profile">
            {profile.skillCount > 0
              ? `${profile.skillCount}${
                  profile.verifiedSkillCount > 0
                    ? ` · ${profile.verifiedSkillCount} assessment-verified`
                    : ''
                }`
              : 'None listed yet'}
          </Fact>

          <Fact label="Applied">
            {formatApplicationDate(application.appliedAt)}
            {relativeDays(application.appliedAt) ? (
              <span className="font-normal text-slate-500">
                {' '}
                · {relativeDays(application.appliedAt)}
              </span>
            ) : null}
          </Fact>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          This candidate has not built a profile yet, so there is nothing to show beyond their
          application. Applied {relativeDays(application.appliedAt)}.
        </p>
      )}

      {application.coverNote ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Why they applied
          </p>

          <p
            className={`mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700 ${
              isNoteExpanded ? '' : 'line-clamp-3'
            }`}
          >
            {application.coverNote}
          </p>

          {application.coverNote.length > 220 ? (
            <button
              type="button"
              onClick={() => setIsNoteExpanded((open) => !open)}
              className="mt-1 text-xs font-medium text-primary-700 hover:text-primary-800"
            >
              {isNoteExpanded ? 'Show less' : 'Read all of it'}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setIsTimelineOpen((open) => !open)}
          className="text-xs font-medium text-primary-700 hover:text-primary-800"
        >
          {isTimelineOpen ? 'Hide history' : 'Show history'}
        </button>

        {isTimelineOpen ? (
          <div className="mt-3">
            {/* The same component the student sees, so the two sides of the
                pipeline can never describe it differently. */}
            <ApplicationStatusTimeline
              status={status}
              statusHistory={application.statusHistory}
            />
          </div>
        ) : null}
      </div>

      {isTerminalStatus(status) ? (
        <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-500">
          This application is closed as &ldquo;{statusLabel(status)}&rdquo; and can no longer be
          changed.
        </p>
      ) : (
        <div className="mt-4 border-t border-slate-100 pt-3">
          {isNoteOpen ? (
            <div className="mb-3">
              <Textarea
                label="Note for this decision"
                name={`note-${application.id}`}
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                rows={2}
                maxLength={APPLICATION_LIMITS.statusNoteMax}
                placeholder="Optional — kept with the status change in this application's history."
                disabled={isUpdating}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {moves.map((next) => (
              <Button
                key={next}
                size="sm"
                variant={statusActionVariant(next)}
                onClick={() => handleMove(next)}
                disabled={isUpdating}
              >
                {statusActionLabel(next)}
              </Button>
            ))}

            {/* Last, and quiet: the note is optional and most decisions will not
                have one, so it should not stand between a recruiter and the
                button they came for. */}
            <button
              type="button"
              onClick={() => setIsNoteOpen((open) => !open)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {isNoteOpen ? 'Cancel note' : 'Add a note'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
