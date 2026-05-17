'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import * as registrationApi from '../api/registration.api';
import { queryKeys } from '../api/queryClient';
import { get } from '../api/apiClient';
import { Contest } from '../types';

/**
 * Hook for fetching public contest details by slug
 */
export function usePublicContest(slug: string) {
  return useQuery({
    queryKey: queryKeys.public.contest(slug),
    queryFn: async () => {
      const res = await get(`/contests/public/${slug}`);
      return res.data as Contest;
    },
    enabled: !!slug,
  });
}

/**
 * Hook for participant registration flow
 */
export function useRegistration(contestSlug: string) {
  /**
   * Step 1: Request OTP
   */
  const requestOtpMutation = useMutation({
    mutationFn: (email: string) => registrationApi.requestOtp(email),
  });

  /**
   * Step 2: Verify OTP
   */
  const verifyOtpMutation = useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) =>
      registrationApi.verifyOtp(email, otp),
  });

  /**
   * Step 3: Register for Contest
   */
  const registerMutation = useMutation({
    mutationFn: (body: Parameters<typeof registrationApi.registerForContest>[1]) =>
      registrationApi.registerForContest(contestSlug, body),
  });

  return {
    requestOtpMutation,
    verifyOtpMutation,
    registerMutation,
  };
}
