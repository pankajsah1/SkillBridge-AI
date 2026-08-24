/**
 * Student dashboard — placeholder.
 *
 * Reachable only by STUDENT. The route guard enforces that in the UI; the
 * backend will enforce it on every student endpoint added later.
 */

import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import DashboardPlaceholder from '../../components/dashboard/DashboardPlaceholder.jsx';

const UPCOMING = [
  'Skill assessment and your skill profile',
  'Gap analysis against the career roles you want',
  'Matched internships and jobs',
  'Recommended learning programmes',
  'Your verified digital portfolio',
];

export default function StudentDashboard() {
  return (
    <DashboardLayout
      title="Student dashboard"
      subtitle="Assess your skills, close the gaps, and get matched to opportunities."
    >
      <DashboardPlaceholder upcoming={UPCOMING} />
    </DashboardLayout>
  );
}
