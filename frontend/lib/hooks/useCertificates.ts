import { useQuery } from '@tanstack/react-query';
import { certificateService } from '@/lib/services/certificate-service';

export function useCertificates(participantId: string) {
  const query = useQuery({
    queryKey: ['certificates', participantId],
    queryFn: () => certificateService.getCertificatesByParticipant(participantId),
    enabled: !!participantId,
  });

  return {
    certificates: query.data?.data ?? [],
    loading: query.isLoading,
    async downloadPDF(certificateId: string) {
      const result = await certificateService.downloadCertificatePDF(certificateId);
      if (!result.success) {
        throw new Error(result.error ?? 'Unable to download certificate');
      }
      return result.data?.url;
    },
  };
}
