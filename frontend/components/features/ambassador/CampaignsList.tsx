'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trophy, Search, ChevronDown, Users, CalendarDays, ArrowRight, MoreVertical, BookmarkPlus, Trash2, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { useOrgAmbassadorCampaigns } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { CAMPAIGN_STATUS_BADGE_VARIANT } from './campaign-status';
import { SaveAsTemplateModal } from './SaveAsTemplateModal';
import { DeleteCampaignModal } from './DeleteCampaignModal';
import { TemplatesList } from './TemplatesList';
import type { AmbassadorCampaignStatus, CampaignListItem } from '@/lib/types/ambassador';

const STATUS_OPTIONS: AmbassadorCampaignStatus[] = ['DRAFT', 'PUBLISHED', 'LIVE', 'ENDED', 'ARCHIVED'];

const SORT_OPTIONS: { value: 'createdAt' | 'name' | 'startDate' | 'status'; label: string }[] = [
  { value: 'createdAt', label: 'Created' },
  { value: 'name', label: 'Name' },
  { value: 'startDate', label: 'Start Date' },
  { value: 'status', label: 'Status' },
];

const ACTIVE_CAMPAIGN_STATUSES: AmbassadorCampaignStatus[] = ['DRAFT', 'PUBLISHED', 'LIVE', 'ENDED'];

export function CampaignsList() {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'archived' | 'templates'>('campaigns');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<AmbassadorCampaignStatus[]>([]);
  const [ambassadorType, setAmbassadorType] = useState<string>('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'startDate' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');
  const typeLabel = (key: string) => types.find((t) => t.key === key)?.label ?? key;

  // For 'campaigns' tab, exclude ARCHIVED by default unless explicit status filter selected.
  // For 'archived' tab, explicitly query ARCHIVED status.
  const queryStatuses = activeTab === 'archived'
    ? ['ARCHIVED' as AmbassadorCampaignStatus]
    : (status.length ? status : ACTIVE_CAMPAIGN_STATUSES);

  const { campaigns, pagination, isLoading } = useOrgAmbassadorCampaigns({
    q: q || undefined,
    status: queryStatuses,
    ambassadorType: ambassadorType || undefined,
    sortBy,
    sortOrder,
    page,
    limit: 20,
  });

  useEffect(() => {
    setPage(1);
  }, [activeTab, q, status, ambassadorType, sortBy, sortOrder]);

  const toggleStatus = (s: AmbassadorCampaignStatus, checked: boolean) => {
    setStatus((prev) => (checked ? [...prev, s] : prev.filter((v) => v !== s)));
  };

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'campaigns' | 'archived' | 'templates')} className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-b border-border/40 pb-3">
        <TabsList className="h-9">
          <TabsTrigger value="campaigns">All Campaigns</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
          <TabsTrigger value="templates">Saved Templates</TabsTrigger>
        </TabsList>

        <Button asChild size="sm">
          <Link href="/org/campaigns/new">
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Link>
        </Button>
      </div>

      <TabsContent value="campaigns" className="space-y-4 mt-0">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search campaigns…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-between sm:w-40">
                  Status{status.length ? ` (${status.length})` : ''}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-2">
                  {STATUS_OPTIONS.map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <Checkbox id={`status-${s}`} checked={status.includes(s)} onCheckedChange={(v) => toggleStatus(s, v === true)} />
                      <Label htmlFor={`status-${s}`} className="font-normal cursor-pointer">
                        {s}
                      </Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

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
              <SelectTrigger className="w-36">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Trophy className="h-5 w-5" />
            </EmptyMedia>
            <EmptyTitle>No campaigns found</EmptyTitle>
            <EmptyDescription>
              {q || status.length || ambassadorType ? 'Try adjusting your filters.' : 'Create one to get started.'}
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} typeLabel={typeLabel} />
            ))}
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
      </TabsContent>

      <TabsContent value="archived" className="space-y-4 mt-0">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <Empty className="border border-dashed border-border/60 rounded-2xl bg-muted/20 p-8">
            <EmptyMedia variant="icon" className="bg-muted p-4 rounded-full mb-3">
              <Archive className="h-6 w-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-semibold">No archived campaigns</EmptyTitle>
            <EmptyDescription className="text-xs text-muted-foreground max-w-sm mt-1 text-center">
              Deleted or archived campaigns will appear here for your records.
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} typeLabel={typeLabel} />
            ))}
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
      </TabsContent>

      <TabsContent value="templates" className="mt-0">
        <TemplatesList />
      </TabsContent>
    </Tabs>
  );
}

function CampaignCard({ campaign, typeLabel }: { campaign: CampaignListItem; typeLabel: (key: string) => string }) {
  const isDraft = campaign.status === 'DRAFT';
  const isArchived = campaign.status === 'ARCHIVED';
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  return (
    <>
      <Card className="border-border/50 flex flex-col">
        <CardHeader className="pb-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground truncate" title={campaign.name || undefined}>
              {campaign.name || <span className="text-muted-foreground italic font-normal">Untitled</span>}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant={CAMPAIGN_STATUS_BADGE_VARIANT[campaign.status]}>
                {campaign.status}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Campaign actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSaveModalOpen(true)}>
                    <BookmarkPlus className="h-4 w-4 mr-2" />
                    Save as Template
                  </DropdownMenuItem>
                  {!isArchived && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteModalOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Campaign
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {campaign.contestTitle && <p className="text-xs text-muted-foreground truncate">Promoting {campaign.contestTitle}</p>}
        </CardHeader>

        <CardContent className="flex-1 space-y-3">
          {campaign.ambassadorTypesAllowed.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {campaign.ambassadorTypesAllowed.map((key) => (
                <Badge key={key} variant="outline" className="font-normal text-xs">
                  {typeLabel(key)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No ambassador types set yet</p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {campaign.enrollmentCount} {campaign.enrollmentCount === 1 ? 'ambassador' : 'ambassadors'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(campaign.createdAt).toLocaleDateString()}
            </span>
          </div>
        </CardContent>

        <CardFooter className="pt-0 gap-2">
          {isDraft ? (
            <Button asChild size="sm" className="w-full">
              <Link href={`/org/campaigns/${campaign.id}/wizard`}>
                Continue setup
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="outline" className="flex-1">
                <Link href={`/org/campaigns/${campaign.id}`}>View</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="flex-1">
                <Link href={`/org/campaigns/${campaign.id}/report`}>Report</Link>
              </Button>
            </>
          )}
        </CardFooter>
      </Card>

      <SaveAsTemplateModal
        campaignId={campaign.id}
        campaignName={campaign.name}
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
      />

      <DeleteCampaignModal
        campaignId={campaign.id}
        campaignName={campaign.name}
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
      />
    </>
  );
}



