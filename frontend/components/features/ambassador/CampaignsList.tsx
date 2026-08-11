'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { useOrgAmbassadorCampaigns } from '@/lib/hooks/useOrgAmbassadorCampaigns';

export function CampaignsList() {
  const [page, setPage] = useState(1);
  const { campaigns, pagination, isLoading } = useOrgAmbassadorCampaigns({ page, limit: 20 });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild size="sm">
          <Link href="/org/ambassadors/campaigns/new">
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Trophy className="h-5 w-5" />
          </EmptyMedia>
          <EmptyTitle>No campaigns yet</EmptyTitle>
          <EmptyDescription>Create one to get started.</EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}>{campaign.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(campaign.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/org/ambassadors/campaigns/${campaign.id}/edit`}>Edit</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/org/ambassadors/campaigns/${campaign.id}/report`}>Report</Link>
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
    </div>
  );
}
