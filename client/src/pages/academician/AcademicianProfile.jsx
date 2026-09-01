/**
 * Academician profile page — /academician/profile.
 *
 * ACADEMICIAN only, like every page in its route group. The guard on the route is
 * navigation; the API is the boundary, and the server re-checks the token and the role
 * on all ~19 endpoints this page can reach.
 *
 * NO ID IS EVER SENT. Every call goes to `/academicians/profile…`, and the server reads
 * the owner from the token — so "academician A edits academician B" is not a check that
 * could be forgotten here, it is a request this page cannot express.
 *
 * ONE SNAPSHOT, NOT MANY. Everything below the header reads from `{profile, completion}`,
 * a pair the hook replaces wholesale from every mutation response. That is what keeps
 * the completion panel agreeing with the lists beside it: both came out of the same
 * response and land in the same state update. Nothing here computes a percentage — the
 * score and the "still missing" list are the server's words, rendered as sent.
 *
 * BUILT FROM PARTS THAT ALREADY EXISTED, which is the point. `SkillsSection` is the
 * student's component unchanged — it reads `profile.skills`, and an academician's
 * skills subdocument is deliberately the same shape. The three list editors are one
 * component driven by ACADEMICIAN_SECTIONS. `PortfolioCompletionPanel` is the
 * portfolio's, parameterised: the completion payload has the same
 * `{completionPercentage, missingSections:[{key,label,weight,action}]}` shape, so only
 * the wording and the destination map are role-specific.
 *
 * THREE STATES, IN THE ORDER AN ACADEMICIAN MEETS THEM: loading, first visit (no
 * profile yet — the details form doubles as the create form, because unlike the student
 * portfolio there is nothing upstream to go and do first), then the full page.
 */

import useAcademicianProfile from '../../hooks/useAcademicianProfile.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ACADEMICIAN_SECTIONS } from '../../constants/academicianSections.js';
import {
  completionBadge,
  completionMessage,
  designationLabel,
} from '../../constants/academicians.js';
import AcademicianDetailsForm from '../../components/academician/AcademicianDetailsForm.jsx';
import AcademicianRecordSection from '../../components/academician/AcademicianRecordSection.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import PortfolioCompletionPanel from '../../components/portfolio/PortfolioCompletionPanel.jsx';
import SkillsSection from '../../components/profile/SkillsSection.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';

/**
 * Server completion key -> where on this page to fix it.
 *
 * The keys are ACADEMICIAN_COMPLETION_SECTIONS', verbatim. Everything an academician
 * can fill in lives on this one page, so every destination is an in-page anchor rather
 * than a route — `#academician-details` is the details card, `#skills` is the reused
 * SkillsSection's own id, and the three list sections are `academician-<section key>`.
 *
 * TWO PAIRS SHARE A DESTINATION, on purpose. `summary`, `position`, `expertise` and
 * `researchInterests` are all fields of the one details form; `experience` and
 * `industryExperience` are both satisfied from the positions list, the second by an
 * entry typed as industry or consultancy. The server's own `action` sentence, rendered
 * beside each link, is what says which of the two is being asked for.
 */
const DESTINATIONS = Object.freeze({
  summary: { to: '#academician-details', label: 'Edit your details', isAnchor: true },
  position: { to: '#academician-details', label: 'Edit your details', isAnchor: true },
  expertise: { to: '#academician-details', label: 'Add areas', isAnchor: true },
  researchInterests: { to: '#academician-details', label: 'Add interests', isAnchor: true },
  skills: { to: '#skills', label: 'Manage skills', isAnchor: true },
  education: { to: '#academician-education', label: 'Add a qualification', isAnchor: true },
  experience: { to: '#academician-experiences', label: 'Add a position', isAnchor: true },
  industryExperience: {
    to: '#academician-experiences',
    label: 'Add industry work',
    isAnchor: true,
  },
  achievements: { to: '#academician-achievements', label: 'Add an achievement', isAnchor: true },
});

/**
 * "Professor · Computer Science · IIT Delhi" from whichever parts exist.
 *
 * Filtered rather than interpolated: a half-filled profile should read "IIT Delhi", not
 * "· · IIT Delhi", and a separator with nothing on one side of it is the classic tell of
 * a template handed an empty field.
 */
const positionLine = (profile) =>
  [
    designationLabel(profile?.designation, profile?.designationOther),
    profile?.department,
    profile?.institutionName,
  ]
    .filter(Boolean)
    .join(' · ');

