/**
 * Taking the paper: one question at a time, ten of them, then submit.
 *
 * ONE QUESTION ON SCREEN, NOT A SCROLLING LIST. A list would let a student
 * answer by pattern-matching across questions, and on a phone it turns a
 * ten-minute task into a scroll. The trade-off is that progress has to be shown
 * explicitly, which the jump strip below does.
 *
 * SUBMIT IS NOT GATED ON ANSWERING EVERYTHING. The server scores a missing
 * answer as zero and keeps it in the denominator, so an incomplete paper gives a
 * real, lower score. Blocking submit would leave a student stuck on a question
 * they cannot answer, which is the one situation where the score is most worth
 * recording honestly. The confirm dialog says how many are blank.
 *
 * NO TIMER. Timing pressure would change what the score measures, and a countdown
 * that expires mid-demo is a failure mode with no upside.
 */

import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import ProgressBar from '../../components/ui/ProgressBar.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import useAssessmentAttempt from '../../hooks/useAssessmentAttempt.js';

/** A, B, C, D — so a student and a judge can refer to an option out loud. */
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

/** One selectable answer. A real radio input, so keyboard and screen readers work. */
function OptionRow({ option, letter, isSelected, name, onSelect }) {
  return (
    <label
      className={[
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition',
        isSelected
          ? 'border-primary-400 bg-primary-50/70 ring-1 ring-primary-200'
          : 'border-slate-200 hover:border-primary-300 hover:bg-primary-50/30',
      ].join(' ')}
    >
      <input
        type="radio"
        name={name}
        checked={isSelected}
        onChange={() => onSelect(option.index)}
        // Click-to-deselect lives on the label, not the input, because a radio
        // group cannot express "none of these" once one is chosen.
        onClick={() => {
          if (isSelected) onSelect(option.index);
        }}
        className="sr-only"
      />

      <span
        className={[
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          isSelected ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600',
        ].join(' ')}
        aria-hidden="true"
      >
        {letter}
      </span>

      <span className={`text-sm leading-relaxed ${isSelected ? 'text-primary-900' : 'text-slate-700'}`}>
        {option.text}
      </span>
    </label>
  );
}

/**
 * The jump strip: every question as a numbered square, answered ones filled.
 *
 * Doubles as the progress indicator and as navigation, which is why there is no
 * separate "7 of 10" widget competing with it for the same information.
 */
function QuestionStrip({ questions, answers, currentIndex, onJump }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {questions.map((question) => {
        const isAnswered = answers[question.index] !== undefined;
        const isCurrent = question.index === currentIndex;

        return (
          <button
            key={question.index}
            type="button"
            onClick={() => onJump(question.index)}
            aria-current={isCurrent ? 'step' : undefined}
            aria-label={`Question ${question.index + 1}${isAnswered ? ', answered' : ', not answered'}`}
            className={[
              'h-8 w-8 rounded-md text-xs font-semibold tabular-nums transition',
              isCurrent
                ? 'bg-primary-600 text-white ring-2 ring-primary-200'
                : isAnswered
                  ? 'bg-primary-100 text-primary-800 hover:bg-primary-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
            ].join(' ')}
          >
            {question.index + 1}
          </button>
        );
      })}
    </div>
  );
}

