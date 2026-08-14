'use client';

import { Trophy } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LeaderboardEntryResult, LeaderboardScope } from '@/lib/types/ambassador';

const RANK_COLOR: Record<number, string> = {
  1: 'text-warning',
  2: 'text-muted-foreground',
  3: 'text-secondary-foreground',
};

function formatPaise(paise: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(paise / 100);
}

interface LeaderboardTableProps {
  scope: LeaderboardScope;
  label: string;
  rows: LeaderboardEntryResult[];
  /** Only meaningful when scope.kind === 'INDIVIDUAL_AMBASSADOR' — groupKey is the ambassador's own id there. */
  currentAmbassadorId?: string;
  isLoading?: boolean;
}

export function LeaderboardTable({ scope, label, rows, currentAmbassadorId, isLoading }: LeaderboardTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <Trophy className="h-5 w-5" />
        </EmptyMedia>
        <EmptyTitle>No rankings yet</EmptyTitle>
        <EmptyDescription>Registrations will populate the {label.toLowerCase()} leaderboard.</EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Rank</TableHead>
            <TableHead>{label}</TableHead>
            <TableHead className="text-right">Registrations</TableHead>
            <TableHead className="text-right">Prize</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isYou = scope.kind === 'INDIVIDUAL_AMBASSADOR' && row.groupKey === currentAmbassadorId;
            return (
              <TableRow key={row.groupKey} className={cn(isYou && 'bg-primary/5 font-medium')}>
                <TableCell className={cn('font-bold', RANK_COLOR[row.rank])}>#{row.rank}</TableCell>
                <TableCell className="truncate max-w-[180px]">
                  {row.label}
                  {isYou && <span className="ml-2 text-xs text-primary font-semibold">You</span>}
                </TableCell>
                <TableCell className="text-right">{row.registrationCount}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {row.prize ? (row.prize.cashAmount ? formatPaise(row.prize.cashAmount) : row.prize.label ?? row.prize.goodie?.label) : '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
