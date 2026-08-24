/**
 * Institution dashboard — placeholder.
 *
 * Reachable only by INSTITUTION.
 */

import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import DashboardPlaceholder from '../../components/dashboard/DashboardPlaceholder.jsx';

const UPCOMING = [
  'Institution-wide skill and readiness analytics',
  'Placement and outcome tracking',
  'Department-level skill gap reporting',
  'Industry collaboration management',
  'Curriculum alignment insights',
];

export default function InstitutionDashboard() {
  return (
    <DashboardLayout
      title="Institution dashboard"
      subtitle="Track readiness and placement outcomes across your cohorts."
    >
      <DashboardPlaceholder upcoming={UPCOMING} />
    </DashboardLayout>
  );
}
