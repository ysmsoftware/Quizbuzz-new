'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ambassadorService } from '@/lib/services/ambassador-service';

/** Login for a returning ambassador — platform-level, email only (no organizationId). */
export function useAmbassadorAuth() {
  const queryClient = useQueryClient();

  const requestOtpMutation = useMutation({
    mutationFn: (email: string) => ambassadorService.requestOtp(email),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) => ambassadorService.verifyOtp(email, otp),
    onSuccess: () => {
      // A prior unauthenticated check (e.g. the dashboard guard's own redirect-to-login) can
      // leave ['ambassador-me'] cached as an error. Without this reset, the guard on the page
      // we're about to navigate to reads that stale error before its background refetch
      // resolves and bounces straight back to login — reset (not invalidate) clears the error
      // immediately so the guard sees "loading", not "unauthenticated".
      queryClient.resetQueries({ queryKey: ['ambassador-me'] });
    },
  });

  return {
    requestOtp: requestOtpMutation.mutateAsync,
    requestOtpLoading: requestOtpMutation.isPending,
    requestOtpError: requestOtpMutation.error as Error | null,
    verifyOtp: verifyOtpMutation.mutateAsync,
    verifyOtpLoading: verifyOtpMutation.isPending,
    verifyOtpError: verifyOtpMutation.error as Error | null,
  };
}
