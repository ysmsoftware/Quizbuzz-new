'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function ContestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const contestId = params.id as string;

  useEffect(() => {
    router.replace(`/admin/contests/${contestId}/overview`);
  }, [router, contestId]);

  return null;
}
