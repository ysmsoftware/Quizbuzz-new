import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi, Contact, ContactHistoryItem } from '@/lib/api/crm.api';
import { toast } from 'sonner';

export type UseContactOptions = {
  enabled?: boolean;
  loadHistory?: boolean;
  loadMessages?: boolean;
  loadCertificates?: boolean;
};

export function useContact(contactId: string, options: UseContactOptions = {}) {
  const queryClient = useQueryClient();
  const {
    enabled = true,
    loadHistory = false,
    loadMessages = false,
    loadCertificates = false,
  } = options;

  const isEnabled = !!contactId && enabled;

  const {
    data: contact,
    isLoading: isLoadingContact,
    error: contactError,
    refetch: refetchContact,
  } = useQuery<Contact>({
    queryKey: ['contact', contactId],
    queryFn: () => crmApi.getContactDetail(contactId).then(res => res.data),
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const {
    data: history,
    isLoading: isLoadingHistory,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery<ContactHistoryItem[]>({
    queryKey: ['contact-history', contactId],
    queryFn: () => crmApi.getContactHistory(contactId).then(res => res.data),
    enabled: isEnabled && loadHistory,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const {
    data: messages,
    isLoading: isLoadingMessages,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['contact-messages', contactId],
    queryFn: () => crmApi.getContactMessages(contactId).then(res => res.data),
    enabled: isEnabled && loadMessages,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const {
    data: certificates,
    isLoading: isLoadingCertificates,
    error: certificatesError,
    refetch: refetchCertificates,
  } = useQuery({
    queryKey: ['contact-certificates', contactId],
    queryFn: () => crmApi.getContactCertificates(contactId).then(res => res.data),
    enabled: isEnabled && loadCertificates,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const updateContactMutation = useMutation({
    mutationFn: (body: Partial<Contact>) => crmApi.updateContact(contactId, body).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact successfully updated');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update contact');
    }
  });

  const deleteContactMutation = useMutation({
    mutationFn: () => crmApi.deleteContact(contactId).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact successfully deleted');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete contact');
    }
  });

  return {
    contact,
    isLoadingContact,
    contactError,
    refetchContact,
    history,
    isLoadingHistory,
    historyError,
    refetchHistory,
    messages,
    isLoadingMessages,
    messagesError,
    refetchMessages,
    certificates,
    isLoadingCertificates,
    certificatesError,
    refetchCertificates,
    updateContact: updateContactMutation.mutateAsync,
    isUpdating: updateContactMutation.isPending,
    deleteContact: deleteContactMutation.mutateAsync,
    isDeleting: deleteContactMutation.isPending,
    isLoading: isLoadingContact || isLoadingHistory || isLoadingMessages || isLoadingCertificates,
    hasError: !!contactError || !!historyError || !!messagesError || !!certificatesError,
  };
}
