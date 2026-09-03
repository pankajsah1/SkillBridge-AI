/**
 * Route table.
 *
 * Grouped by access level so the answer to "who can reach this?" is visible in
 * the structure rather than buried in each page:
 *
 *   - public          /status
 *   - public only     /login, /register          (redirect away if signed in)
 *   - authenticated   /unauthorized              (any logged-in role)
 *   - role gated      /student … /admin          (exactly one role each)
 *
 * Again: these guards are navigation, not security. The backend re-checks the
 * token and the role on every single request.
 */

import { Navigate, Route, Routes } from 'react-router-dom';

import { ROLES, homePathForRole } from '../constants/roles.js';
import { useAuth } from '../context/AuthContext.jsx';
import { FullPageLoader } from '../components/ui/Spinner.jsx';
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from './guards.jsx';

import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import SystemStatus from '../pages/SystemStatus.jsx';
import Unauthorized from '../pages/Unauthorized.jsx';
import NotFound from '../pages/NotFound.jsx';

import StudentDashboard from '../pages/dashboards/StudentDashboard.jsx';
import StudentProfile from '../pages/student/StudentProfile.jsx';
import StudentPortfolio from '../pages/student/StudentPortfolio.jsx';
import BrowseOpportunities from '../pages/student/BrowseOpportunities.jsx';
import OpportunityDetails from '../pages/student/OpportunityDetails.jsx';
import StartAssessment from '../pages/student/StartAssessment.jsx';
import TakeAssessment from '../pages/student/TakeAssessment.jsx';
import AssessmentResult from '../pages/student/AssessmentResult.jsx';
import CareerReadiness from '../pages/student/CareerReadiness.jsx';
import MatchedOpportunities from '../pages/student/MatchedOpportunities.jsx';
import MyApplications from '../pages/student/MyApplications.jsx';
import LearningHub from '../pages/student/LearningHub.jsx';
import LearningProgramDetails from '../pages/student/LearningProgramDetails.jsx';
import MyLearning from '../pages/student/MyLearning.jsx';
import IndustryDashboard from '../pages/dashboards/IndustryDashboard.jsx';
import MyOpportunities from '../pages/industry/MyOpportunities.jsx';
import OpportunityApplicants from '../pages/industry/OpportunityApplicants.jsx';
import OpportunityFormPage from '../pages/industry/OpportunityFormPage.jsx';
import MyLearningPrograms from '../pages/industry/MyLearningPrograms.jsx';
import LearningProgramFormPage from '../pages/industry/LearningProgramFormPage.jsx';
import AcademicianDashboard from '../pages/dashboards/AcademicianDashboard.jsx';
import AcademicianProfile from '../pages/academician/AcademicianProfile.jsx';
import AcademicianOpportunities from '../pages/academician/AcademicianOpportunities.jsx';
import AcademicianOpportunityDetails from '../pages/academician/AcademicianOpportunityDetails.jsx';
import AcademicianApplications from '../pages/academician/AcademicianApplications.jsx';
import AcademicianMatches from '../pages/academician/AcademicianMatches.jsx';
import InstitutionDashboard from '../pages/dashboards/InstitutionDashboard.jsx';
import AdminDashboard from '../pages/dashboards/AdminDashboard.jsx';

/**
 * "/" has no page of its own — it forwards to wherever this visitor belongs.
 *
 * Waits on isInitialising so a refresh at the root does not flash the login page
 * before the stored token has been checked.
 */
