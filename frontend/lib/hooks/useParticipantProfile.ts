import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { participantService } from '@/lib/services/participant-service';
import type { ParticipantProfile } from '@/lib/types';

export function useParticipantProfile(participantId: string) {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['participant-profile', participantId],
    queryFn: () => participantService.getProfile(participantId),
    enabled: !!participantId,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<ParticipantProfile>) =>
      participantService.updateProfile(participantId, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['participant-profile', participantId] }),
  });

  const notificationsMutation = useMutation({
    mutationFn: (preferences: ParticipantProfile['notificationPreferences']) =>
      participantService.updateNotificationPreferences(participantId, preferences),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['participant-profile', participantId] }),
  });

  const avatarMutation = useMutation({
    mutationFn: (imageUrl: string) => participantService.uploadAvatar(participantId, imageUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['participant-profile', participantId] }),
  });

  return {
    profile: profileQuery.data?.data ?? null,
    loading: profileQuery.isLoading,
    updateProfile: updateMutation.mutateAsync,
    updateNotifications: notificationsMutation.mutateAsync,
    uploadAvatar: avatarMutation.mutateAsync,
  };
}
