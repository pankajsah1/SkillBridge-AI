/**
 * The summary panel under the header: what the portfolio page adds to what the
 * profile already has.
 *
 * THE BRIEF SAYS "REUSE, DO NOT DUPLICATE". Step 6 asks for a "quick profile
 * summary" reusing existing skills, readiness and career goals, and explicitly
 * warns against "a duplicate skills list that becomes inconsistent". So the skills
 * come from the profile object this page already fetched (same array the profile
 * page edits), and readiness comes from the existing readiness endpoint — the one
 * CareerReadiness, the dashboard and matched pages all use. There is no second
 * copy of the level bands either; the labels and chip styles come from
 * constants/skills.js, the single vocabulary used across the app.
 *
 * Silence is deliberate here. This is a summary, not a dashboard: if readiness has
 * no career goal to compare against, the panel says so in one line rather than
 * fetching, failing, and showing an error card next to the resume upload.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchMyReadiness } from '../../api/studentProfile.api.js';
import { levelLabelForScore, styleForScore } from '../../constants/skills.js';
import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';

export default function PortfolioSummary({ profile }) {
  const [readiness, setReadiness] = useState(null);
  const [careerRole, setCareerRole] = useState(null);
  const [reason, setReason] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const result = await fetchMyReadiness();
        if (!isActive) return;
        setReadiness(result.readiness);
        setCareerRole(result.careerRole);
        setReason(result.reason);
      } catch {
        if (isActive) {
          setReadiness(null);
          setCareerRole(null);
          setReason('error');
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const skills = profile?.skills ?? [];
  const goals = profile?.targetRoles ?? [];

  return (
    <Card
      title="At a glance"
      description="The same data your profile, assessment and matches use — nothing here is a separate copy."
    >
      <div className="space-y-4">
        {/* Skills, at most eight, newest first isn't right here — keep the order
            the profile shows. The rest are behind the link, not hidden entirely. */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">
              Skills {skills.length > 0 ? `(${skills.length})` : ''}
            </p>
            <Link
              to="/student/profile#skills"
              className="text-sm font-medium text-primary-700 transition hover:text-primary-800"
            >
              Manage
            </Link>
          </div>

          {skills.length === 0 ? (
            <p className="text-sm text-slate-500">
              No skills yet. Add a few — and take an assessment, which turns them from
              self-estimates into measured levels.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {skills.slice(0, 8).map((skill) => (
                <Badge
                  key={skill.skillId}
                  variant="neutral"
                  size="sm"
                  className={styleForScore(skill.level).chip}
                >
                  {skill.name}
                </Badge>
              ))}
              {skills.length > 8 ? (
                <Badge variant="outline" size="sm">
                  +{skills.length - 8} more
                </Badge>
              ) : null}
            </div>
          )}
        </div>

        {/* Career goals, same reuse rule: read from the profile array. */}
        <div className="border-t border-slate-100 pt-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">Career goals</p>
            <Link
              to="/student/profile#career-goals"
              className="text-sm font-medium text-primary-700 transition hover:text-primary-800"
            >
              Manage
            </Link>
          </div>

          {goals.length === 0 ? (
            <p className="text-sm text-slate-500">
              No target role yet. Set one and the portal can tell you what readiness means for you.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {goals.map((goal) => (
                <Badge key={goal.roleId} variant="primary" size="sm">
                  {goal.title}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Readiness against the priority goal. One line, not a second progress
            bar — the header already shows the portfolio percentage, and stacked
            bars of different meanings start to read as one metric. */}
        <div className="border-t border-slate-100 pt-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">Readiness</p>
            <Link
              to="/student/readiness"
              className="text-sm font-medium text-primary-700 transition hover:text-primary-800"
            >
              See gaps
            </Link>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-500">Working it out…</p>
          ) : readiness ? (
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{readiness.readinessScore}%</span>{' '}
              {careerRole ? `ready for ${careerRole.title}.` : 'ready against your target.'}{' '}
              {readiness.skillGaps?.length > 0
                ? `${readiness.skillGaps.length} ${
                    readiness.skillGaps.length === 1 ? 'skill gap' : 'skill gaps'
                  } to close.`
                : 'No gaps to close.'}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              {reason === 'no-profile'
                ? 'Set up your profile first.'
                : reason === 'error'
                  ? 'Readiness is unavailable right now.'
                  : 'Set a career goal and readiness will measure you against it.'}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
