/**
 * Student dashboard.
 *
 * Reachable only by STUDENT. The route guard enforces that in the UI; the
 * backend enforces it again on every student endpoint.
 *
 * Step 3 turns this from a pure placeholder into the way into the profile. It
 * shows how complete the profile is and links to the three things a student can
 * now do — details, career goals, skills — while the account card and the
 * "coming later" list stay exactly as Step 2 left them.
 *
 * The completion number comes from the same GET /students/profile the profile
 * page uses, through the same hook. Nothing is recomputed here.
 */

import { Link } from 'react-router-dom';

import useStudentProfile from '../../hooks/useStudentProfile.js';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import DashboardPlaceholder from '../../components/dashboard/DashboardPlaceholder.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Card from '../../components/ui/Card.jsx';
import ProgressBar from '../../components/ui/ProgressBar.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';

const UPCOMING = [
  'Skill assessments that score what you have added here',
  'Gap analysis against the career roles you want',
  'Matched internships and jobs',
  'Recommended learning programmes',
  'Your verified digital portfolio',
];

/** The three Step 3 destinations. Anchors land on the matching section's id. */
const ACTIONS = [
  {
    to: '/student/profile',
    title: 'Your details',
    description: 'About you, your institution and your interests.',
  },
  {
    to: '/student/profile#career-goals',
    title: 'Career goals',
    description: 'The roles you are working towards.',
  },
  {
    to: '/student/profile#skills',
    title: 'Your skills',
    description: 'What you can do, and how confident you are.',
  },
];

export default function StudentDashboard() {
  const { profile, isFirstVisit, isLoading, loadError } = useStudentProfile();

  const completion = profile?.profileCompletion ?? 0;
  const skillCount = profile?.skills?.length ?? 0;
  const goalCount = profile?.targetRoles?.length ?? 0;

  return (
    <DashboardLayout
      title="Student dashboard"
      subtitle="Assess your skills, close the gaps, and get matched to opportunities."
    >
      <div className="space-y-5">
        {loadError ? (
          <Alert
            variant="warning"
            title="Could not load your profile"
            message={`${loadError.message} Your account details below are unaffected.`}
          />
        ) : null}

        <Card
          title="Your profile"
          description={
            isFirstVisit
              ? 'You have not set up your profile yet.'
              : 'The data every later feature will build on.'
          }
          action={
            <Link
              to="/student/profile"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              {isFirstVisit ? 'Set up profile' : 'Open profile'}
            </Link>
          }
        >
          {isLoading ? (
            <div className="flex items-center gap-2.5 py-1 text-sm text-slate-500">
              <Spinner size="sm" />
              Loading your profile…
            </div>
          ) : isFirstVisit ? (
            <p className="text-sm text-slate-600">
              Setting up your profile takes a minute. It is what lets the portal work out which
              skills and opportunities actually matter to you.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-slate-600">Profile completion</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {completion}%
                  </span>
                </div>
                <ProgressBar
                  value={completion}
                  className="mt-2"
                  barClassName={completion >= 100 ? 'bg-success-500' : 'bg-primary-600'}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={skillCount > 0 ? 'primary' : 'outline'}>
                  {skillCount} {skillCount === 1 ? 'skill' : 'skills'}
                </Badge>
                <Badge variant={goalCount > 0 ? 'primary' : 'outline'}>
                  {goalCount} {goalCount === 1 ? 'career goal' : 'career goals'}
                </Badge>
              </div>
            </div>
          )}

          {/* Shown in every state: these are the three things to do next, and
              they are worth reaching in one click from here. */}
          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
            {ACTIONS.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="rounded-lg border border-slate-200 p-3.5 transition hover:border-primary-300 hover:bg-primary-50/40"
              >
                <span className="block text-sm font-medium text-slate-900">{action.title}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{action.description}</span>
              </Link>
            ))}
          </div>
        </Card>

        <DashboardPlaceholder upcoming={UPCOMING} />
      </div>
    </DashboardLayout>
  );
}
