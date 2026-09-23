'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as orgApi from '../api/organization.api';
import type { NotificationPreference } from '../api/organization.api';
import { queryKeys } from '../api/queryClient';

/** The current admin's notification toggles for this org, with optimistic toggle updates. */
export function useNotificationPreferences(orgId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.org.notificationPreferences(orgId);

  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await orgApi.getNotificationPreferences(orgId)).data ?? [],
    enabled: !!orgId,
  });

  const mutation = useMutation({
    mutationFn: (pref: { type: string; email: boolean }) => orgApi.updateNotificationPreferences(orgId, [pref]),
    onMutate: async (pref) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationPreference[]>(key);
      queryClient.setQueryData<NotificationPreference[]>(key, (old) =>
        old?.map((p) => (p.type === pref.type ? { ...p, email: pref.email } : p)),
      );
      return { previous };
    },
    onError: (_err, _pref, ctx) => queryClient.setQueryData(key, ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { preferences: query.data ?? [], isLoading: query.isLoading, update: mutation.mutateAsync };
}
