'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function SubmissionDetailPage() {
  const router = useRouter();
  const { id: contestId, subId } = useParams() as { id: string; subId: string };

  useEffect(() => {
    // Redirect to the submissions list page with the subId query parameter to trigger the modal
    router.replace(`/admin/contests/${contestId}/submissions?subId=${subId}`);
  }, [contestId, subId, router]);

  return (
    <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
      <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-muted-foreground animate-pulse font-medium">Redirecting to submissions list...</p>
    </div>
  );
}
