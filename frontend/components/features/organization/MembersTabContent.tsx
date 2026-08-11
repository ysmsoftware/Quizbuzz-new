'use client';

import { useState, useMemo } from 'react';
import { Users, Plus, Search, Filter, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { useOrganization, useOrgUsage } from '@/lib/hooks/useOrganization';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { MembersTable } from './MembersTable';
import { InviteModal, InviteSuccessData } from './InviteModal';
import { TeamMember, TeamRole } from '@/lib/types';
import { toast } from 'sonner';

interface MembersTabContentProps {
  orgId: string;
}

export function MembersTabContent({ orgId }: MembersTabContentProps) {
  const { admin } = useAuth();
  const currentAdminId = admin?.id;
  const {
    membersQuery,
    inviteMemberMutation,
    changeMemberRoleMutation,
    removeMemberMutation,
  } = useOrganization(orgId);

  const { data: usageData, isLoading: usageLoading } = useOrgUsage(orgId);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const members: TeamMember[] = useMemo(() => {
    const rawData = membersQuery.data?.data || membersQuery.data;
    if (!Array.isArray(rawData)) return [];
    return rawData.map((m: any) => ({
      id: m.id,
      adminId: m.adminId,
      email: m.admin?.email || m.email || '',
      name: m.admin ? `${m.admin.firstName} ${m.admin.lastName}`.trim() : m.email || '',
      role: m.role as TeamRole,
      status: m.acceptedAt ? 'active' : 'pending',
      isActive: m.isActive,
      joinedAt: m.createdAt || m.invitedAt,
      invitedAt: m.invitedAt,
      acceptedAt: m.acceptedAt,
      admin: m.admin,
    }));
  }, [membersQuery.data]);

  // Determine requesting admin's role in this org
  const currentUserMember = useMemo(() => {
    return members.find((m) => m.adminId === currentAdminId);
  }, [members, currentAdminId]);

  const isOwner = currentUserMember?.role?.toUpperCase() === 'OWNER';

  // Filter members based on search and selected dropdown filters
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Search
      const searchLower = searchQuery.toLowerCase().trim();
      if (searchLower) {
        const nameMatch = m.name.toLowerCase().includes(searchLower);
        const emailMatch = m.email.toLowerCase().includes(searchLower);
        if (!nameMatch && !emailMatch) return false;
      }

      // Role filter
      if (roleFilter !== 'ALL') {
        if (m.role.toUpperCase() !== roleFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ACTIVE' && m.acceptedAt === null) return false;
        if (statusFilter === 'PENDING' && m.acceptedAt !== null) return false;
      }

      return true;
    });
  }, [members, searchQuery, roleFilter, statusFilter]);

  // Usage numbers
  const maxOrgMembers = usageData?.data?.limits?.maxOrgMembers ?? null;
  const currentMemberCount = usageData?.data?.memberCountUsed ?? members.length;
  const isLimitReached = maxOrgMembers !== null && currentMemberCount >= maxOrgMembers;
  const usagePercentage = maxOrgMembers ? Math.min(100, Math.round((currentMemberCount / maxOrgMembers) * 100)) : 0;

  const handleInviteMember = async (email: string, role: 'ADMIN' | 'VIEWER'): Promise<InviteSuccessData | void> => {
    const res = await inviteMemberMutation.mutateAsync({ email, role });
    const resData = (res as any)?.data || res;
    return {
      email,
      role,
      inviteLink: resData?.inviteLink || `${window.location.origin}/accept-invite?token=${resData?.inviteToken || ''}`,
    };
  };

  const handleUpdateRole = async (memberId: string, role: TeamRole) => {
    await changeMemberRoleMutation.mutateAsync({ memberId, role });
  };

  const handleRemoveMember = async (memberId: string) => {
    await removeMemberMutation.mutateAsync(memberId);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span>Organization Members</span>
            </CardTitle>
            <CardDescription className="mt-1">
              Manage your workspace members, assign access permissions, and send invitations.
            </CardDescription>
          </div>
          {isOwner && (
            <Button
              onClick={() => setIsInviteOpen(true)}
              disabled={isLimitReached}
              className="gap-2 shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Invite Member</span>
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Subscription Seat Limit Progress Bar */}
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <span>Member Seats</span>
                {maxOrgMembers !== null ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({currentMemberCount} of {maxOrgMembers} used)
                  </span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({currentMemberCount} active • Unlimited plan)
                  </span>
                )}
              </div>
              {isLimitReached && (
                <span className="text-xs font-semibold text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Seat limit reached
                </span>
              )}
            </div>

            {maxOrgMembers !== null && (
              <Progress value={usagePercentage} className="h-2" />
            )}

            {isLimitReached && (
              <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
                <span>Your subscription plan member ceiling has been reached. Upgrade your plan to invite more team members.</span>
              </p>
            )}
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-36 text-xs h-9">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Roles</SelectItem>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 text-xs h-9">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PENDING">Pending Invite</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2.5 shrink-0"
                onClick={() => membersQuery.refetch()}
                title="Refresh Member List"
                disabled={membersQuery.isFetching}
              >
                <RefreshCw className={`h-4 w-4 ${membersQuery.isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Members Table */}
          <MembersTable
            members={filteredMembers}
            currentAdminId={currentAdminId}
            isOwner={isOwner}
            onUpdateRole={handleUpdateRole}
            onRemove={handleRemoveMember}
            isLoading={membersQuery.isLoading || inviteMemberMutation.isPending}
          />
        </CardContent>
      </Card>

      {/* Invite Member Modal */}
      <InviteModal
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        onInvite={handleInviteMember}
        isLoading={inviteMemberMutation.isPending}
      />
    </div>
  );
}
