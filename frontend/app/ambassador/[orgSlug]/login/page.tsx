import { redirect } from 'next/navigation';

// Login is now platform-level, not org-scoped — see /ambassador/login.
export default function LegacyOrgAmbassadorLoginRedirect() {
  redirect('/ambassador/login');
}
