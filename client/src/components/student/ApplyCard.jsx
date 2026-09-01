/**
 * The apply box on an opportunity page.
 *
 * ITS OWN COMPONENT BECAUSE IT HAS FIVE STATES AND THE PAGE HAS ENOUGH. Checking
 * whether this student has already applied, the form, submitting, the duplicate
 * case and "this posting is not open" are each a different thing to render, and
 * folding all five into OpportunityDetails.jsx would bury the job description
 * under state management.
 *
 * A 409 IS NOT A FAILURE HERE. The server refuses a second application with 409
 * and a sentence, and a duplicate means the student *has* applied — which is good
 * news badly timed, usually a double-click or a stale tab. So a 409 flips this
 * card into its already-applied state instead of showing a red banner.
 *
 * THE BUTTON IS ABSENT, NOT DISABLED, WHEN A POSTING IS CLOSED. A greyed-out
 * "Apply" is the first thing anyone clicks; a sentence saying the deadline passed
 * answers the question without inviting the click.
 *
 * NOTHING HERE DECIDES ELIGIBILITY. A student who does not meet the stated
 * branch or graduation year can still apply — the match breakdown above already
 * tells them where they stand, and turning that into a hard block would let a
 * profile typo cost someone a job they were qualified for.
 *
 * THE SAME CARD SERVES ACADEMICIANS (Step 7). Nothing in the request depends on the
 * caller's role: POST /applications takes an opportunity id and the server reads the
 * applicant from the token, and one application per applicant per posting is a
 * server-side unique index. Only four strings were role-specific — where "all
 * applications" and "find something else" point, and the two sentences about
 * measured skill levels, which is true of a student's assessed skills and not of an
 * academician's self-reported expertise. Those are props defaulted to the student
 * wording, so the student page is unchanged.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { applyToOpportunity, fetchMyApplicationFor } from '../../api/application.api.js';
import Alert from '../ui/Alert.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Textarea from '../ui/Textarea.jsx';
import ApplicationStatusTimeline from './ApplicationStatusTimeline.jsx';
import {
  APPLICATION_LIMITS,
  formatApplicationDate,
  statusLabel,
  statusMeaning,
  statusVariant,
} from '../../constants/applications.js';
import { AVAILABILITY } from '../../constants/opportunities.js';

/** Why a posting cannot be applied to, in the student's words. */
const CLOSED_REASON = {
  [AVAILABILITY.EXPIRED]: 'The deadline for this opportunity has passed, so it is no longer accepting applications.',
  [AVAILABILITY.CLOSED]: 'The company has closed this opportunity and is no longer accepting applications.',
  [AVAILABILITY.DRAFT]: 'This opportunity has not been published yet, so there is nothing to apply to.',
};

/**
 * @param {object} props
 * @param {string} props.opportunityId
 * @param {string} props.availability the posting's `availability`, not its `status`
 * @param {number|null} [props.matchScore]
 * @param {string} [props.applicationsTo] where "All applications" goes
 * @param {string} [props.browseTo] where to send someone whose posting has closed
 * @param {string} [props.submittedMessage] the success banner's body
 * @param {string} [props.formDescription] the sentence under the form's heading
 */
