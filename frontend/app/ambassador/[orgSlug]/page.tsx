import { redirect } from 'next/navigation';

// The ambassador program is now platform-level, not organization-scoped — old shared links
// to /ambassador/{orgSlug} redirect to the generic landing page instead of 404ing.
export default function LegacyOrgAmbassadorLandingRedirect() {
  redirect('/ambassador');
}
