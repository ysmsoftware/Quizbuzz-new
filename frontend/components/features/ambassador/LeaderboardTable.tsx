'use client';

import { Trophy } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LeaderboardEntryResult, LeaderboardScope } from '@/lib/types/ambassador';
import { Rupees } from './Rupees';
import { GoodieHoverCard } from './GoodieHoverCard';

// On phones the list is trimmed to the top few plus the viewer's own row (desktop shows all rows).
const MOBILE_TOP_COUNT = 4;

const RANK_COLOR: Record<number, string> = {
  1: 'text-warning',
  2: 'text-muted-foreground',
  3: 'text-secondary-foreground',
};

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
    <div className="w-full min-w-0 rounded-lg border border-border/60 overflow-hidden bg-card">
      <div className="max-h-[235px] overflow-y-auto overflow-x-hidden scrollbar-thin">
        <Table className="w-full table-fixed sm:table-auto text-xs sm:text-sm">
          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-xs z-10 border-b border-border/60">
            <TableRow className="hover:bg-transparent border-b-border/60">
              <TableHead className="w-11 sm:w-14 px-2 sm:px-2.5 py-2 font-bold text-foreground text-xs sm:text-sm">Rank</TableHead>
              <TableHead className="px-2 sm:px-2.5 py-2 font-bold text-foreground text-xs sm:text-sm min-w-0 truncate">{label}</TableHead>
              <TableHead className="w-12 sm:w-28 px-2 sm:px-2.5 py-2 text-right font-bold text-foreground text-xs sm:text-sm whitespace-nowrap">
                <span className="sm:hidden">Regs</span>
                <span className="hidden sm:inline">Registrations</span>
              </TableHead>
              <TableHead className="w-[4.5rem] sm:w-28 px-2 sm:px-2.5 py-2 text-right font-bold text-foreground text-xs sm:text-sm whitespace-nowrap">Prize</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const isYou = scope.kind === 'INDIVIDUAL_AMBASSADOR' && row.groupKey === currentAmbassadorId;
              const goodie = row.prize && !row.prize.cashAmount ? row.prize.goodie : undefined;
              const tableRow = (
                <TableRow key={row.groupKey} className={cn(isYou && 'bg-primary/10 font-semibold', goodie && 'cursor-default', index >= MOBILE_TOP_COUNT && !isYou && 'max-sm:hidden')}>
                  <TableCell className={cn('px-2 sm:px-2.5 py-2 font-bold text-xs sm:text-sm', RANK_COLOR[row.rank])}>#{row.rank}</TableCell>
                  <TableCell className="px-2 sm:px-2.5 py-2 text-xs sm:text-sm font-medium min-w-0 truncate sm:max-w-[220px]">
                    <span className="truncate block" title={row.label}>
                      {row.label}
                      {isYou && <span className="ml-1.5 inline-block text-xs text-primary font-bold">(You)</span>}
                    </span>
                  </TableCell>
                  <TableCell className="px-2 sm:px-2.5 py-2 text-right text-xs sm:text-sm font-medium whitespace-nowrap">{row.registrationCount}</TableCell>
                  <TableCell className="px-2 sm:px-2.5 py-2 text-right text-xs sm:text-sm font-medium text-muted-foreground truncate sm:whitespace-nowrap">
                    {row.prize ? (row.prize.cashAmount ? <Rupees amount={row.prize.cashAmount} /> : row.prize.label ?? row.prize.goodie?.label) : '—'}
                  </TableCell>
                </TableRow>
              );
              return goodie ? (
                <GoodieHoverCard key={row.groupKey} goodie={goodie}>{tableRow}</GoodieHoverCard>
              ) : tableRow;
            })}
          </TableBody>
        </Table>
      </div>
      {rows.length > MOBILE_TOP_COUNT && (
        <p className="sm:hidden border-t border-border/60 px-2.5 py-1.5 text-center text-[10px] text-muted-foreground">
          Showing the top {MOBILE_TOP_COUNT} and your position
        </p>
      )}
    </div>
  );
}
