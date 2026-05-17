import type { ApiResponse } from '@/lib/types';
import { MockDB } from '@/lib/mock/db';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface Certificate {
  id: string;
  contestId: string;
  participantId: string;
  participantName: string;
  templateId: string;
  issuedAt: string;
  certificateUrl?: string;
  status: 'pending' | 'issued' | 'sent';
}

export interface CertificateTemplate {
  id: string;
  name: string;
  description: string;
  designUrl: string;
  variables: string[];
  isDefault?: boolean;
}

class CertificateService {
  private get certificates(): Certificate[] {
    return MockDB.certificates;
  }
  private templates: CertificateTemplate[] = [
    {
      id: 'tmpl-default',
      name: 'Achievement Certificate',
      description: 'Standard certificate for quiz completion',
      designUrl: '/certificates/achievement.jpg',
      variables: ['participantName', 'score', 'rank', 'issueDate'],
      isDefault: true
    },
    {
      id: 'tmpl-merit',
      name: 'Merit Certificate',
      description: 'Certificate for high achievers',
      designUrl: '/certificates/merit.jpg',
      variables: ['participantName', 'score', 'rank', 'issueDate']
    }
  ];

  async listCertificates(contestId: string): Promise<ApiResponse<Certificate[]>> {
    await delay(200);

    const certs = this.certificates.filter(c => c.contestId === contestId);

    return {
      success: true,
      data: certs
    };
  }

  async getCertificatesByParticipant(participantId: string): Promise<ApiResponse<Certificate[]>> {
    await delay(200);

    const certs = this.certificates.filter(c => c.participantId === participantId);

    return {
      success: true,
      data: certs
    };
  }

  async issueCertificates(
    contestId: string,
    participantIds: string[],
    templateId: string = 'tmpl-default'
  ): Promise<ApiResponse<{ issued: number }>> {
    await delay(1500);

    let count = 0;
    participantIds.forEach(pid => {
      const cert: Certificate = {
        id: `cert-${Date.now()}-${Math.random()}`,
        contestId,
        participantId: pid,
        participantName: `Participant ${pid}`,
        templateId,
        issuedAt: new Date().toISOString(),
        status: 'issued'
      };

      this.certificates.push(cert);
      count++;
    });

    return {
      success: true,
      data: { issued: count },
      message: `${count} certificates issued successfully`
    };
  }

  async bulkIssueCertificates(
    contestId: string,
    criteria: 'all' | 'topN' | 'passed',
    options?: { topN?: number }
  ): Promise<ApiResponse<{ issued: number }>> {
    await delay(2000);

    // Simulate issuing certificates based on criteria
    const issued = criteria === 'topN' ? (options?.topN || 10) : 50;

    return {
      success: true,
      data: { issued },
      message: `${issued} certificates issued`
    };
  }

  async getTemplates(): Promise<ApiResponse<CertificateTemplate[]>> {
    await delay(100);

    return {
      success: true,
      data: this.templates
    };
  }

  async downloadCertificatePDF(certificateId: string): Promise<ApiResponse<{ url: string }>> {
    await delay(500);

    return {
      success: true,
      data: { url: `/api/certificates/${certificateId}/download` },
      message: 'Certificate ready for download'
    };
  }
}

export const certificateService = new CertificateService();
