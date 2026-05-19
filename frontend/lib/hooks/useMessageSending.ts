import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { messageService } from '@/lib/services/message-service';
import type { MessageChannel, RecipientFilter } from '@/lib/types';

export function useMessageSending() {
  const sendMutation = useMutation({
    mutationFn: (payload: {
      contestId: string;
      templateId: string;
      recipientFilter: RecipientFilter;
      channel: MessageChannel;
    }) => {
      return messageService.sendMessage(
        payload.contestId,
        payload.templateId,
        payload.recipientFilter,
        payload.channel
      );
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: (payload: {
      contestId: string;
      templateId: string;
      recipientFilter: RecipientFilter;
      channel: MessageChannel;
      scheduledFor: string;
    }) => {
      return messageService.scheduleMessage(
        payload.contestId,
        payload.templateId,
        payload.recipientFilter,
        payload.channel,
        payload.scheduledFor
      );
    },
  });

  const loading = sendMutation.isPending || scheduleMutation.isPending;
  const error = (sendMutation.error || scheduleMutation.error) as Error | null;

  return {
    sendNow: sendMutation.mutateAsync,
    scheduleMessage: scheduleMutation.mutateAsync,
    loading,
    error: error?.message ?? null,
  };
}
