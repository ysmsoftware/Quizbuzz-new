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

/**
 * Certificates API
 */
export const certificatesApi = {
  getContestCertificates: (contestId: string, params?: { status?: string; page?: number; limit?: number }) =>
    get<CertificatesListResponse>(`/certificates/contests/${contestId}`, { params }),

  getParticipantCertificate: (participantId: string) =>
    get<any>(`/certificates/participants/${participantId}`),

  issueCertificate: (contestId: string, body: { participantId: string; templateData?: any }) =>
    post<any>(`/certificates/issue/${contestId}`, body),

  bulkIssueCertificates: (contestId: string, body?: { cutoffPercentage?: number }) =>
    post<any>(`/certificates/bulk-issue/${contestId}`, body),

  retryCertificate: (certificateId: string) =>
    post<any>(`/certificates/${certificateId}/retry`),

  deleteCertificate: (certificateId: string) =>
    del<any>(`/certificates/${certificateId}`),
};
