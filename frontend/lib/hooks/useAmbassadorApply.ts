'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ambassadorService } from '@/lib/services/ambassador-service';

/** 2-step platform-level signup: name/email/phone -> OTP verify -> type + ID proof. */
export function useAmbassadorSignup() {
  const queryClient = useQueryClient();
  const startMutation = useMutation({
    mutationFn: (body: { firstName: string; lastName?: string; email: string; phone?: string }) =>
      ambassadorService.signupStart(body),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: (body: { email: string; otp: string }) => ambassadorService.signupVerifyOtp(body),
  });

  const uploadProofMutation = useMutation({
    mutationFn: (file: { filename: string; mimeType: string }) => ambassadorService.requestUploadUrl(file),
  });

  const completeMutation = useMutation({
    mutationFn: (body: Parameters<typeof ambassadorService.signupComplete>[0]) => ambassadorService.signupComplete(body),
    // Same race as useAmbassadorAuth's verifyOtp — this call logs the ambassador in (sets the
    // session cookie) and the caller redirects to the dashboard right after; a stale cached
    // error under this key must not survive to be read by that page's guard.
    onSuccess: () => {
      queryClient.resetQueries({ queryKey: ['ambassador-me'] });
    },
  });

  return {
    start: startMutation.mutateAsync,
    startLoading: startMutation.isPending,
    verifyOtp: verifyOtpMutation.mutateAsync,
    verifyOtpLoading: verifyOtpMutation.isPending,
    requestUploadUrl: uploadProofMutation.mutateAsync,
    requestUploadUrlLoading: uploadProofMutation.isPending,
    complete: completeMutation.mutateAsync,
    completeLoading: completeMutation.isPending,
    completeError: completeMutation.error as Error | null,
  };
}
