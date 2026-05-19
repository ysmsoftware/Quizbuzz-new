'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contestService } from '@/lib/services';
import { ContestCard } from './contest-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, X, Trophy } from 'lucide-react';

export function ContestGrid() {
  const [search, setSearch] = useState('');

  const hasFilters = !!search;

  const { data, isLoading, error } = useQuery({
    queryKey: ['contests', search],
    queryFn: () =>
      contestService.getContests(search ? { search } : undefined),
  });

  const clearFilters = () => {
    setSearch('');
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters}>
            <X className="h-4 w-4" />
            <span className="sr-only">Clear filters</span>
          </Button>
        )}
      </div>

      {/* Active filters */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {search && (
            <Badge variant="secondary" className="gap-1">
              Search: {search}
              <button onClick={() => setSearch('')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : error || !data?.success ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load contests. Please try again.</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : data.data?.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No contests found</h3>
          <p className="text-muted-foreground mt-1">
            Try adjusting your search term
          </p>
          {hasFilters && (
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Showing {data?.data?.length ?? 0} contest{(data?.data?.length ?? 0) !== 1 ? 's' : ''}
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data?.data?.map((contest) => (
              <ContestCard key={contest.id} contest={contest} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