export default function ApplyCard({
  opportunityId,
  availability,
  matchScore = null,
  applicationsTo = '/student/applications',
  browseTo = '/student/matches',
  submittedMessage = 'The company can now see your profile and your measured skill levels alongside it.',
  formDescription = 'Your profile and your measured skill levels are sent with every application.',
}) {
  /** The existing application, or null for "has not applied". */
  const [application, setApplication] = useState(null);
  const [isChecking, setIsChecking] = useState(true);

  const [coverNote, setCoverNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [justApplied, setJustApplied] = useState(false);

  const isOpen = availability === AVAILABILITY.OPEN;

  useEffect(() => {
    let isActive = true;
    setIsChecking(true);

    (async () => {
      try {
        const existing = await fetchMyApplicationFor(opportunityId);
        if (isActive) setApplication(existing);
      } catch {
        /* Silent: "we could not check" is not worth a banner, and the server
           refuses a duplicate anyway, so the worst case is one wasted click that
           returns an honest message. */
        if (isActive) setApplication(null);
      } finally {
        if (isActive) setIsChecking(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [opportunityId]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (coverNote.length > APPLICATION_LIMITS.coverNoteMax) {
      setSubmitError({
        message: `Keep your cover note under ${APPLICATION_LIMITS.coverNoteMax} characters.`,
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await applyToOpportunity({ opportunityId, coverNote });
      setApplication(created);
      setJustApplied(true);
      setCoverNote('');
    } catch (error) {
      /* Already applied — the card's job now is to show that, not to complain. */
      if (error?.status === 409) {
        try {
          const existing = await fetchMyApplicationFor(opportunityId);
          setApplication(existing);
        } catch {
          setSubmitError({ message: error.message });
        }
      } else {
        setSubmitError(error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isChecking) {
    return (
      <Card title="Applying">
        <p className="py-1 text-sm text-slate-500">Checking whether you have applied…</p>
      </Card>
    );
  }

  /* Applied: the card becomes a status report. */
  if (application) {
    return (
      <Card
        title="Your application"
        description={
          formatApplicationDate(application.appliedAt)
            ? `Submitted on ${formatApplicationDate(application.appliedAt)}.`
            : 'Submitted.'
        }
        action={
          <span className="flex flex-wrap items-center gap-3">
            <Badge variant={statusVariant(application.status)}>
              {statusLabel(application.status)}
            </Badge>
            <Link
              to={applicationsTo}
              className="text-sm font-medium text-primary-700 hover:text-primary-800"
            >
              All applications →
            </Link>
          </span>
        }
      >
        <div className="space-y-4">
          {justApplied ? (
            <Alert
              variant="success"
              title="Application submitted"
              message={submittedMessage}
            />
          ) : null}

          <p className="text-sm text-slate-600">{statusMeaning(application.status)}</p>

          {typeof application.matchScoreAtApplication === 'number' ? (
            <p className="text-sm text-slate-600">
              You applied at a{' '}
              <span className="font-semibold tabular-nums text-slate-900">
                {application.matchScoreAtApplication}%
              </span>{' '}
              match. That number is a snapshot from the day you applied — improving your profile
              now will not change what the company sees on this application.
            </p>
          ) : null}

          {application.coverNote ? (
            <div>
              <p className="text-xs text-slate-500">Your note to the company</p>
              <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                {application.coverNote}
              </p>
            </div>
          ) : null}

          <div className="border-t border-slate-100 pt-4">
            <h4 className="mb-3 text-sm font-medium text-slate-900">Progress</h4>
            <ApplicationStatusTimeline
              status={application.status}
              statusHistory={application.statusHistory}
            />
          </div>
        </div>
      </Card>
    );
  }

  /* Not applied, and cannot: say why, offer nothing to click. */
  if (!isOpen) {
    return (
      <Card title="Applying">
        <p className="text-sm text-slate-600">
          {CLOSED_REASON[availability] ??
            'This opportunity is not currently accepting applications.'}
        </p>
        <Link
          to={browseTo}
          className="mt-3 inline-flex text-sm font-medium text-primary-700 hover:text-primary-800"
        >
          See opportunities that fit you →
        </Link>
      </Card>
    );
  }

  /* Open, not applied: the form. */
  return (
    <Card title="Apply to this opportunity" description={formDescription}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {submitError ? (
          <Alert
            variant="error"
            title="Your application was not submitted"
            message={submitError.message ?? 'Please try again.'}
            errors={submitError.errors}
          />
        ) : null}

        <Textarea
          label="Anything you want to add (optional)"
          name="coverNote"
          value={coverNote}
          onChange={(event) => setCoverNote(event.target.value)}
          rows={4}
          maxLength={APPLICATION_LIMITS.coverNoteMax}
          disabled={isSubmitting}
          placeholder="Why this role interests you, or something your profile does not show — a project, a deadline you can work to, anything relevant."
          hint="Optional. Your skills and profile are already included, so this is for what they do not say."
        />

        {typeof matchScore === 'number' ? (
          <p className="text-sm text-slate-600">
            Your current match is{' '}
            <span className="font-semibold tabular-nums text-slate-900">{matchScore}%</span>. This
            is recorded with your application, so the company sees the same number you did.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" isLoading={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Apply now'}
          </Button>
          <span className="text-xs text-slate-500">You can apply once to each opportunity.</span>
        </div>
      </form>
    </Card>
  );
}
