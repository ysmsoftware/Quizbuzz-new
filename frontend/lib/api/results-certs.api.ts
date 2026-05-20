import { get, post, del, ApiResponse } from './apiClient';

/**
 * Leaderboard Types
 */
export interface LeaderboardEntry {
  rank: number;
  score: string;
  percentage: string;
  timeTakenSecs: number;
  prizeLabel?: string;
  prizeBenefits?: string[];
  participant: {
    registrationRef: string;
    contact: {
      firstName: string;
      lastName: string;
    }
  }
}

export interface LeaderboardResponse {
  contestTitle: string;
  totalEntries: number;
  entries: LeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}

export interface ScoreDistributionResponse {
  buckets: Array<{
    range: string;
    count: number;
  }>;
}

/**
 * Certificate Types
 */
export interface CertificateRecord {
  id: string;
  status: 'PENDING' | 'QUEUED' | 'GENERATING' | 'GENERATED' | 'FAILED' | 'DELIVERED';
  fileUrl?: string;
  generatedAt?: string;
  deliveredAt?: string;
  participant: {
    registrationRef: string;
    contact: {
      firstName: string;
      lastName: string;
      email: string;
    }
  }
}

export interface CertificatesListResponse {
  data: CertificateRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    generated: number;
    failed: number;
    pending: number;
  }
}

/**
 * Results & Leaderboard API
 */
export const resultsApi = {
  getPublicLeaderboard: (contestId: string, params?: { page?: number; limit?: number }) =>
    get<LeaderboardResponse>(`/contests/${contestId}/leaderboard`, { params }),

  rebuildLeaderboard: (contestId: string) =>
    post<any>(`/contests/${contestId}/leaderboard/build`),

  declareResults: (contestId: string) =>
    post<any>(`/contests/${contestId}/declare-results`),

  getScoreDistribution: (contestId: string) =>
    get<ScoreDistributionResponse>(`/contests/${contestId}/analytics/score-distribution`),
};

export const certificatesApi = {
  getContestCertificates: (contestId: string, params?: { page?: number; limit?: number }) =>
    get<CertificatesListResponse>(`/certificates/contest/${contestId}`, { params }),

  getParticipantCertificate: (id: string) =>
    get<any>(`/certificates/public/${id}`),

  getCertificateByContactAndContest: (contactId: string, contestId: string) =>
    get<any>(`/certificates/contact/${contactId}/contest/${contestId}`),

  getCertificateById: (id: string) =>
    get<any>(`/certificates/${id}`),

  issueCertificate: (body: { participantId?: string; contactId?: string; contestId?: string }) =>
    post<any>(`/certificates/issue`, body),

  bulkIssueCertificates: (body: { contestId: string }) =>
    post<any>(`/certificates/bulk-issue`, body),

  retryCertificate: (certificateId: string) =>
    post<any>(`/certificates/${certificateId}/retry`),

  retryFailedCertificates: (params?: { contestId?: string }) =>
    post<any>(`/certificates/retry-failed`, {}, { params }),
};
