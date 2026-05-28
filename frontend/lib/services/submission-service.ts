import type { QuizResult, ApiResponse, Question, QuizAttempt } from '@/lib/types';

const generateUUID = (): string => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

class SubmissionService {
  async submitQuizREST(
    contestId: string,
    participantId: string,
    answers: any[],
    token?: string
  ): Promise<ApiResponse<QuizAttempt>> {
    const idempotencyKey = generateUUID();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    if (!apiUrl) {
      console.warn('REST submission failed: API URL is missing');
      return { success: false, message: 'API URL missing in configuration' };
    }

    try {
      const response = await fetch(`${apiUrl}/api/v1/contests/${contestId}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ participantId, answers }),
      });

      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          data: result.data || result,
          message: 'Quiz submitted successfully via REST',
        };
      } else {
        const errData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errData.message || 'REST submission failed',
        };
      }
    } catch (err: any) {
      console.error('REST submission request error:', err);
      return {
        success: false,
        message: err.message || 'REST submission error',
      };
    }
  }
}

export const submissionService = new SubmissionService();
