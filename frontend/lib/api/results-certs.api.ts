import { get, post, del, ApiResponse } from './apiClient';

/**
 * Leaderboard Types
 */
export interface LeaderboardEntry {
    rank: number;
    score: string;
    percentage: string;
    isPassed?: boolean;
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
    participant: {
        id: string;
        registrationRef: string;
        status: string;
        contact: {
            firstName: string;
            lastName: string | null;
            email: string;
        };
    };
    certificate: {
        id: string;
        status: 'PENDING' | 'QUEUED' | 'GENERATING' | 'GENERATED' | 'FAILED' | 'DELIVERED';
        fileUrl: string | null;
        generatedAt: string | null;
        deliveredAt: string | null;
    } | null;
    certStatus: string;
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

    getAdminLeaderboard: (contestId: string, params?: { page?: number; limit?: number }) =>
        get<LeaderboardResponse>(`/contests/${contestId}/admin-leaderboard`, { params }),

    /** Re-runs the evaluation pipeline — replaces the non-existent /leaderboard/build endpoint */
    triggerEvaluate: (contestId: string) =>
        post<any>(`/contests/${contestId}/evaluate`),

    declareResults: (contestId: string) =>
        post<any>(`/contests/${contestId}/declare-results`),

    getResultsDeclarationInfo: (contestId: string) =>
        get<any>(`/contests/${contestId}/results-info`),

    getScoreDistribution: (contestId: string) =>
        get<ScoreDistributionResponse>(`/analytics/${contestId}/score-distribution`),
};

export const certificatesApi = {
    getContestCertificates: (contestId: string, params?: { page?: number; limit?: number; search?: string; status?: string }) =>
        get<CertificatesListResponse>(`/certificates/contest/${contestId}`, { params }),

    getParticipantCertificate: (id: string) =>
        get<any>(`/certificates/public/${id}`),

    getCertificatesByContact: (contactId: string, params?: { page?: number; limit?: number }) =>
        get<any>(`/certificates/contact/${contactId}`, { params }),

    getCertificateByContactAndContest: (contactId: string, contestId: string) =>
        get<any>(`/certificates/contact/${contactId}/contest/${contestId}`),

    getCertificateById: (id: string) =>
        get<any>(`/certificates/${id}`),

    issueCertificate: (contestId: string, body: { participantId: string; templateData?: any }) =>
        post<any>(`/certificates/issue`, { ...body, contestId }),

    bulkIssueCertificates: (contestId: string, body?: { cutoffPercentage?: number }) =>
        post<any>(`/certificates/bulk-issue`, { ...body, contestId }),

    retryCertificate: (certificateId: string) =>
        post<any>(`/certificates/${certificateId}/retry`),

    retryFailedCertificates: (params?: { contestId?: string }) =>
        post<any>(`/certificates/retry-failed`, {}, { params }),
};
