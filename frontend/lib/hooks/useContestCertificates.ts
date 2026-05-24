'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { certificatesApi, CertificateRecord } from '@/lib/api/results-certs.api';

export function useContestCertificates(contestId: string, page = 1, limit = 20) {
  const queryClient = useQueryClient();

  const certificatesQuery = useQuery({
    queryKey: ['contest-certificates', contestId, page, limit],
    queryFn: () => certificatesApi.getContestCertificates(contestId, { page, limit }),
    enabled: !!contestId,
    staleTime: 1000 * 60 * 2,
  });

  const bulkIssue = useMutation({
    mutationFn: () => certificatesApi.bulkIssueCertificates(contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contest-certificates', contestId] });
    },
  });

  const issueOne = useMutation({
    mutationFn: (participantId: string) => certificatesApi.issueCertificate(contestId, { participantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contest-certificates', contestId] });
    },
  });

  const retryCertificate = useMutation({
    mutationFn: (certificateId: string) => certificatesApi.retryCertificate(certificateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contest-certificates', contestId] });
    },
  });

  const retryFailed = useMutation({
    mutationFn: () => certificatesApi.retryFailedCertificates({ contestId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contest-certificates', contestId] });
    },
  });

  const rawCertificates = certificatesQuery.data?.data?.data ?? [];

  return {
    certificatesQuery,
    certificates: rawCertificates,
    pagination: certificatesQuery.data?.data?.pagination,
    summary: certificatesQuery.data?.data?.summary,
    isLoading: certificatesQuery.isLoading,
    bulkIssueCertificates: bulkIssue.mutateAsync,
    isBulkIssuing: bulkIssue.isPending,
    issueCertificate: issueOne.mutateAsync,
    isIssuing: issueOne.isPending,
    retryCertificate: retryCertificate.mutateAsync,
    isRetryingCertificate: retryCertificate.isPending,
    retryFailedCertificates: retryFailed.mutateAsync,
    isRetryingFailedCertificates: retryFailed.isPending,
  };
}
