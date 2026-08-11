'use client';

import { useMutation } from '@tanstack/react-query';
import { ambassadorService } from '@/lib/services/ambassador-service';

export function useAmbassadorAuth() {
  const requestOtpMutation = useMutation({
    mutationFn: ({ email, organizationId }: { email: string; organizationId: string }) =>
      ambassadorService.requestOtp(email, organizationId),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ email, organizationId, otp }: { email: string; organizationId: string; otp: string }) =>
      ambassadorService.verifyOtp(email, organizationId, otp),
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