export default function AcademicianProfile() {
  const { user } = useAuth();
  const controller = useAcademicianProfile();

  const {
    profile,
    completion,
    hasProfile,
    isFirstVisit,
    isLoading,
    loadError,
    reload,
    isSaving,
    saveError,
    fieldErrors,
    successMessage,
    clearFeedback,
    saveProfile,
    addSkill,
    setSkillLevel,
    removeSkill,
  } = controller;

  // --- loading --------------------------------------------------------------
  if (isLoading) {
    return (
      <DashboardLayout title="Your profile" subtitle="Loading your profile…">
        <Card>
          <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
            <Spinner />
            Loading your profile…
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  // --- the profile could not be fetched -------------------------------------
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
            <BackLink to="/academician">Back to dashboard</BackLink>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  /**
   * The form does not care whether this is a POST or a PATCH, and neither does this
   * handler — `saveProfile` picks by whether a profile already exists, in one place.
   *
   * The rejection is swallowed here rather than in the form, mirroring
   * components/profile/ProfileForm.jsx: the banner above and `fieldErrors` under the
   * inputs have already reported it, and an uncaught rejection out of a submit handler
   * would be noise in the console for something the page has handled.
   */
  const handleDetailsSubmit = async (payload) => {
    try {
      await saveProfile(payload);
    } catch {
      /* Reported by the banner; the form keeps what was typed. */
    }
  };

  const badge = completionBadge(completion?.completionPercentage ?? 0);

  return (
    <DashboardLayout
      title="Your profile"
      subtitle={
        hasProfile
          ? 'What an industry partner reads when a collaboration is being matched.'
          : 'Create your profile so collaboration matching has something to read.'
      }
    >
      <div className="space-y-5">
        <BackLink to="/academician">Back to dashboard</BackLink>

        {/* Feedback above everything: whichever section produced it, a confirmation or
            an error is seen without scrolling back up. */}
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
            title="That did not save"
            message={saveError.message}
            errors={saveError.errors}
          />
        ) : null}

        {isFirstVisit ? (
          <Alert
            variant="info"
            title="Start with your position and your expertise"
            message="Fill in as much or as little as you like and press Create profile — skills, qualifications, positions and publications open up once the profile exists. Nothing here is published until you fill it in."
          />
        ) : null}

        {/* Identity strip. Name and email come from the auth context — the User record
            owns them, and this profile deliberately does not duplicate them.

            A plain Card body rather than Card's own header row: with no title to sit
            beside, the completion badge would be alone in a bordered strip above the
            name it belongs to. */}
        {hasProfile ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">
                  {user?.name ?? 'Your profile'}
                </h2>

                {profile?.headline ? (
                  <p className="mt-1 text-sm text-slate-700">{profile.headline}</p>
                ) : null}

                {positionLine(profile) ? (
                  <p className="mt-1 text-sm text-slate-600">{positionLine(profile)}</p>
                ) : null}
              </div>

              <span className="flex shrink-0 items-center gap-3">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="text-sm font-semibold tabular-nums text-slate-900">
                  {completion?.completionPercentage ?? 0}%
                </span>
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {/* Both states are stated, never left to be inferred from a missing
                  badge — an academician who has closed their door should be able to
                  see that the portal knows it. */}
              <Badge variant={profile?.isOpenToCollaboration ? 'success' : 'neutral'} size="sm">
                {profile?.isOpenToCollaboration
                  ? 'Open to collaboration'
                  : 'Not taking on new collaboration'}
              </Badge>

              {profile?.hasIndustryExperience ? (
                <Badge variant="primary" size="sm">
                  Industry experience
                </Badge>
              ) : null}

              {profile?.location ? (
                <span className="text-xs text-slate-500">{profile.location}</span>
              ) : null}
            </div>
          </Card>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card
              id="academician-details"
              title="Your details"
              description="Your position, what you work on, and how you want to be approached."
            >
              <AcademicianDetailsForm
                profile={profile}
                isSaving={isSaving}
                serverFieldErrors={fieldErrors}
                onSubmit={handleDetailsSubmit}
              />
            </Card>

            {/* Everything below the details form needs a profile to attach to: each of
                these sections has its own endpoint under /academicians/profile/…, and
                the server answers a 404 until the profile row exists. Hiding them on a
                first visit is therefore honest rather than tidy — there is genuinely
                nothing to add them to yet. */}
            {hasProfile ? (
              <>
                {/* The student's component, unchanged. It reads `profile.skills`, and
                    an academician's skills subdocument is the same shape by design —
                    which is the whole reason skills are stored that way. */}
                <SkillsSection
                  profile={profile}
                  isSaving={isSaving}
                  onAdd={addSkill}
                  onUpdateLevel={setSkillLevel}
                  onRemove={removeSkill}
                />

                {/* Qualifications, positions and achievements: one component, three
                    configs. The order is ACADEMICIAN_SECTIONS' own, which reads as a
                    career does — where you trained, where you have worked, what came
                    of it. */}
                {ACADEMICIAN_SECTIONS.map((section) => (
                  <AcademicianRecordSection
                    key={section.key}
                    section={section}
                    records={profile?.[section.key] ?? []}
                    controller={controller}
                  />
                ))}
              </>
            ) : null}
          </div>

          {/* Sticky, and `lg:self-start` with it: a grid item stretches to the row
              height by default, and a full-height box has nowhere to stick to. */}
          <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <PortfolioCompletionPanel
              completion={completion}
              id="academician-completion"
              title="Profile completion"
              description="Worked out by the server from what you have filled in — the same number an industry partner's match against you starts from."
              destinations={DESTINATIONS}
              message={completionMessage}
            />

            <Card title="Who sees this">
              <ul className="space-y-2.5 text-sm text-slate-600">
                <li>
                  Companies posting collaborations and faculty programmes, when your
                  expertise is matched against what they are asking for.
                </li>
                <li>
                  Anyone reviewing an application you have sent — your profile travels with
                  it, so a strong profile is worth more than a long cover note.
                </li>
                <li>
                  Nobody else. Your email and password stay on your account and are never
                  part of this profile.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
