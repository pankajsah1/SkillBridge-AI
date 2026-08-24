/**
 * Industry dashboard — placeholder.
 *
 * Reachable only by INDUSTRY.
 */

import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import DashboardPlaceholder from '../../components/dashboard/DashboardPlaceholder.jsx';

const UPCOMING = [
  'Post internships and job openings',
  'Define the skills each role actually requires',
  'Matched candidates ranked by verified skill fit',
  'Application tracking and shortlisting',
  'Collaboration requests to institutions',
];

export default function IndustryDashboard() {
  return (
    <DashboardLayout
      title="Industry dashboard"
      subtitle="Post opportunities and find candidates whose skills you can verify."
    >
      <DashboardPlaceholder upcoming={UPCOMING} />
    </DashboardLayout>
  );
}
