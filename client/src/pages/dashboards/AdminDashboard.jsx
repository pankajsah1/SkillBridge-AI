/**
 * Admin dashboard — placeholder.
 *
 * Reachable only by ADMIN. Note that ADMIN accounts cannot be created through
 * the registration form: the server refuses that role on the public endpoint, so
 * the first administrator has to be promoted directly in the database (or by a
 * seed script in a later step).
 */

import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import DashboardPlaceholder from '../../components/dashboard/DashboardPlaceholder.jsx';

const UPCOMING = [
  'User management across all roles',
  'Verification and approval queues',
  'Platform-wide analytics',
  'Skill and career-role taxonomy management',
  'Content moderation and audit trails',
];

export default function AdminDashboard() {
  return (
    <DashboardLayout
      title="Admin dashboard"
      subtitle="Platform oversight: users, verification and taxonomy."
    >
      <DashboardPlaceholder upcoming={UPCOMING} />
    </DashboardLayout>
  );
}
