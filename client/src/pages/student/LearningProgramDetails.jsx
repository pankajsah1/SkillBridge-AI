/**
 * One learning programme, in full — and the only place a student changes their progress.
 *
 * WHAT IS OFFERED DEPENDS ON THE SAME RESPONSE THAT DESCRIBES THE PROGRAMME.
 * GET /learning/programs/:id returns the programme and the reader's own enrolment
 * together, so "Enroll" and "Continue — 40%" are decided from one fact rather than two
 * requests that could disagree.
 *
 * THE REASSESSMENT PROMPT IS DRIVEN FROM THE ENROLMENT'S STATUS, NOT FROM THE WRITE.
 * `justCompleted` arrives once, on the response that crossed 100%, and only changes the
 * wording; a page reloaded a day later still has to show the prompt, and only the stored
 * status can tell it that. This is the distinction the server draws itself at
 * `toEnrollmentResult`.
 *
 * NOTHING HERE TOUCHES A SKILL SCORE. Completing a programme records evidence that it
 * was done. The skills a student is credited with come from assessments, and the prompt
 * is an invitation to take one — not a claim that anything improved.
 */

import { Link, useParams } from 'react-router-dom';

import EnrollmentProgress from '../../components/learning/EnrollmentProgress.jsx';
import ReassessmentPrompt from '../../components/learning/ReassessmentPrompt.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import { FullPageLoader } from '../../components/ui/Spinner.jsx';
import {
  deliveryModeLabel,
  durationLabel,
  formatLearningDate,
  isEnrollable,
  isTerminalEnrollmentStatus,
  programAvailabilityBadge,
  programLevelLabel,
  programTypeLabel,
  programWindowLabel,
} from '../../constants/learning.js';
import useLearningProgram from '../../hooks/useLearningProgram.js';

/** One labelled fact in the summary grid. Absent values drop out entirely. */
function Fact({ label, children }) {
  if (!children) return null;

  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  );
}
export default function LearningProgramDetails() {
  const { programId } = useParams();

  const {
    program,
    enrollment,
    isLoading,
    loadError,
    reload,
    isSaving,
    saveError,
    completion,
    enroll,
    saveProgress,
  } = useLearningProgram(programId);

  if (isLoading) return <FullPageLoader label="Loading program…" />;

  // A 404 here is deliberately indistinguishable from a draft or an archived
  // programme: ids must not be guessable into someone's unpublished work.
  if (loadError || !program) {
    return (
      <DashboardLayout title="Program">
        <div className="space-y-6">
          <BackLink to="/student/learning">Back to the learning hub</BackLink>

          <Alert
            variant="error"
            title="This program could not be opened"
            message={loadError?.message ?? 'It may have been removed, or it is not published.'}
          >
            <Button type="button" variant="secondary" size="sm" onClick={reload}>
              Try again
            </Button>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  const badge = programAvailabilityBadge(program.availability);
  const skills = program.targetSkills ?? [];
  const prerequisites = program.prerequisites ?? [];
  const isComplete = isTerminalEnrollmentStatus(enrollment?.status);

  return (
    <DashboardLayout title={program.title} subtitle={programTypeLabel(program.type)}>
      <div className="space-y-6">
        <BackLink to="/student/learning">Back to the learning hub</BackLink>

        {isComplete ? (
          <ReassessmentPrompt
            skills={skills}
            programTitle={program.title}
            justCompleted={Boolean(completion?.justCompleted)}
          />
        ) : null}

        {saveError ? (
          <Alert
            variant="error"
            title="That did not save"
            message={saveError.message}
            errors={saveError.errors}
          />
        ) : null}

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{program.provider}</p>
              {program.publisher?.name && program.publisher.name !== program.provider ? (
                <p className="mt-0.5 text-xs text-slate-500">Listed by {program.publisher.name}</p>
              ) : null}
            </div>

            <Badge variant={badge.variant} size="sm">
              {badge.label}
            </Badge>
          </div>

          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {program.description}
          </p>

          <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Level">{programLevelLabel(program.level)}</Fact>
            <Fact label="Delivery">{deliveryModeLabel(program.deliveryMode)}</Fact>
            <Fact label="Duration">{durationLabel(program.durationHours)}</Fact>
            <Fact label="Instructor or mentor">{program.instructor}</Fact>
            <Fact label="Starts">{formatLearningDate(program.startDate)}</Fact>
            {/* Said as a sentence rather than a bare date, because enrolment closing is
                the part that affects the reader. */}
            <Fact label="Enrollment">{programWindowLabel(program)}</Fact>
          </dl>

          {program.externalUrl ? (
            <p className="mt-5 border-t border-slate-100 pt-5 text-sm">
              <a
                href={program.externalUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-primary-700 transition hover:text-primary-800"
              >
                Open the program ↗
              </a>
              <span className="ml-2 text-xs text-slate-500">
                The learning happens there. This portal tracks your enrollment and progress.
              </span>
            </p>
          ) : null}
        </Card>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Card
              title="Skills it teaches"
              description="From the same catalogue your skill profile is measured in — which is how this program can be matched to your gaps."
            >
              {skills.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {skills.map((skill) => (
                    <Badge key={skill.skillId} variant="outline" size="sm">
                      {skill.name ?? 'Skill'}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No skills were listed for this program.</p>
              )}

              {prerequisites.length > 0 ? (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Prerequisites
                  </p>

                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {prerequisites.map((entry) => (
                      <li key={entry} className="flex gap-2">
                        <span className="text-slate-300" aria-hidden="true">
                          •
                        </span>
                        {entry}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          </div>

          <div className="lg:col-span-2">
            {enrollment ? (
              <Card title="Your progress">
                <EnrollmentProgress
                  enrollment={enrollment}
                  onSave={saveProgress}
                  isSaving={isSaving}
                />

                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <Link
                    to="/student/my-learning"
                    className="font-medium text-primary-700 transition hover:text-primary-800"
                  >
                    See everything you are learning →
                  </Link>
                </p>
              </Card>
            ) : (
              <Card title="Enroll">
                {isEnrollable(program) ? (
                  <>
                    <p className="text-sm text-slate-600">
                      Enrolling adds this to My Learning, where you report your own progress.
                      It does not change your skill levels — an assessment does that.
                    </p>

                    <div className="mt-4">
                      <Button
                        type="button"
                        // The hook stores the rejection in `saveError` before it
                        // rethrows, and the banner above is already showing it — so a
                        // 409 needs catching here, not handling twice.
                        onClick={() => {
                          enroll().catch(() => {});
                        }}
                        isLoading={isSaving}
                      >
                        Enroll in this program
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">
                    Enrollment is closed for this program. It is kept here so you can still see
                    what it covered.
                  </p>
                )}
              </Card>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

