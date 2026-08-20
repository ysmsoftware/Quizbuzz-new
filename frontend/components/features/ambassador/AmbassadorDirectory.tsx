'use client';

import { useEffect, useState } from 'react';
import { Search, ChevronDown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { useOrgAmbassadors } from '@/lib/hooks/useOrgAmbassadors';
import { AmbassadorProfileSheet } from './AmbassadorProfileSheet';
import { Rupees } from './Rupees';

const SORT_OPTIONS: { value: 'joinedAt' | 'name' | 'registrations'; label: string }[] = [
  { value: 'joinedAt', label: 'Joined' },
  { value: 'name', label: 'Name' },
  { value: 'registrations', label: 'Registrations' },
];

/**
 * The org-wide ambassador directory (Task 10) — one row per distinct APPROVED person,
 * deduped across every campaign of this org they've joined. Sits on the Directory tab of
 * /org/ambassadors, alongside the existing per-campaign Applications review queue. Clicking
 * a row opens AmbassadorProfileSheet for the full profile.
 */
export function AmbassadorDirectory() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [ambassadorType, setAmbassadorType] = useState<string>('');
  const [sortBy, setSortBy] = useState<'joinedAt' | 'name' | 'registrations'>('joinedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [profileId, setProfileId] = useState<string | null>(null);

  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');
  const typeLabel = (key: string) => types.find((t) => t.key === key)?.label ?? key;

  const { ambassadors, pagination, isLoading } = useOrgAmbassadors({
    q: q || undefined,
    ambassadorType: ambassadorType || undefined,
    sortBy,
    sortOrder,
    page,
    limit: 20,
  });

  useEffect(() => {
    setPage(1);
  }, [q, ambassadorType, sortBy, sortOrder]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search ambassadors…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <Select value={ambassadorType || 'ALL'} onValueChange={(v) => setAmbassadorType(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Ambassador type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
            aria-label={sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : ambassadors.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Users className="h-5 w-5" />
          </EmptyMedia>
          <EmptyTitle>No ambassadors yet</EmptyTitle>
          <EmptyDescription>
            {q || ambassadorType ? 'Try adjusting your filters.' : 'Approved applicants will show up here.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Campaigns</TableHead>
                <TableHead className="text-right">Registrations</TableHead>
                <TableHead className="text-right">Accrued</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ambassadors.map((a) => (
                <TableRow key={a.ambassadorId} className="cursor-pointer" onClick={() => setProfileId(a.ambassadorId)}>
                  <TableCell className="font-medium">
                    {a.firstName} {a.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {typeLabel(a.ambassadorType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.campaigns.length} campaign{a.campaigns.length === 1 ? '' : 's'}
                  </TableCell>
                  <TableCell className="text-right">{a.totalRegistrations}</TableCell>
                  <TableCell className="text-right">
                    <Rupees amount={a.totalAccruedAmount} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(a.joinedPlatformAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProfileId(a.ambassadorId);
                      }}
                    >
                      View Profile
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <PaginationBar
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pagination.limit}
          onPageChange={setPage}
        />
      )}

      <AmbassadorProfileSheet ambassadorId={profileId} onClose={() => setProfileId(null)} />
    </div>
  );
}
