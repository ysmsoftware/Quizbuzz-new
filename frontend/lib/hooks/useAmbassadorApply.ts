'use client';

import { useMutation } from '@tanstack/react-query';
import { ambassadorService } from '@/lib/services/ambassador-service';

export function useAmbassadorApply() {
  const uploadProofMutation = useMutation({
    mutationFn: (file: { organizationId: string; filename: string; mimeType: string }) =>
      ambassadorService.requestUploadUrl(file),
  });

  const applyMutation = useMutation({
    mutationFn: (body: Parameters<typeof ambassadorService.apply>[0]) => ambassadorService.apply(body),
  });

  return {
    requestUploadUrl: uploadProofMutation.mutateAsync,
    requestUploadUrlLoading: uploadProofMutation.isPending,
    apply: applyMutation.mutateAsync,
    applyLoading: applyMutation.isPending,
    applyError: applyMutation.error as Error | null,
  };
}
