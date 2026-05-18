'use client';

import { useOrganization } from './useOrganization';
import { TeamRole } from '../types';

/**
 * Team members hook
 * 
 * Simply delegates to useOrganization and extracts the members query and mutations.
 * Maintained for backward compatibility with existing pages.
 */
export function useTeamMembers(orgId: string) {
  const { 
    membersQuery, 
    inviteMemberMutation, 
    removeMemberMutation, 
    changeMemberRoleMutation 
  } = useOrganization(orgId);

  const members = membersQuery.data?.data || [];
  const loading = membersQuery.isLoading;
  const error = membersQuery.error?.message ?? null;

  // Invitations are members with acceptedAt: null (as per 02-organization.md)
  // Actually, the API response for /members includes both active members and pending ones.
  const activeMembers = members.filter((m: any) => m.acceptedAt !== null);
  const pendingInvitations = members.filter((m: any) => m.acceptedAt === null);

  const inviteMember = async (email: string, role: TeamRole) => {
    return inviteMemberMutation.mutateAsync({ email, role });
  };

  const removeMember = async (memberId: string) => {
    return removeMemberMutation.mutateAsync(memberId);
  };

  const updateMemberRole = async (memberId: string, role: TeamRole) => {
    return changeMemberRoleMutation.mutateAsync({ memberId, role });
  };

  // Mocking revokeInvitation for now as it's not explicitly in 02-organization.md
  // but removeMember on a pending member usually serves this purpose.
  const revokeInvitation = async (memberId: string) => {
    return removeMemberMutation.mutateAsync(memberId);
  };

  return {
    members: activeMembers,
    invitations: pendingInvitations,
    loading,
    error,
    inviteMember,
    removeMember,
    updateMemberRole,
    revokeInvitation,
  };
}
