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
      selectedParticipantIds?: string[];
    }) => {
      return messageService.sendMessage(
        payload.contestId,
        payload.templateId,
        payload.recipientFilter,
        payload.channel,
        payload.selectedParticipantIds
      );
    },
  });

  const sendDirectMutation = useMutation({
    mutationFn: (payload: {
      contactId: string;
      contestId?: string;
      templateId: string;
      recipient: string;
      channel: MessageChannel;
      subject?: string;
      body: string;
      parameters?: Record<string, string>;
    }) => {
      return messageService.sendDirectMessage(payload);
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: (payload: {
      contestId: string;
      templateId: string;
      recipientFilter: RecipientFilter;
      channel: MessageChannel;
      scheduledFor: string;
      selectedParticipantIds?: string[];
    }) => {
      return messageService.scheduleMessage(
        payload.contestId,
        payload.templateId,
        payload.recipientFilter,
        payload.channel,
        payload.scheduledFor,
        payload.selectedParticipantIds
      );
    },
  });

  const loading = sendMutation.isPending || scheduleMutation.isPending || sendDirectMutation.isPending;
  const error = (sendMutation.error || scheduleMutation.error || sendDirectMutation.error) as Error | null;

  return {
    sendNow: sendMutation.mutateAsync,
    sendDirect: sendDirectMutation.mutateAsync,
    scheduleMessage: scheduleMutation.mutateAsync,
    loading,
    error: error?.message ?? null,
  };
}
