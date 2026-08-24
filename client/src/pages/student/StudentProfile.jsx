/**
 * Student profile page — /student/profile.
 *
 * STUDENT only. The route guard keeps other roles from landing here, and every
 * endpoint this page calls independently requires `authenticate` plus
 * `allowRoles(ROLES.STUDENT)` on the server. The guard is the courtesy; the API
 * is the boundary.
 *
 * Three states, in the order a student meets them:
 *
 *   loading   the stored token is being used to fetch the profile
 *   first run no profile exists yet, so only the details form is shown
 *   editing   profile exists: completion, details, career goals and skills
 *
 * Career goals and skills are deliberately hidden until a profile exists,
 * because both write to a profile that has to be there first. Showing them
 * disabled would only invite clicks that cannot work.
 */

import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

import useStudentProfile from '../../hooks/useStudentProfile.js';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import CareerGoalsSection from '../../components/profile/CareerGoalsSection.jsx';
import ProfileCompletionCard from '../../components/profile/ProfileCompletionCard.jsx';
import ProfileForm from '../../components/profile/ProfileForm.jsx';
import SkillsSection from '../../components/profile/SkillsSection.jsx';

export default function StudentProfile() {
  const {
    profile,
    isFirstVisit,
    isLoading,
    loadError,
    reload,
    isSaving,
    saveError,
    fieldErrors,
    successMessage,
    clearFeedback,
    create,
    save,
    saveCareerGoals,
    addSkill,
    updateSkill,
    removeSkill,
  } = useStudentProfile();

  /**
   * Honours #career-goals and #skills from the dashboard's quick links.
   *
   * React Router does not scroll to a hash on its own, and the target section
   * does not exist until the profile has loaded — so this waits for the load
   * rather than running on mount, when the element would still be absent.
   */
  const { hash } = useLocation();
  const hasProfileLoaded = Boolean(profile);

  useEffect(() => {
    if (!hash || !hasProfileLoaded) return;

    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, hasProfileLoaded]);

  /** One handler for both create and edit — the form decides which it is. */
  const handleProfileSubmit = async (payload, { isCreate }) => {
    try {
      if (isCreate) await create(payload);
      else await save(payload);
    } catch {
      // The banner below renders the error; swallowing here keeps an unhandled
      // rejection out of the console for a failure that is already on screen.
    }
  };

  const backLink = (
    <Link
      to="/student"
      className="inline-flex items-center gap-1.5 text-sm text-primary-700 transition hover:text-primary-800"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back to dashboard
    </Link>
  );

  // --- loading -------------------------------------------------------------
  if (isLoading) {
    return (
      <DashboardLayout title="Your profile" subtitle="Loading your details…">
        <Card>
          <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
            <Spinner />
            Loading your profile…
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  // --- the profile could not be fetched ------------------------------------
  if (loadError) {
    return (
      <DashboardLayout title="Your profile" subtitle="We could not load your profile.">
        <div className="space-y-4">
          <Alert
            variant="error"
            title="Could not load your profile"
            message={loadError.message}
            errors={loadError.errors}
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={reload}>Try again</Button>
            {backLink}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Your profile"
      subtitle={
        isFirstVisit
          ? 'Set up your profile so the portal can work out which skills and opportunities matter to you.'
          : 'Keep your details, career goals and skills up to date.'
      }
    >
      <div className="space-y-5">
        <div>{backLink}</div>

        {/* Feedback sits above everything so a confirmation or an error is seen
            without scrolling, whichever section produced it. */}
        {successMessage ? (
          <Alert variant="success" title={successMessage}>
            <button
              type="button"
              onClick={clearFeedback}
              className="mt-2 text-xs font-medium text-success-700 underline"
            >
              Dismiss
            </button>
          </Alert>
        ) : null}

        {saveError ? (
          <Alert
            variant="error"
            title={saveError.status === 409 ? 'Already there' : 'That did not save'}
            message={saveError.message}
            errors={saveError.errors}
          />
        ) : null}

        {isFirstVisit ? (
          <Card
            title="Create your profile"
            description="Everything here is optional and editable later — fill in what you know now."
          >
            <ProfileForm
              profile={null}
              isSaving={isSaving}
              serverFieldErrors={fieldErrors}
              onSubmit={handleProfileSubmit}
            />
          </Card>
        ) : (
          <>
            <ProfileCompletionCard profile={profile} />

            <Card title="Your details" description="Who you are and where you study.">
              <ProfileForm
                profile={profile}
                isSaving={isSaving}
                serverFieldErrors={fieldErrors}
                onSubmit={handleProfileSubmit}
              />
            </Card>

            <CareerGoalsSection profile={profile} isSaving={isSaving} onSave={saveCareerGoals} />

            <SkillsSection
              profile={profile}
              isSaving={isSaving}
              onAdd={addSkill}
              onUpdateLevel={updateSkill}
              onRemove={removeSkill}
            />

            {/* States plainly what this data is for, so the levels do not look
                like they have already been scored or verified. */}
            <p className="px-1 text-xs text-slate-500">
              Skill levels here are self-reported. Assessments, skill gap analysis and opportunity
              matching are later steps — this profile is the data they will build on.
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
