'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import * as orgApi from '../api/organization.api';
import { queryKeys } from '../api/queryClient';

/**
 * Organization hook using TanStack Query
 * 
 * Returns both query objects (for advanced usage) and backward-compatible surface
 * (org, loading, error) for existing pages.
 */
export function useOrganization(orgId: string) {
  const queryClient = useQueryClient();

  /**
   * Org detail query
   */
  const orgQuery = useQuery({
    queryKey: queryKeys.org.detail(orgId),
    queryFn: () => orgApi.getOrg(orgId),
    enabled: !!orgId,
  });

  /**
   * Members list query
   */
  const membersQuery = useQuery({
    queryKey: queryKeys.org.members(orgId),
    queryFn: () => orgApi.getOrgMembers(orgId),
    enabled: !!orgId,
  });

  /**
   * Update org mutation
   */
  const updateOrgMutation = useMutation({
    mutationFn: (body: Parameters<typeof orgApi.updateOrg>[1]) =>
      orgApi.updateOrg(orgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.org.detail(orgId) });
    },
  });

  /**
   * Invite member mutation
   */
  const inviteMemberMutation = useMutation({
    mutationFn: (body: Parameters<typeof orgApi.inviteMember>[1]) =>
      orgApi.inviteMember(orgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.org.members(orgId) });
    },
  });

  /**
   * Change member role mutation
   */
  const changeMemberRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: import('../types').TeamRole }) =>
      orgApi.changeMemberRole(orgId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.org.members(orgId) });
    },
  });

  /**
   * Remove member mutation
   */
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => orgApi.removeMember(orgId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.org.members(orgId) });
    },
  });

  // Backward-compatible surface
  const org = orgQuery.data?.data;
  const loading = orgQuery.isLoading;
  const error = orgQuery.error?.message ?? null;

  return {
    // Query objects (for advanced usage)
    orgQuery,
    membersQuery,

    // Mutations
    updateOrgMutation,
    inviteMemberMutation,
    changeMemberRoleMutation,
    removeMemberMutation,

    // Backward-compatible surface
    org,
    loading,
    error,
  };
}
