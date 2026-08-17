'use client';

import { useMutation } from '@tanstack/react-query';
import { ambassadorService } from '@/lib/services/ambassador-service';

/** Login for a returning ambassador — platform-level, email only (no organizationId). */
export function useAmbassadorAuth() {
  const requestOtpMutation = useMutation({
    mutationFn: (email: string) => ambassadorService.requestOtp(email),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) => ambassadorService.verifyOtp(email, otp),
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
