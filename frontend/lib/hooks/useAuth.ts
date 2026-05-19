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
    onSuccess: () => {
      // Refetch /me to populate auth state
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });

  /**
   * Logout mutation
   */
  const logoutMutation = useMutation({
    mutationFn: authApi.logoutAdmin,
    onSuccess: () => {
      // Clear all cache and redirect
      queryClient.clear();
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
