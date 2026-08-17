'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ambassadorService } from '@/lib/services/ambassador-service';

export function useAmbassadorLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => ambassadorService.logout(),
    onSettled: () => {
      // Clear regardless of whether the API call itself succeeded — a client with a
      // stale/expired cookie should still be able to "log out" locally.
      queryClient.removeQueries({ queryKey: ['ambassador-me'] });
      router.replace('/ambassador/login');
    },
  });
  return { logout: mutation.mutateAsync, isLoggingOut: mutation.isPending };
}