export default function TakeAssessment() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  /** Set by the start page when POST /assessments returned an existing attempt. */
  const wasResumed = Boolean(useLocation().state?.resumed);

  const {
    assessment,
    isLoading,
    loadError,
    reload,
    questions,
    total,
    currentQuestion,
    currentIndex,
    isFirst,
    isLast,
    goTo,
    goNext,
    goPrevious,
    answers,
    answeredCount,
    selectedOptionIndex,
    selectOption,
    submit,
    isSubmitting,
    submitError,
  } = useAssessmentAttempt(assessmentId);

  const [isConfirming, setIsConfirming] = useState(false);

  if (isLoading) {
    return (
      <DashboardLayout title="Skill assessment" subtitle="Loading your questions…">
        <Card>
          <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
            <Spinner />
            Loading your questions…
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  if (loadError || !assessment) {
    const isMissing = loadError?.status === 404;

    return (
      <DashboardLayout title="Skill assessment" subtitle="This attempt is not available.">
        <div className="space-y-5">
          <BackLink to="/student/assessment">Back to assessments</BackLink>

          <Alert
            variant={isMissing ? 'warning' : 'error'}
            title={isMissing ? 'That attempt was not found' : 'This attempt could not be loaded'}
            message={
              isMissing
                ? 'It may have been discarded. Starting a new assessment takes a few seconds.'
                : (loadError?.message ?? 'Please try again.')
            }
          >
            <div className="mt-3 flex gap-2">
              {isMissing ? (
                <Button size="sm" onClick={() => navigate('/student/assessment')}>
                  Start a new assessment
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => reload()}>
                  Try again
                </Button>
              )}
            </div>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  // A submitted attempt reached through a stale link or the back button belongs on
  // the result page, not here — its questions come back with the scores attached.
  if (assessment.status === 'submitted') {
    navigate(`/student/assessment/${assessment.id}/result`, { replace: true });
    return null;
  }

  const unanswered = total - answeredCount;

  const handleSubmit = async () => {
    const scored = await submit();
    if (scored) navigate(`/student/assessment/${assessment.id}/result`, { replace: true });
    else setIsConfirming(false);
  };

  return (
    <DashboardLayout
      title={assessment.careerRoleTitle ?? 'Skill assessment'}
      subtitle={`Question ${currentIndex + 1} of ${total}`}
    >
      <div className="space-y-5">
        {wasResumed ? (
          <Alert
            variant="info"
            title="Picking up where you left off"
            message="You already had this assessment open, so it was not restarted."
          />
        ) : null}

        {submitError ? (
          <Alert
            variant="error"
            title="Could not submit your answers"
            message={submitError.message}
            errors={submitError.errors ?? []}
          />
        ) : null}

        <Card>
          <div className="space-y-3">
            <ProgressBar
              value={answeredCount}
              max={total}
              label={`${answeredCount} of ${total} answered`}
              valueLabel={`${total === 0 ? 0 : Math.round((answeredCount / total) * 100)}%`}
              barClassName={answeredCount === total ? 'bg-success-500' : 'bg-primary-600'}
            />

            <QuestionStrip
              questions={questions}
              answers={answers}
              currentIndex={currentIndex}
              onJump={goTo}
            />
          </div>
        </Card>

        {currentQuestion ? (
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary" size="sm">
                {currentQuestion.skillName}
              </Badge>
              <Badge variant="outline" size="sm">
                {currentQuestion.difficulty}
              </Badge>
              {selectedOptionIndex === null ? (
                <span className="text-xs text-slate-400">Not answered yet</span>
              ) : null}
            </div>

            <h2 className="mt-3 text-base font-medium leading-relaxed text-slate-900">
              {currentQuestion.questionText}
            </h2>

            {/* fieldset+legend so the question is announced with its options. */}
            <fieldset className="mt-4">
              <legend className="sr-only">{currentQuestion.questionText}</legend>
              <div className="space-y-2.5">
                {currentQuestion.options.map((option) => (
                  <OptionRow
                    key={option.index}
                    option={option}
                    letter={OPTION_LETTERS[option.index] ?? String(option.index + 1)}
                    isSelected={selectedOptionIndex === option.index}
                    name={`question-${currentQuestion.index}`}
                    onSelect={selectOption}
                  />
                ))}
              </div>
            </fieldset>

            <p className="mt-3 text-xs text-slate-400">
              Every option is worth something. Pick the closest one rather than leaving it blank.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={goPrevious} disabled={isFirst}>
                Previous
              </Button>

              {isLast ? (
                <Button onClick={() => setIsConfirming(true)} disabled={isSubmitting}>
                  Submit assessment
                </Button>
              ) : (
                <Button onClick={goNext}>Next</Button>
              )}
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-slate-500">
              This attempt has no questions. Start a new assessment to try again.
            </p>
          </Card>
        )}

        {/* Submitting cannot be undone, so it gets a confirmation — DESIGN.md. The
            count of blanks is the whole point of the dialog: it is the one number
            a student would want to know before it is too late to fix. */}
        {isConfirming ? (
          <div
            className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
          >
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
              <h2 id="submit-title" className="text-base font-semibold text-slate-900">
                Submit your assessment?
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                {unanswered === 0
                  ? 'You have answered all ten questions. Your skill scores are worked out and saved to your profile.'
                  : `${unanswered} ${unanswered === 1 ? 'question is' : 'questions are'} still blank and will score zero. You can go back and answer ${unanswered === 1 ? 'it' : 'them'} first.`}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Once submitted, the answers are final — this attempt cannot be edited.
              </p>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setIsConfirming(false)}
                  disabled={isSubmitting}
                >
                  Keep answering
                </Button>
                <Button onClick={handleSubmit} isLoading={isSubmitting}>
                  {isSubmitting ? 'Scoring…' : 'Submit and see results'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
