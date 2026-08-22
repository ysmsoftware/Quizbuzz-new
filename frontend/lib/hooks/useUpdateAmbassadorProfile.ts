'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ambassadorService } from '@/lib/services/ambassador-service';

export function useUpdateAmbassadorProfile() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: { firstName?: string; lastName?: string | null; phone?: string; applicationData?: Record<string, string> }) =>
      ambassadorService.updateProfile(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ambassador-me'] }),
  });
  return { updateProfile: mutation.mutateAsync, isUpdating: mutation.isPending, error: mutation.error as Error | null };
}
