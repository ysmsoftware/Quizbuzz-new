import { redirect } from 'next/navigation';

// The ambassador dashboard is now cross-organization, not org-scoped — see /ambassador/dashboard.
export default function LegacyOrgAmbassadorDashboardRedirect() {
  redirect('/ambassador/dashboard');
}
