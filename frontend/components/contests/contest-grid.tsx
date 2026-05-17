'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contestService } from '@/lib/services';
import { ContestCard } from './contest-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, X, Trophy } from 'lucide-react';
import type { ContestFilters, DifficultyLevel, ContestStatus } from '@/lib/types';

const difficultyOptions = [
  { value: 'all', label: 'All Difficulties' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'published', label: 'Open for Registration' },
  { value: 'active', label: 'Live Now' },
  { value: 'completed', label: 'Completed' },
];

export function ContestGrid() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');

  const filters: ContestFilters = {
    ...(search && { search }),
    ...(category !== 'all' && { category }),
    ...(difficulty !== 'all' && { difficulty: difficulty as DifficultyLevel }),
    ...(status !== 'all' && { status: status as ContestStatus }),
  };

  const hasFilters = search || category !== 'all' || difficulty !== 'all' || status !== 'all';

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => contestService.getCategories(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['contests', filters],
    queryFn: () => contestService.getContests(Object.keys(filters).length ? filters : undefined),
  });

  const clearFilters = () => {
    setSearch('');
    setCategory('all');
    setDifficulty('all');
    setStatus('all');
  };

  const categories = categoriesData?.data || [];

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

        {/* Filter dropdowns */}
        <div className="flex flex-wrap gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              {difficultyOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters}>
              <X className="h-4 w-4" />
              <span className="sr-only">Clear filters</span>
            </Button>
          )}
        </div>
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
          {category !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {category}
              <button onClick={() => setCategory('all')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {difficulty !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {difficulty}
              <button onClick={() => setDifficulty('all')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {status !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {statusOptions.find(s => s.value === status)?.label}
              <button onClick={() => setStatus('all')}>
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
            Try adjusting your filters or search term
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
