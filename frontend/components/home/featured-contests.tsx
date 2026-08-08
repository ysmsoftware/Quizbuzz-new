'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { contestService } from '@/lib/services';
import { ContestCard } from '@/components/contests/contest-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight } from 'lucide-react';

export function FeaturedContests() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['featured-contests'],
    queryFn: () => contestService.getContests({ limit: 3 }),
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
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
        <Trophy className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Could not load featured contests</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The contest list is temporarily unavailable. Try again shortly.
          </p>
        </div>
        <Link href="/contests">
          <Button variant="outline" size="sm" className="gap-1">
            Browse All Contests
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  if (data.data?.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
        <Trophy className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">No contests are open right now</p>
          <p className="mt-1 text-sm text-muted-foreground">
            New contests are published regularly — check back soon.
          </p>
        </div>
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
