/**
 * Career readiness: how close this student is to the role they want, and what
 * is missing.
 *
 * THE PAGE'S WHOLE JOB IS TO MAKE ONE NUMBER ARGUABLE. A readiness percentage
 * on its own is a verdict; a readiness percentage next to the per-skill
 * subtraction that produced it is evidence. So every gap row shows the two
 * numbers that made it — "you are at 45, the role wants 70" — and the gap is
 * their difference, visible rather than asserted.
 *
 * NOTHING IS CALCULATED HERE. `readinessScore`, every `gap`, every
 * `readinessImpact` comes from GET /students/readiness. The rule from the
 * assessment result page holds: one number, one source, so the dashboard and
 * this page can never disagree about the same student.
 *
 * GAPS ARE ORDERED BY WHAT CLOSING THEM WOULD BUY, not by size. A 40-point hole
 * in a skill worth 5% of the role matters less than a 20-point hole in one worth
 * 25%, and the server sorts on exactly that. The list is a plan, top-down.
 *
 * A ROLE PICKER, BECAUSE READINESS IS RELATIVE. The same student is 80% ready
 * for one role and 40% for another; being able to switch is the difference
 * between a score and an actual decision about what to aim at.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchCareerRoles } from '../../api/catalogue.api.js';
import { fetchMyReadiness, fetchMyRecommendations } from '../../api/studentProfile.api.js';
import RecommendedLearning from '../../components/student/RecommendedLearning.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ProgressBar from '../../components/ui/ProgressBar.jsx';
import Select from '../../components/ui/Select.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { levelLabelForScore, styleForScore } from '../../constants/skills.js';

/**
 * Wording for the headline number, and the bar colour that goes with it.
 *
 * The thresholds are the app's existing proficiency bands (75 ADVANCED, 60
 * INTERMEDIATE, 40 BASIC) rather than new ones invented for this page, so 62%
 * cannot read as "solid" here and "developing" two clicks away.
 */
const readingOf = (score) => {
  if (score >= 75) return { label: 'Nearly there', bar: 'bg-success-500', variant: 'success' };
  if (score >= 60) return { label: 'On track', bar: 'bg-primary-600', variant: 'primary' };
  if (score >= 40) return { label: 'Building up', bar: 'bg-warning-500', variant: 'warning' };
  return { label: 'Early days', bar: 'bg-error-600', variant: 'error' };
};

/** How a gap's urgency is shown. Severity itself is decided by the server. */
const SEVERITY_STYLES = {
  minor: { chip: 'bg-primary-50 text-primary-700', label: 'Small gap', bar: 'bg-primary-600' },
  moderate: { chip: 'bg-warning-50 text-warning-700', label: 'Moderate gap', bar: 'bg-warning-500' },
  major: { chip: 'bg-error-50 text-error-700', label: 'Large gap', bar: 'bg-error-600' },
};

/**
 * One skill the role wants more of.
 *
 * The bar shows attainment — how much of the requirement is already covered —
 * rather than the raw level, because "you are 64% of the way to what this role
 * asks" is the thing being measured. The raw numbers sit beside it in text so
 * nothing is hidden behind the visual.
 */
function GapRow({ row }) {
  const severity = SEVERITY_STYLES[row.severity] ?? SEVERITY_STYLES.moderate;

  return (
    <div className="rounded-lg border border-slate-200 p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-slate-900">{row.skillName}</span>

        <span className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severity.chip}`}>
            {severity.label}
          </span>
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            +{row.gap}
          </span>
        </span>
      </div>

      <ProgressBar
        value={row.attainmentPercent}
        className="mt-2"
        size="sm"
        barClassName={severity.bar}
      />

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="tabular-nums">
          You: <span className="font-medium text-slate-700">{row.studentLevel}</span> · Needed:{' '}
          <span className="font-medium text-slate-700">{row.requiredLevel}</span>
        </span>

        {/* Only worth saying when it rounds to something. A "+0 readiness"
            label on a low-weight skill would be noise pretending to be data. */}
        {row.readinessImpact > 0 ? (
          <span className="tabular-nums">
            Worth +{row.readinessImpact}% readiness
          </span>
        ) : null}

        {row.isMeasured ? null : (
          <span className="text-slate-400">Not on your profile yet</span>
        )}
      </div>
    </div>
  );
}

/** One skill already at or above what the role asks. */
function StrengthRow({ row }) {
  const style = styleForScore(row.studentLevel);

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 py-2 last:border-0">
      <span className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-900">{row.skillName}</span>
        {row.isVerified ? (
          <Badge variant="success" size="sm">
            Verified
          </Badge>
        ) : null}
      </span>

      <span className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.chip}`}>
          {levelLabelForScore(row.studentLevel)}
        </span>
        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {row.studentLevel}
        </span>
      </span>
    </div>
  );
}

