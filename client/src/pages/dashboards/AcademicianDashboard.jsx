/**
 * Academician dashboard — placeholder.
 *
 * Reachable only by ACADEMICIAN.
 */

import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import DashboardPlaceholder from '../../components/dashboard/DashboardPlaceholder.jsx';

const UPCOMING = [
  'Create and publish learning programmes',
  'See which skills students are actually short of',
  'Map curriculum against industry skill demand',
  'Mentor and endorse student work',
  'Joint programmes with industry partners',
];

export default function AcademicianDashboard() {
  return (
    <DashboardLayout
      title="Academician dashboard"
      subtitle="Build programmes around the gaps the data actually shows."
    >
      <DashboardPlaceholder upcoming={UPCOMING} />
    </DashboardLayout>
  );
}
