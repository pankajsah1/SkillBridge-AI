/**
 * The front door to an assessment: pick what to be assessed on, then start.
 *
 * WHY THIS PAGE EXISTS AT ALL RATHER THAN A BUTTON ON THE DASHBOARD. The paper
 * is built from a career role — the role's required skills, weighted, are what
 * decide which questions get asked — so the choice has to happen before the
 * first question, not after. A student with no career goal set can still start:
 * the server falls back to a broad ten-skill pool.
 *
 * THE PRIORITY-1 GOAL IS PRESELECTED, NOT IMPOSED. Omitting `careerRoleId`
 * entirely makes the server choose that same goal, so preselecting it changes
 * nothing about the default — it just makes the default visible, and lets a
 * student assess themselves against their second choice without editing their
 * profile first.
 *
 * NO "RESUME OR START FRESH" FORK HERE. POST /assessments returns the open
 * attempt when there is one instead of creating a second, so this page always
 * just starts; the take page is where a resumed paper announces itself. One
 * fewer request on load, and no way to lose half-finished answers by clicking
 * the wrong branch.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { startAssessment } from '../../api/assessment.api.js';
import { fetchCareerRoles } from '../../api/catalogue.api.js';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import Select from '../../components/ui/Select.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import useStudentProfile from '../../hooks/useStudentProfile.js';

/** What the student is about to do, in the order it happens. */
const STEPS = [
  'Ten multiple-choice questions, spread across the skills the role needs',
  'Every option scores something — the best answer scores most, a weak one still counts',
  'Move back and forth freely, then submit when you are done',
  'Your skill scores are saved to your profile as verified levels',
];

export default function StartAssessment() {
  const navigate = useNavigate();
  const { profile, isLoading: isLoadingProfile } = useStudentProfile();

  const [roles, setRoles] = useState([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [rolesError, setRolesError] = useState(null);

  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [hasChosen, setHasChosen] = useState(false);

  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState(null);

  useEffect(() => {
    let isActive = true;

    (async () => {
      setIsLoadingRoles(true);
      setRolesError(null);
      try {
        const loaded = await fetchCareerRoles();
        if (isActive) setRoles(loaded);
      } catch (error) {
        if (isActive) setRolesError(error);
      } finally {
        if (isActive) setIsLoadingRoles(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  /** The student's own goals, best first — priority 1 is their primary target. */
  const goals = useMemo(
    () => [...(profile?.targetRoles ?? [])].sort((a, b) => a.priority - b.priority),
    [profile?.targetRoles],
  );

  /**
   * Seeds the dropdown from the primary goal once, and only until the student
   * touches it. Without the `hasChosen` guard a late-arriving profile would yank
   * the selection back to the goal after they had picked something else.
   */
  useEffect(() => {
    if (hasChosen || selectedRoleId || goals.length === 0) return;
    setSelectedRoleId(goals[0].roleId);
  }, [goals, hasChosen, selectedRoleId]);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const isLoading = isLoadingProfile || isLoadingRoles;

  const handleStart = async () => {
    setIsStarting(true);
    setStartError(null);

    try {
      const paper = await startAssessment(
        selectedRoleId ? { careerRoleId: selectedRoleId } : {},
      );
      // `resumed` is only on the POST response — a later GET of the same attempt
      // cannot tell whether it was just created — so it travels in router state
      // for the take page to announce.
      navigate(`/student/assessment/${paper.id}`, { state: { resumed: paper.resumed } });
    } catch (error) {
      setStartError(error);
      setIsStarting(false);
    }
    // No setIsStarting(false) on success: this component unmounts on navigate,
    // and setting state afterwards is a warning with no upside.
  };

  return (
    <DashboardLayout
      title="Skill assessment"
      subtitle="Find out where you actually stand against the role you want."
    >
      <div className="space-y-5">
        <BackLink to="/student">Back to dashboard</BackLink>

        {rolesError ? (
          <Alert
            variant="warning"
            title="Could not load the career roles"
            message={`${rolesError.message} You can still start a broad assessment covering common skills.`}
          />
        ) : null}

        {startError ? (
          <Alert
            variant="error"
            title="Could not start the assessment"
            message={startError.message}
            errors={startError.errors ?? []}
          />
        ) : null}

        <Card
          title="What you are being assessed on"
          description="The role decides which skills the questions cover."
        >
          {isLoading ? (
            <div className="flex items-center gap-2.5 py-1 text-sm text-slate-500">
              <Spinner size="sm" />
              Loading career roles…
            </div>
          ) : (
            <div className="space-y-5">
              {goals.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Your career goals
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {goals.map((goal) => (
                      <button
                        key={goal.roleId}
                        type="button"
                        onClick={() => {
                          setSelectedRoleId(goal.roleId);
                          setHasChosen(true);
                        }}
                        className={[
                          'rounded-lg border px-3 py-2 text-left text-sm transition',
                          goal.roleId === selectedRoleId
                            ? 'border-primary-400 bg-primary-50 text-primary-800'
                            : 'border-slate-200 text-slate-700 hover:border-primary-300 hover:bg-primary-50/40',
                        ].join(' ')}
                      >
                        <span className="font-medium">{goal.title ?? 'Career goal'}</span>
                        {goal.priority === 1 ? (
                          <Badge variant="primary" size="sm" className="ml-2">
                            Primary
                          </Badge>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <Alert
                  variant="info"
                  title="You have not set a career goal yet"
                  message="Pick a role below for this assessment, or set your goals on your profile so the portal can keep using them."
                >
                  <div className="mt-3">
                    <Link
                      to="/student/profile#career-goals"
                      className="text-sm font-medium text-primary-700 hover:text-primary-800"
                    >
                      Set career goals →
                    </Link>
                  </div>
                </Alert>
              )}

              <Select
                label="Assess me for this role"
                name="careerRoleId"
                value={selectedRoleId}
                onChange={(event) => {
                  setSelectedRoleId(event.target.value);
                  setHasChosen(true);
                }}
                options={roles.map((role) => ({ value: role.id, label: role.title }))}
                placeholder="A broad mix of common skills"
                hint={
                  selectedRole
                    ? `Questions will cover the skills a ${selectedRole.title} is expected to have.`
                    : 'Without a role, the questions cover ten widely used technical and workplace skills.'
                }
              />
            </div>
          )}
        </Card>

        <Card title="How it works">
          <ol className="space-y-2.5">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-slate-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          {/* Said before they start, not after they lose work. */}
          <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
            Your answers are kept in this tab until you submit, so finish the paper in one sitting.
            If you leave, the attempt stays open and you can pick it up again from here.
          </p>

          <div className="mt-5">
            <Button size="lg" onClick={handleStart} isLoading={isStarting} disabled={isLoading}>
              {isStarting ? 'Preparing your questions…' : 'Start assessment'}
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
