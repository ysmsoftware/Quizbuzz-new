'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificatesApi } from '@/lib/api/results-certs.api';
import { toast } from 'sonner';

/**
 * Hook to retrieve a single participant's certificate (used on the public verification page).
 */
export function useParticipantCertificate(participantId: string) {
  const certificateQuery = useQuery({
    queryKey: ['participant-certificate', participantId],
    queryFn: () => certificatesApi.getParticipantCertificate(participantId),
    enabled: !!participantId,
    staleTime: 1000 * 60 * 5,
  });

  return {
    certificate: certificateQuery.data?.data,
    isLoading: certificateQuery.isLoading,
    loading: certificateQuery.isLoading, // Backward compatibility for pages destructuring 'loading'
    isError: certificateQuery.isError,
    error: certificateQuery.error as Error | null,
    refetchCertificate: certificateQuery.refetch,
  };
}

/**
 * Hook to manage participants and their certificates inside the Contest Admin Dashboard.
 */
export function useParticipants(contestId: string, options: { page: number; limit: number; search: string; status: string }) {
  const queryClient = useQueryClient();

  // Query paginated certificates/participants for the contest
  const certsQuery = useQuery({
    queryKey: ['certificates-paginated', contestId, options],
    queryFn: () => certificatesApi.getContestCertificates(contestId, options),
    enabled: !!contestId,
    placeholderData: (previousData) => previousData, // Silk-smooth transition between pages
  });

  const isLoading = certsQuery.isLoading;

  const refetch = async () => {
    await certsQuery.refetch();
  };

  // Bulk issue certificates mutation
  const bulkIssueMutation = useMutation({
    mutationFn: () => certificatesApi.bulkIssueCertificates(contestId),
    onSuccess: () => {
      toast.success('Bulk certificate generation successfully queued');
      queryClient.invalidateQueries({ queryKey: ['certificates-paginated', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to trigger bulk issuance');
    },
  });

  // Individual participant certificate issue mutation
  const singleIssueMutation = useMutation({
    mutationFn: (participantId: string) => certificatesApi.issueCertificate(contestId, { participantId }),
    onSuccess: () => {
      toast.success('Certificate queued for participant');
      queryClient.invalidateQueries({ queryKey: ['certificates-paginated', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to issue individual certificate');
    },
  });

  // Retry a single failed certificate mutation
  const retryMutation = useMutation({
    mutationFn: (certId: string) => certificatesApi.retryCertificate(certId),
    onSuccess: () => {
      toast.success('Re-generation job successfully queued');
      queryClient.invalidateQueries({ queryKey: ['certificates-paginated', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to retry generation');
    },
  });

  // Retry all failed certificates in the contest mutation
  const retryAllFailedMutation = useMutation({
    mutationFn: () => certificatesApi.retryFailedCertificates({ contestId }),
    onSuccess: (data: any) => {
      toast.success(data?.message || 'All failed generation jobs re-queued successfully');
      queryClient.invalidateQueries({ queryKey: ['certificates-paginated', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to retry all failed certificates');
    },
  });

  return {
    certsData: certsQuery.data,
    isLoading,
    refetch,
    bulkIssueMutation,
    singleIssueMutation,
    retryMutation,
    retryAllFailedMutation,
  };
}

