'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { crmApi, Contact } from '@/lib/api/crm.api';

export type ContactFilters = {
  search?: string;
  college?: string;
  page?: number;
  limit?: number;
};

export function useContacts(filters: ContactFilters = {}, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  const contactsQuery = useQuery({
    queryKey: ['contacts', filters],
    queryFn: () => crmApi.getContacts(filters),
    staleTime: 1000 * 60 * 2,
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });

  const createContactMutation = useMutation({
    mutationFn: (body: Partial<Contact>) => crmApi.createContact(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  return {
    contactsQuery,
    contacts: contactsQuery.data?.data?.data ?? [],
    pagination: contactsQuery.data?.data?.pagination,
    isLoading: contactsQuery.isLoading,
    isError: contactsQuery.isError,
    createContact: createContactMutation.mutateAsync,
    createContactLoading: createContactMutation.isPending,
    createContactError: createContactMutation.error as Error | null,
  };
}
