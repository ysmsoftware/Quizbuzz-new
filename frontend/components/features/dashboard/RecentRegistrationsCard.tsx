'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNowStrict } from 'date-fns';
import { UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentRegistrations } from '@/lib/hooks/useDashboard';
import { DashboardWidgetError } from './dashboard-shared';

function initials(firstName: string, lastName: string | null): string {
  const a = firstName?.[0] ?? '';
  const b = lastName?.[0] ?? '';
  return (a + b).toUpperCase() || '?';
}

export function RecentRegistrationsCard({ orgId }: { orgId: string }) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useRecentRegistrations(orgId, {
    limit: 5,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const registrations = data?.data.data ?? [];

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Recent registrations</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <DashboardWidgetError message="Couldn't load recent registrations." onRetry={() => refetch()} />
        ) : registrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <UserPlus className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No registrations yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {registrations.map((reg) => (
              <button
                key={reg.id}
                type="button"
                onClick={() => router.push(`/org/contests/${reg.contest.id}/registrations`)}
                className="w-full flex items-center gap-3 text-left rounded-lg hover:bg-secondary/40 transition-colors p-1.5 -m-1.5"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {initials(reg.contact.firstName, reg.contact.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {reg.contact.firstName} {reg.contact.lastName ?? ''}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{reg.contest.title}</p>
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDistanceToNowStrict(new Date(reg.createdAt), { addSuffix: true })}
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
