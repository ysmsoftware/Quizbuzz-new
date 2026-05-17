import { get, post, patch, ApiResponse } from './apiClient';

interface SubmissionSummary {
  totalSubmitted: number;
  totalEvaluated: number;
  totalPending: number;
  averageScore: string;
  highestScore: string;
  lowestScore: string;
}

interface SubmissionRecord {
  id: string;
  participantId: string;
  status: 'PENDING' | 'SUBMITTED' | 'EVALUATED' | 'INVALIDATED';
  submittedAt: string;
  totalQuestions: number;
  attempted: number;
  score: string;
  percentage: string;
  participant: {
    contact: {
      firstName: string;
      lastName: string;
      email: string;
    }
  }
}

interface SubmissionsResponse {
  data: SubmissionRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  summary: SubmissionSummary;
}

/**
 * Submissions API
 */
export const submissionsApi = {
  getContestSubmissions: (contestId: string, params?: { status?: string; page?: number; limit?: number }) =>
    get<SubmissionsResponse>(`/submissions/contests/${contestId}`, { params }),

  getSubmissionDetail: (submissionId: string) =>
    get<any>(`/submissions/${submissionId}`),

  invalidateSubmission: (submissionId: string, reason: string) =>
    post<any>(`/submissions/${submissionId}/invalidate`, { reason }),
  
  bulkEvaluate: (contestId: string) =>
    post<any>(`/submissions/contests/${contestId}/evaluate`),
};

/**
 * Analytics API
 */
export const analyticsApi = {
  getContestAnalytics: (contestId: string) =>
    get<any>(`/analytics/contests/${contestId}`),

  getScoreDistribution: (contestId: string) =>
    get<any>(`/analytics/contests/${contestId}/distribution`),

  refreshAnalytics: (contestId: string) =>
    post<any>(`/analytics/contests/${contestId}/snapshot`),
};

/**
 * Proctoring API
 */
export const proctoringApi = {
  getOverview: (contestId: string) =>
    get<any>(`/proctoring/contests/${contestId}/overview`),

  getFlaggedParticipants: (contestId: string, params?: { page?: number; limit?: number }) =>
    get<any>(`/proctoring/contests/${contestId}/flagged`, { params }),

  getParticipantEvents: (contestId: string, participantId: string, params?: { page?: number; limit?: number }) =>
    get<any>(`/proctoring/contests/${contestId}/participants/${participantId}/events`, { params }),

  dismissViolation: (eventId: string) =>
    post<any>(`/proctoring/events/${eventId}/dismiss`),
};
