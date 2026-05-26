import { useQuery } from '@tanstack/react-query';
import { certificatesApi } from '@/lib/api/results-certs.api';

export function useCertificates(participantId: string) {
  const query = useQuery({
    queryKey: ['certificates', participantId],
    queryFn: async () => {
      try {
        // If it's a valid ID, try to get the certificate.
        const res = await certificatesApi.getCertificateById(participantId);
        if (res.success && res.data) {
          // Map to the shape expected by the frontend UI
          const cert = res.data;
          return {
            success: true,
            data: [{
              id: cert.id,
              contestId: cert.contestId,
              participantId: cert.participantId,
              participantName: `${cert.participant?.contact?.firstName ?? ''} ${cert.participant?.contact?.lastName ?? ''}`.trim() || 'Participant',
              templateId: cert.metadata?.templateId ?? 'tmpl-default',
              issuedAt: cert.generatedAt || cert.createdAt,
              certificateUrl: cert.fileUrl,
              status: cert.status.toLowerCase(),
            }]
          };
        }
      } catch (e) {
        // Fallback to public certificate view if that fails
        try {
          const res = await certificatesApi.getParticipantCertificate(participantId);
          if (res.success && res.data) {
            const cert = res.data;
            return {
              success: true,
              data: [{
                id: cert.id,
                contestId: cert.contestId,
                participantId: cert.participantId,
                participantName: `${cert.participant?.contact?.firstName ?? ''} ${cert.participant?.contact?.lastName ?? ''}`.trim() || 'Participant',
                templateId: cert.metadata?.templateId ?? 'tmpl-default',
                issuedAt: cert.generatedAt || cert.createdAt,
                certificateUrl: cert.fileUrl,
                status: cert.status.toLowerCase(),
              }]
            };
          }
        } catch (err) {
          // Silent catch to avoid UI crashes
        }
      }
      return { success: true, data: [] };
    },
    enabled: !!participantId,
  });

  return {
    certificates: query.data?.data ?? [],
    loading: query.isLoading,
    async downloadPDF(certificateId: string) {
      // Direct download or fetch URL
      try {
        const res = await certificatesApi.getCertificateById(certificateId);
        if (res.success && res.data?.fileUrl) {
          window.open(res.data.fileUrl, '_blank');
          return res.data.fileUrl;
        }
        // Fallback to public endpoint
        const resPublic = await certificatesApi.getParticipantCertificate(certificateId);
        if (resPublic.success && resPublic.data?.fileUrl) {
          window.open(resPublic.data.fileUrl, '_blank');
          return resPublic.data.fileUrl;
        }
        throw new Error('No PDF URL available for this certificate');
      } catch (err: any) {
        throw new Error(err.message || 'Unable to download certificate');
      }
    },
  };
}