export default function CareerReadiness() {
  /** '' means "use my primary career goal", which is what the server does too. */
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const [readiness, setReadiness] = useState(null);
  const [careerRole, setCareerRole] = useState(null);
  const [reason, setReason] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [roles, setRoles] = useState([]);

  /**
   * Recommendations, loaded alongside readiness rather than derived from it.
   *
   * They could be computed here from `readiness.skillGaps` — the inputs are all
   * present — but then the ranking would exist twice, in two languages, and the
   * demo would eventually show a different order in the two places. One owner.
   */
  const [recommendations, setRecommendations] = useState([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);

  const load = useCallback(async (roleId) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await fetchMyReadiness(roleId || undefined);
      setReadiness(result.readiness);
      setCareerRole(result.careerRole);
      setReason(result.reason);
    } catch (error) {
      setLoadError(error);
      setReadiness(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Recommendations fail quietly. Readiness is the page; a missing "what to
   * learn" list is a smaller loss than an error banner over a working gap
   * analysis, and the section renders its own empty state.
   */
  const loadRecommendations = useCallback(async (roleId) => {
    setIsLoadingRecommendations(true);

    try {
      const result = await fetchMyRecommendations({ careerRoleId: roleId || undefined });
      setRecommendations(result.recommendations);
    } catch {
      setRecommendations([]);
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, []);

  useEffect(() => {
    load(selectedRoleId);
    loadRecommendations(selectedRoleId);
  }, [load, loadRecommendations, selectedRoleId]);

  /**
   * The role list is only for the picker, so a failure is swallowed: the page
   * still works against the primary goal without it, and an error banner about
   * a dropdown would outweigh what was lost.
   */
  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const loaded = await fetchCareerRoles();
        if (isActive) setRoles(loaded);
      } catch {
        if (isActive) setRoles([]);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const reading = useMemo(
    () => readingOf(readiness?.readinessScore ?? 0),
    [readiness?.readinessScore],
  );

  const subtitle = careerRole
    ? `Measured against ${careerRole.title}`
    : 'How close you are to the role you want.';

  return (
    <DashboardLayout title="Career readiness" subtitle={subtitle}>
      <div className="space-y-5">
        <BackLink to="/student">Back to dashboard</BackLink>

        {loadError ? (
          <Alert
            variant="error"
            title="Could not work out your readiness"
            message={loadError.message}
          >
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => load(selectedRoleId)}>
                Try again
              </Button>
            </div>
          </Alert>
        ) : null}

        {/* The picker stays visible in every state, including the empty ones —
            "no career goal set" is exactly when choosing a role to measure
            against is most useful. */}
        <Card
          title="Role to measure against"
          description="Readiness is relative: the same skills read differently against different roles."
        >
          <Select
            label="Career role"
            name="careerRoleId"
            value={selectedRoleId}
            onChange={(event) => setSelectedRoleId(event.target.value)}
            options={roles.map((role) => ({ value: role.id, label: role.title }))}
            placeholder="My primary career goal"
            hint={
              selectedRoleId
                ? 'Your profile is unchanged — this only changes what you are compared against here.'
                : 'Using the first career goal on your profile.'
            }
          />
        </Card>

        {isLoading ? (
          <Card>
            <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
              <Spinner />
              Working out your readiness…
            </div>
          </Card>
        ) : !readiness ? (
          <Card>
            <EmptyState
              title={
                reason === 'no-profile'
                  ? 'You have not set up your profile yet'
                  : 'No career goal to measure against'
              }
              description={
                reason === 'no-profile'
                  ? 'Readiness compares your skills against a role, so it needs your profile first. It takes a minute.'
                  : 'Pick a role above for a one-off look, or set a career goal so the portal keeps using it everywhere.'
              }
              action={
                <Link
                  to="/student/profile#career-goals"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
                >
                  {reason === 'no-profile' ? 'Set up profile' : 'Set career goals'}
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            <Card
              title="Overall readiness"
              description={`Weighted across the ${readiness.requiredSkillCount} skills this role needs.`}
              action={
                <Badge variant={reading.variant} size="md">
                  {reading.label}
                </Badge>
              }
            >
              <div className="space-y-4">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-slate-600">
                      {careerRole?.title ?? 'Your target role'}
                    </span>
                    <span className="text-2xl font-semibold tabular-nums text-slate-900">
                      {readiness.readinessScore}%
                    </span>
                  </div>
                  <ProgressBar
                    value={readiness.readinessScore}
                    className="mt-2"
                    barClassName={reading.bar}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={readiness.skillGaps.length === 0 ? 'success' : 'outline'}>
                    {readiness.skillGaps.length}{' '}
                    {readiness.skillGaps.length === 1 ? 'gap' : 'gaps'}
                  </Badge>
                  <Badge variant={readiness.strongSkills.length > 0 ? 'primary' : 'outline'}>
                    {readiness.strongSkills.length} at target
                  </Badge>
                  <Badge variant="outline">
                    {readiness.measuredSkillCount} of {readiness.requiredSkillCount} on your profile
                  </Badge>
                </div>

                {/* Said plainly, because a low score with unmeasured skills is
                    usually a missing assessment rather than a missing ability —
                    and a student should be told which one they are looking at. */}
                {readiness.measuredSkillCount < readiness.requiredSkillCount ? (
                  <Alert
                    variant="info"
                    title="Some of these skills have never been measured"
                    message="A skill that is not on your profile counts as zero, which is honest but harsh. An assessment is the fastest way to replace those zeros with real numbers."
                  >
                    <div className="mt-3">
                      <Link
                        to="/student/assessment"
                        className="text-sm font-medium text-primary-700 hover:text-primary-800"
                      >
                        Take an assessment →
                      </Link>
                    </div>
                  </Alert>
                ) : null}

                <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                  Each skill counts in proportion to how much the role depends on it, and being
                  above what a role asks does not earn extra credit — so this score cannot be
                  lifted by one strong skill covering for a missing one.
                </p>
              </div>
            </Card>

            <Card
              title="Close these first"
              description={
                readiness.skillGaps.length > 0
                  ? 'Ordered by how much each one would move your readiness, not by how big it is.'
                  : undefined
              }
            >
              {readiness.skillGaps.length === 0 ? (
                <EmptyState
                  title="No gaps against this role"
                  description="Every skill it asks for is at or above the level required. Aiming at a more senior role will give you a sharper picture."
                />
              ) : (
                <div className="space-y-2.5">
                  {readiness.skillGaps.map((row) => (
                    <GapRow key={row.skillId} row={row} />
                  ))}
                </div>
              )}
            </Card>

            {/* Directly after the gaps, because it is the answer to them: the
                list above says what is missing, this one says what to do. */}
            <RecommendedLearning
              recommendations={recommendations}
              isLoading={isLoadingRecommendations}
              roleTitle={careerRole?.title}
              action={
                /* Step 8: the card says which skills to learn, the hub says where.
                   Repointed from /student/opportunities, which the button row at the
                   bottom of this page still links to — nothing is lost, and the link
                   next to the suggestions now continues the gap instead of leaving it. */
                <Link
                  to="/student/learning"
                  className="text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  Find programs for these gaps →
                </Link>
              }
            />

            <Card
              title="Already at the level"
              description={
                readiness.strongSkills.length > 0
                  ? 'These meet or beat what the role asks for.'
                  : undefined
              }
            >
              {readiness.strongSkills.length === 0 ? (
                <EmptyState
                  title="Nothing at target yet"
                  description="This is the normal starting point. The first skill to reach its target is usually the one at the top of the list above."
                />
              ) : (
                <div>
                  {readiness.strongSkills.map((row) => (
                    <StrengthRow key={row.skillId} row={row} />
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/student/assessment"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                >
                  Take an assessment
                </Link>
                <Link
                  to="/student/opportunities"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Browse opportunities
                </Link>
                <Link
                  to="/student/profile#skills"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Update your skills
                </Link>
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
