import type { QuizResult, ApiResponse, Question, QuizAttempt } from '@/lib/types';
import { MockDB } from '@/lib/mock/db';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class SubmissionService {
  private get submissions(): QuizAttempt[] {
    return MockDB.submissions;
  }

  async submitQuiz(
    contestId: string,
    participantId: string,
    answers: any[]
  ): Promise<ApiResponse<QuizAttempt>> {
    await delay(1000);

    const submission: QuizAttempt = {
      id: `sub-${Date.now()}`,
      registrationId: `reg-${Date.now()}`,
      contestId,
      participantId,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      timeSpentSeconds: Math.floor(Math.random() * 3600),
      answers,
      proctoringViolations: []
    };

    this.submissions.push(submission);

    return {
      success: true,
      data: submission,
      message: 'Quiz submitted successfully'
    };
  }

  async getResults(contestId: string): Promise<ApiResponse<QuizResult[]>> {
    await delay(300);

    const results = this.submissions
      .filter(s => s.contestId === contestId && s.status === 'submitted')
      .map((submission, idx) => ({
        attemptId: submission.id,
        contestId,
        participantId: submission.participantId,
        participantName: `Participant ${idx + 1}`,
        score: Math.floor(Math.random() * 100),
        totalMarks: 100,
        correctAnswers: Math.floor(Math.random() * 30),
        wrongAnswers: Math.floor(Math.random() * 20),
        unattempted: Math.floor(Math.random() * 10),
        timeTaken: `${Math.floor(submission.timeSpentSeconds / 60)} mins`,
        rank: idx + 1,
        totalParticipants: this.submissions.length,
        percentile: 100 - (idx / this.submissions.length) * 100,
        isPassed: Math.random() > 0.3,
        breakdown: []
      }));

    return {
      success: true,
      data: results.sort((a, b) => b.score - a.score)
    };
  }

  async getSubmissions(contestId: string): Promise<ApiResponse<QuizAttempt[]>> {
    await delay(300);
    const submissions = this.submissions.filter(s => s.contestId === contestId);
    return {
      success: true,
      data: submissions
    };
  }

  async publishResults(contestId: string): Promise<ApiResponse<{ published: boolean }>> {
    await delay(500);

    return {
      success: true,
      data: { published: true },
      message: 'Results published successfully'
    };
  }

  async evaluateAnswers(
    contestId: string,
    questions: Question[]
  ): Promise<ApiResponse<{ evaluated: number }>> {
    await delay(2000);

    return {
      success: true,
      data: { evaluated: questions.length },
      message: 'All answers evaluated'
    };
  }

  async getSubmissionById(id: string): Promise<ApiResponse<QuizAttempt>> {
    await delay(200);

    const submission = this.submissions.find(s => s.id === id);

    if (!submission) {
      return {
        success: false,
        error: 'Submission not found'
      };
    }

    return {
      success: true,
      data: submission
    };
  }

  async getProctoringAlerts(contestId: string): Promise<ApiResponse<any[]>> {
    await delay(500);

    // Filter submissions for this contest and map to proctoring alert summary
    const alerts = this.submissions
      .filter(s => s.contestId === contestId)
      .map(s => ({
        id: s.id,
        participantId: s.participantId,
        name: `Participant ${s.participantId.split('-')[1] || s.participantId}`,
        avatarInitials: 'P',
        alertCount: (s.proctoringViolations || []).length,
        violations: s.proctoringViolations || [],
        status: s.status,
        lastAlertAt: s.proctoringViolations?.length ? s.proctoringViolations[s.proctoringViolations.length - 1].timestamp : null
      }));

    return {
      success: true,
      data: alerts
    };
  }
}

export const submissionService = new SubmissionService();
