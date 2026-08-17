import { redirect } from 'next/navigation';

// Applying is now a platform-level signup, not org-scoped — see /ambassador/signup.
export default function LegacyOrgAmbassadorApplyRedirect() {
  redirect('/ambassador/signup');
}
