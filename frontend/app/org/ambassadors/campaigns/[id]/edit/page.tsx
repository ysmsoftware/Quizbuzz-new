'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

/** Superseded by the campaign management dashboard (Phase 2) — this single-page form used to
 *  be the only way to edit a campaign after creation, with no awareness of what should still
 *  be editable once a campaign is live. Kept as a redirect so old links/bookmarks still land
 *  somewhere sensible instead of 404ing. */
export default function EditAmbassadorCampaignRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/org/ambassadors/campaigns/${id}`);
  }, [id, router]);

  return <Skeleton className="h-96 w-full rounded-xl" />;
}
