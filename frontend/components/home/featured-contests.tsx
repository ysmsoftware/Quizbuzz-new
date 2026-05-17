'use client';

import { useQuery } from '@tanstack/react-query';
import { contestService } from '@/lib/services';
import { ContestCard } from '@/components/contests/contest-card';
import { Skeleton } from '@/components/ui/skeleton';

export function FeaturedContests() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['featured-contests'],
    queryFn: () => contestService.getFeaturedContests(3),
  });

  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load featured contests. Please try again later.
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {data.data?.map((contest) => (
        <ContestCard key={contest.id} contest={contest} />
      ))}
    </div>
  );
}
