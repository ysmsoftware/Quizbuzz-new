'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Show "X–Y of Z records" label */
  showCount?: boolean;
}

/**
 * Renders up to 7 page buttons with ellipsis collapsing for large page counts.
 * Always shows first/last page buttons.
 */
export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  className,
  showCount = true,
}: PaginationBarProps) {
  if (totalPages <= 0) return null;

  // Build the list of page numbers to display
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];

    if (page <= 4) {
      // Near start: 1 2 3 4 5 … last
      for (let i = 1; i <= Math.min(5, totalPages); i++) pages.push(i);
      if (totalPages > 6) pages.push('ellipsis');
      pages.push(totalPages);
    } else if (page >= totalPages - 3) {
      // Near end: 1 … (last-4) (last-3) (last-2) (last-1) last
      pages.push(1);
      pages.push('ellipsis');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      // Middle: 1 … (page-1) page (page+1) … last
      pages.push(1);
      pages.push('ellipsis');
      for (let i = page - 1; i <= page + 1; i++) pages.push(i);
      pages.push('ellipsis');
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  const startRecord = total && pageSize ? (page - 1) * pageSize + 1 : null;
  const endRecord = total && pageSize ? Math.min(page * pageSize, total) : null;

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-4', className)}>
      {/* Record count */}
      {showCount && total !== undefined && (
        <p className="text-sm text-muted-foreground font-medium shrink-0">
          {startRecord && endRecord ? (
            <>
              Showing{' '}
              <span className="text-foreground font-semibold">{startRecord}–{endRecord}</span>
              {' '}of{' '}
              <span className="text-foreground font-semibold">{total.toLocaleString()}</span>{' '}
              records
            </>
          ) : (
            <>
              <span className="text-foreground font-semibold">{total.toLocaleString()}</span> records
            </>
          )}
        </p>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl hidden sm:flex"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          aria-label="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous */}
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-xl px-3 border-border/50"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Prev</span>
        </Button>

        {/* Numbered pages */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) =>
            p === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1.5 text-muted-foreground text-sm select-none"
              >
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? 'default' : 'ghost'}
                size="icon"
                className={cn(
                  'h-9 w-9 rounded-xl text-sm font-semibold',
                  p === page
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => onPageChange(p as number)}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </Button>
            )
          )}
        </div>

        {/* Next */}
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-xl px-3 border-border/50"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>

        {/* Last page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl hidden sm:flex"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          aria-label="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