function RootRedirect() {
  const { isAuthenticated, isInitialising, role } = useAuth();

  if (isInitialising) return <FullPageLoader message="Restoring your session…" />;

  return <Navigate to={isAuthenticated ? homePathForRole(role) : '/login'} replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      {/* Public: exposes service health only, no user data. */}
      <Route path="/status" element={<SystemStatus />} />

      {/* Public only: a signed-in user gets bounced to their dashboard. */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Any authenticated role. */}
      <Route element={<ProtectedRoute />}>
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Route>

      {/* One role each. Listing a single role per group is what stops a student
          from rendering the industry dashboard. */}
      <Route element={<RoleRoute allowedRoles={[ROLES.STUDENT]} />}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/profile" element={<StudentProfile />} />

        {/* The portfolio is its own surface because it is a presentation of the
            profile, not an editor for it: it reads the skills, goals and summary
            from /student/profile's data and adds the proof — resume, projects,
            certifications, experience, achievements — that the profile form does
            not ask for. */}
        <Route path="/student/portfolio" element={<StudentPortfolio />} />
        {/* Discovery is student-scoped rather than a route both roles share.
            A shared detail page would put a "Back to opportunities" link in front
            of an industry user that lands them on /unauthorized — so the employer
            reaches their own postings through /industry/opportunities instead. */}
        <Route path="/student/opportunities" element={<BrowseOpportunities />} />
        <Route path="/student/opportunities/:id" element={<OpportunityDetails />} />

        {/* Assessment is three pages because it is three decisions: what to be
            assessed on, answering, and reading the result. `/result` is listed
            after the bare :assessmentId route but cannot collide with it — the
            extra segment is what distinguishes them. */}
        <Route path="/student/assessment" element={<StartAssessment />} />
        <Route path="/student/assessment/:assessmentId" element={<TakeAssessment />} />
        <Route path="/student/assessment/:assessmentId/result" element={<AssessmentResult />} />

        {/* Readiness reads the profile and one career role, so it needs no id of
            its own — the role to compare against is a query param on the API,
            not a route segment, because switching it is a filter rather than
            navigation to a different thing. */}
        <Route path="/student/readiness" element={<CareerReadiness />} />

        {/* Matches is a separate route from /student/opportunities rather than a
            sort option on it, because the two are different questions: browse is
            "what exists", this is "what fits me". A student who wants the ranked
            answer should be able to link straight to it. */}
        <Route path="/student/matches" element={<MatchedOpportunities />} />

        {/* Applications is a list of the student's own rows, so it needs no id —
            the token scopes it on the server. A single application has no route
            of its own: the timeline it would show is already inline on this list
            and on the opportunity page, and a third place to render it would be a
            third place for it to drift. */}
        <Route path="/student/applications" element={<MyApplications />} />

        {/* Learning is discovery, one programme, and the student's own enrolments —
            the same three-surface shape as opportunities, and student-scoped for the
            same reason: an industry user following a "Back to the learning hub" link
            would land on /unauthorized. Publishers reach their own programmes through
            /industry/learning-programs instead.

            My Learning is its own route rather than a tab on the hub because "what
            should I learn?" and "what am I learning?" are different questions, and the
            second one is where progress is reported. */}
        <Route path="/student/learning" element={<LearningHub />} />
        <Route path="/student/learning/:programId" element={<LearningProgramDetails />} />
        <Route path="/student/my-learning" element={<MyLearning />} />
      </Route>

      <Route element={<RoleRoute allowedRoles={[ROLES.INDUSTRY]} />}>
        <Route path="/industry" element={<IndustryDashboard />} />
        <Route path="/industry/opportunities" element={<MyOpportunities />} />
        {/* One page, two routes: the presence of :id is what makes it an edit.
            `new` is listed first so it can never be read as an id. */}
        <Route path="/industry/opportunities/new" element={<OpportunityFormPage />} />
        <Route path="/industry/opportunities/:id/edit" element={<OpportunityFormPage />} />

        {/* Applicants hangs off the posting because that is what it is a list of.
            No route for a single applicant: the card already shows everything the
            detail page would, and the decision buttons belong next to the ranking
            they are being made from. */}
        <Route
          path="/industry/opportunities/:id/applications"
          element={<OpportunityApplicants />}
        />

        {/* Learning programmes are published by ROLES.INDUSTRY — the role that already
            posts opportunities — so their management lives in this group and nowhere
            else. No new role and no new permission system: the server's
            allowRoles(ROLES.INDUSTRY) on POST/PATCH/DELETE is the same gate.

            `new` before `:programId/edit` for the reason the opportunity routes give:
            it can never be read as an id. */}
        <Route path="/industry/learning-programs" element={<MyLearningPrograms />} />
        <Route path="/industry/learning-programs/new" element={<LearningProgramFormPage />} />
        <Route
          path="/industry/learning-programs/:programId/edit"
          element={<LearningProgramFormPage />}
        />
      </Route>

      <Route element={<RoleRoute allowedRoles={[ROLES.ACADEMICIAN]} />}>
        <Route path="/academician" element={<AcademicianDashboard />} />
        <Route path="/academician/profile" element={<AcademicianProfile />} />
        {/* Discovery is academician-scoped for the same reason student discovery is:
            a shared detail page would give "Back to opportunities" links that land
            industry users on /unauthorized. The API endpoint is the same
            GET /opportunities for both — it scopes by req.user.role. */}
        <Route path="/academician/opportunities" element={<AcademicianOpportunities />} />
        <Route path="/academician/opportunities/:id" element={<AcademicianOpportunityDetails />} />
        {/* Matches is the academician's ranked list — opportunities scored against
            their expertise. Separate from /opportunities for the same reason the
            student version is: browse is "what exists", this is "what fits me". */}
        <Route path="/academician/matches" element={<AcademicianMatches />} />
        {/* Applications is the academician's own submissions, scoped by token on the
            server. Uses the same GET /applications endpoint students call. */}
        <Route path="/academician/applications" element={<AcademicianApplications />} />
      </Route>

      <Route element={<RoleRoute allowedRoles={[ROLES.INSTITUTION]} />}>
        <Route path="/institution" element={<InstitutionDashboard />} />
      </Route>

      <Route element={<RoleRoute allowedRoles={[ROLES.ADMIN]} />}>
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
