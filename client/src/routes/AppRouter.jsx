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
import IndustryDashboard from '../pages/dashboards/IndustryDashboard.jsx';
import AcademicianDashboard from '../pages/dashboards/AcademicianDashboard.jsx';
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
      </Route>

      <Route element={<RoleRoute allowedRoles={[ROLES.INDUSTRY]} />}>
        <Route path="/industry" element={<IndustryDashboard />} />
      </Route>

      <Route element={<RoleRoute allowedRoles={[ROLES.ACADEMICIAN]} />}>
        <Route path="/academician" element={<AcademicianDashboard />} />
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
