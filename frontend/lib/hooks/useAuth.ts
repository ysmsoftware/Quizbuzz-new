/**
 * Admin Authentication Hook
 * 
 * Manages admin login, logout, and profile state using TanStack Query.
 * The actual token is stored in httpOnly cookies by the server.
 * 
 * This hook is SEPARATE from auth-store.ts which manages PARTICIPANT quiz session state.
 */

'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import * as authApi from '../api/auth.api';
import { queryKeys } from '../api/queryClient';
import { posthog } from '../posthog';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export interface OrgMembership {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'VIEWER';
}

export interface MeResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  organizations: OrgMembership[];
}

export function useAuth() {
  const queryClient = useQueryClient();

  /**
   * GET /auth/admin/me — source of truth for login status
   */
  const meQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: authApi.getMe,
    retry: false,
  });

  /**
   * Login mutation
   */
  const loginMutation = useMutation({
    mutationFn: authApi.loginAdmin,
    onSuccess: (res) => {
      // Refetch /me to populate auth state
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });

      // Identify the admin in PostHog so frontend events are linked to this user.
      // The server independently tracks events under the same adminId, so funnel
      // analysis will merge correctly once identity is established.
      const admin = res?.data?.admin;
      if (admin?.id) {
        posthog.identify(admin.id, {
          email: admin.email,
          name: `${admin.firstName} ${admin.lastName}`.trim(),
          role: 'admin',
        });
      }
    },
  });

  /**
   * Logout mutation
   */
  const logoutMutation = useMutation({
    mutationFn: authApi.logoutAdmin,
    onSuccess: () => {
      // Reset PostHog identity so the next session starts anonymous.
      // Must happen before clearing the query cache so any final events
      // still carry the current user context.
      posthog.reset();

      // Immediately mark the user as logged-out in the cache before navigating.
      // queryClient.clear() alone is not synchronous enough — the layout's useEffect
      // can fire a redirect to /admin before the cache flush completes.
      queryClient.setQueryData(queryKeys.auth.me, null);
      queryClient.resetQueries();
      if (typeof window !== 'undefined') {
        // Hard navigation (not router.push) so Next.js re-evaluates auth from scratch
        // and doesn't restore the previous admin page from the router cache.
        window.location.replace('/login');
      }
    },
    onError: () => {
      // Even if the API call fails (e.g. expired token), clear local state and redirect.
      posthog.reset();
      queryClient.setQueryData(queryKeys.auth.me, null);
      queryClient.resetQueries();
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    },
  });

  /**
   * Register mutation
   */
  const registerMutation = useMutation({
    mutationFn: authApi.registerAdmin,
  });

  /**
   * Forgot password mutation
   */
  const forgotPasswordMutation = useMutation({
    mutationFn: authApi.forgotPassword,
  });

  /**
   * Reset password mutation
   */
  const resetPasswordMutation = useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) => 
      authApi.resetPassword(token, newPassword),
  });

  /**
   * Verify email mutation
   */
  const verifyEmailMutation = useMutation({
    mutationFn: authApi.verifyEmail,
  });

  /**
   * Resend verification mutation
   */
  const resendVerificationMutation = useMutation({
    mutationFn: authApi.resendVerificationOtp,
  });

  /**
   * Switch organization mutation
   */
  const switchOrgMutation = useMutation({
    mutationFn: authApi.switchOrg,
    onSuccess: () => {
      // Invalidate everything when switching orgs
      queryClient.invalidateQueries();
    },
  });

  // Derived state
  const meData = meQuery.data?.data as MeResponse | undefined;
  const isLoggedIn = meQuery.isSuccess && !!meData?.id;
  const isEmailVerified = meData?.emailVerified ?? false;
  const admin = meData as AdminUser | undefined;
  const activeOrg = meData?.organizations?.[0] as OrgMembership | undefined;

  return {
    // Queries
    meQuery,

    // Mutations
    loginMutation,
    logoutMutation,
    registerMutation,
    forgotPasswordMutation,
    resetPasswordMutation,
    verifyEmailMutation,
    resendVerificationMutation,
    switchOrgMutation,

    // Derived state
    isLoggedIn,
    isEmailVerified,
    admin,
    activeOrg,
  };
}
