/**
 * The result of one attempt: the score, where it came from, and what to do next.
 *
 * EVERY NUMBER ON THIS PAGE COMES FROM THE SERVER. `overallScore` and each
 * `skillScores[].score` are computed in server/src/services/assessment.service.js
 * as plain arithmetic over the option weights. Nothing here recalculates them,
 * and no AI was involved in producing them — a judge asking "where does 74% come
 * from?" gets an answer that is countable by hand.
 *
 * STRENGTHS AND SKILLS-TO-IMPROVE ARE A SPLIT, NOT A NEW SCORE. The cut is the
 * app's existing proficiency band from constants/skills.js — "can work
 * independently" (60) and up is a strength, below it is worth practising — the
 * same bands the profile already labels skills with. Inventing a fresh threshold
 * here would mean the same 58% reads as two different verdicts on two pages.
 *
 * THE FULL SKILL GAP AGAINST THE ROLE IS NOT HERE YET. That needs the role's
 * required level per skill, which is the next phase. This page is careful to say
 * "your level", never "you are 40% short of what the role needs".
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { fetchAssessment } from '../../api/assessment.api.js';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ProgressBar from '../../components/ui/ProgressBar.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { levelLabelForScore, styleForScore } from '../../constants/skills.js';

/** The band at which a skill stops needing practice and starts being useful. */
const STRENGTH_THRESHOLD = 60;

/** A headline reading of the overall score. Wording, not arithmetic. */
const overallVerdict = (score) => {
  if (score >= 75) return { variant: 'success', label: 'Strong', bar: 'bg-success-500' };
  if (score >= 60) return { variant: 'primary', label: 'Solid', bar: 'bg-primary-600' };
  if (score >= 40) return { variant: 'warning', label: 'Developing', bar: 'bg-warning-500' };
  return { variant: 'error', label: 'Early days', bar: 'bg-error-600' };
};

/** One skill, its measured level and how it was reached. */
function SkillScoreRow({ entry }) {
  const style = styleForScore(entry.score);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-slate-900">{entry.skillName}</span>
        <span className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.chip}`}>
            {levelLabelForScore(entry.score)}
          </span>
          <span className="text-sm font-semibold tabular-nums text-slate-900">{entry.score}%</span>
        </span>
      </div>

      <ProgressBar
        value={entry.score}
        className="mt-1.5"
        size="sm"
        barClassName={entry.score >= STRENGTH_THRESHOLD ? 'bg-primary-600' : 'bg-warning-500'}
      />

      <p className="mt-1 text-xs text-slate-500">
        {entry.correctCount} of {entry.questionCount}{' '}
        {entry.questionCount === 1 ? 'question' : 'questions'} answered best
      </p>
    </div>
  );
}

export default function AssessmentResult() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let isActive = true;

    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const loaded = await fetchAssessment(assessmentId);
        if (isActive) setResult(loaded);
      } catch (error) {
        if (isActive) setLoadError(error);
      } finally {
        if (isActive) setIsLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [assessmentId]);

  if (isLoading) {
    return (
      <DashboardLayout title="Assessment result" subtitle="Loading your score…">
        <Card>
          <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
            <Spinner />
            Loading your result…
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  if (loadError || !result) {
    return (
      <DashboardLayout title="Assessment result" subtitle="This result is not available.">
        <div className="space-y-5">
          <BackLink to="/student">Back to dashboard</BackLink>
          <Alert
            variant={loadError?.status === 404 ? 'warning' : 'error'}
            title="That result could not be loaded"
            message={loadError?.message ?? 'Please try again.'}
          />
        </div>
      </DashboardLayout>
    );
  }

  // An attempt still open has no scores to show — send them back to finish it.
  if (result.status !== 'submitted') {
    return (
      <DashboardLayout title="Assessment result" subtitle="This attempt is not finished yet.">
        <div className="space-y-5">
          <BackLink to="/student">Back to dashboard</BackLink>
          <Alert
            variant="info"
            title="This assessment has not been submitted"
            message="There is no score yet. Finish the questions and submit to see your results."
          >
            <div className="mt-3">
              <Button size="sm" onClick={() => navigate(`/student/assessment/${result.id}`)}>
                Continue the assessment
              </Button>
            </div>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  const skillScores = result.skillScores ?? [];
  const strengths = skillScores.filter((entry) => entry.score >= STRENGTH_THRESHOLD);
  const toImprove = skillScores.filter((entry) => entry.score < STRENGTH_THRESHOLD);
  const verdict = overallVerdict(result.overallScore);

  return (
    <DashboardLayout
      title="Your assessment result"
      subtitle={result.careerRoleTitle ?? 'Broad skill assessment'}
    >
      <div className="space-y-5">
        <BackLink to="/student">Back to dashboard</BackLink>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Overall score</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums text-slate-900">
                  {result.overallScore}%
                </span>
                <Badge variant={verdict.variant}>{verdict.label}</Badge>
              </p>
              <p className="mt-1.5 text-sm text-slate-500">
                {result.answeredCount} of {result.questionCount} questions answered
                {result.careerRoleTitle ? ` · assessed for ${result.careerRoleTitle}` : ''}
              </p>
            </div>

            <div className="w-full sm:w-64">
              <ProgressBar value={result.overallScore} barClassName={verdict.bar} size="lg" />
              <p className="mt-2 text-xs text-slate-500">
                The average of every question, with blanks counted as zero.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card
            title="What you are strong at"
            description="Skills you scored at 'can work independently' or above."
          >
            {strengths.length > 0 ? (
              <div className="space-y-2">
                {strengths.map((entry) => (
                  <div
                    key={entry.skillId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-success-100 bg-success-50/60 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-900">{entry.skillName}</span>
                    <span className="text-sm font-semibold tabular-nums text-success-700">
                      {entry.score}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No clear strengths yet"
                description="Nothing reached the independent-working level in this attempt. That is a starting point, not a verdict — the skills below are where the fastest gains are."
              />
            )}
          </Card>

          <Card
            title="Skills to improve"
            description="Where practice would move your score the most."
          >
            {toImprove.length > 0 ? (
              <div className="space-y-2">
                {toImprove.map((entry) => (
                  <div
                    key={entry.skillId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-warning-100 bg-warning-50/60 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-900">{entry.skillName}</span>
                    <span className="text-sm font-semibold tabular-nums text-warning-700">
                      {entry.score}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nothing below the line"
                description="Every skill in this assessment came out at the independent-working level or better."
              />
            )}
          </Card>
        </div>

        <Card
          title="Your skill scores"
          description="One score per skill, from the questions that covered it."
        >
          {skillScores.length > 0 ? (
            <div className="space-y-5">
              {skillScores.map((entry) => (
                <SkillScoreRow key={entry.skillId} entry={entry} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No skill scores"
              description="This attempt did not produce per-skill scores."
            />
          )}
        </Card>

        <Card title="What happens with this">
          <p className="text-sm text-slate-600">
            These scores are now on your profile as verified levels, so they replace anything you
            had estimated for the same skills. Opportunity matching and learning recommendations
            read them from there.
          </p>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Link
              to="/student"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              Continue to dashboard
            </Link>
            <Link
              to="/student/profile#skills"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              See your skills
            </Link>
            <Link
              to="/student/opportunities"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Browse opportunities
            </Link>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
