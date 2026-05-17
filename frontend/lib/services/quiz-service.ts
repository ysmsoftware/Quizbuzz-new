import type { Question, QuizAttempt, Answer, QuizResult, LeaderboardEntry, ApiResponse } from '@/lib/types';
import { MockDB } from '@/lib/mock/db';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

class QuizService {
  private get questions(): Question[] {
    return MockDB.questions;
  }
  private attempts: QuizAttempt[] = [];
  private leaderboards: Map<string, LeaderboardEntry[]> = new Map();

  async getQuestionsByContestId(contestId: string): Promise<ApiResponse<Question[]>> {
    await delay(300);
    
    const contestQuestions = this.questions.filter(q => q.contestId === contestId);
    
    return {
      success: true,
      data: contestQuestions
    };
  }

  async addQuestion(contestId: string, question: Omit<Question, 'id'>): Promise<ApiResponse<Question>> {
    await delay(300);
    const newQuestion: Question = {
      ...question,
      id: generateId(),
      contestId
    };
    this.questions.push(newQuestion);
    return { success: true, data: newQuestion };
  }

  async updateQuestion(id: string, updates: Partial<Question>): Promise<ApiResponse<Question>> {
    await delay(300);
    const idx = this.questions.findIndex(q => q.id === id);
    if (idx === -1) return { success: false, error: 'Question not found' };
    
    this.questions[idx] = { ...this.questions[idx], ...updates };
    return { success: true, data: this.questions[idx] };
  }

  async deleteQuestion(id: string): Promise<ApiResponse<void>> {
    await delay(300);
    const idx = this.questions.findIndex(q => q.id === id);
    if (idx === -1) return { success: false, error: 'Question not found' };
    
    this.questions.splice(idx, 1);
    return { success: true };
  }

  async reorderQuestions(contestId: string, orderedIds: string[]): Promise<ApiResponse<void>> {
    await delay(500);
    // In a real app, this would update indices in DB
    // For now, we just simulate success
    return { success: true };
  }

  async bulkUpdateQuestions(ids: string[], updates: Partial<Question>): Promise<ApiResponse<void>> {
    await delay(500);
    ids.forEach(id => {
      const idx = this.questions.findIndex(q => q.id === id);
      if (idx !== -1) {
        this.questions[idx] = { ...this.questions[idx], ...updates };
      }
    });
    return { success: true };
  }

  async startAttempt(
    contestId: string,
    registrationId: string,
    participantId: string
  ): Promise<ApiResponse<QuizAttempt>> {
    await delay(300);
    
    // Check for existing attempt
    const existing = this.attempts.find(
      a => a.contestId === contestId && 
           a.participantId === participantId &&
           (a.status === 'in_progress' || a.status === 'submitted')
    );
    
    if (existing) {
      if (existing.status === 'submitted') {
        return {
          success: false,
          error: 'You have already submitted this quiz'
        };
      }
      return {
        success: true,
        data: existing,
        message: 'Resuming existing attempt'
      };
    }
    
    const questions = this.questions.filter(q => q.contestId === contestId);
    
    const attempt: QuizAttempt = {
      id: `attempt-${generateId()}`,
      registrationId,
      contestId,
      participantId,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      timeSpentSeconds: 0,
      answers: questions.map(q => ({
        questionId: q.id,
        selectedOptionIds: [],
        isMarkedForReview: false,
        timeSpentSeconds: 0
      })),
      proctoringViolations: []
    };
    
    this.attempts.push(attempt);
    
    return {
      success: true,
      data: attempt
    };
  }

  async saveAnswer(
    attemptId: string,
    questionId: string,
    selectedOptionIds: string[],
    isMarkedForReview: boolean,
    timeSpent: number
  ): Promise<ApiResponse<Answer>> {
    await delay(100);
    
    const attempt = this.attempts.find(a => a.id === attemptId);
    
    if (!attempt) {
      return {
        success: false,
        error: 'Attempt not found'
      };
    }
    
    const answerIndex = attempt.answers.findIndex(a => a.questionId === questionId);
    
    if (answerIndex === -1) {
      return {
        success: false,
        error: 'Question not found in attempt'
      };
    }
    
    attempt.answers[answerIndex] = {
      questionId,
      selectedOptionIds,
      isMarkedForReview,
      timeSpentSeconds: timeSpent,
      answeredAt: new Date().toISOString()
    };
    
    return {
      success: true,
      data: attempt.answers[answerIndex]
    };
  }

  async submitAttempt(attemptId: string): Promise<ApiResponse<QuizResult>> {
    await delay(500);
    
    const attempt = this.attempts.find(a => a.id === attemptId);
    
    if (!attempt) {
      return {
        success: false,
        error: 'Attempt not found'
      };
    }
    
    attempt.status = 'submitted';
    attempt.submittedAt = new Date().toISOString();
    
    // Calculate score
    const questions = this.questions.filter(q => q.contestId === attempt.contestId);
    let score = 0;
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unattempted = 0;
    const breakdown: QuizResult['breakdown'] = [];
    
    for (const question of questions) {
      const answer = attempt.answers.find(a => a.questionId === question.id);
      const selected = answer?.selectedOptionIds || [];
      const correct = question.correctOptionIds;
      
      const isCorrect = 
        selected.length === correct.length &&
        selected.every(s => correct.includes(s));
      
      if (selected.length === 0) {
        unattempted++;
        breakdown.push({
          questionId: question.id,
          questionNumber: question.questionNumber,
          questionText: question.text,
          yourAnswer: [],
          correctAnswer: correct,
          isCorrect: false,
          marksObtained: 0,
          maxMarks: question.marks
        });
      } else if (isCorrect) {
        correctAnswers++;
        score += question.marks;
        breakdown.push({
          questionId: question.id,
          questionNumber: question.questionNumber,
          questionText: question.text,
          yourAnswer: selected,
          correctAnswer: correct,
          isCorrect: true,
          marksObtained: question.marks,
          maxMarks: question.marks
        });
      } else {
        wrongAnswers++;
        score -= question.negativeMarks;
        breakdown.push({
          questionId: question.id,
          questionNumber: question.questionNumber,
          questionText: question.text,
          yourAnswer: selected,
          correctAnswer: correct,
          isCorrect: false,
          marksObtained: -question.negativeMarks,
          maxMarks: question.marks
        });
      }
    }
    
    score = Math.max(0, score); // Don't go below 0
    
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const timeTaken = this.formatTime(attempt.timeSpentSeconds);
    
    // Update leaderboard
    this.updateLeaderboard(attempt.contestId, {
      rank: 0, // Will be calculated
      participantId: attempt.participantId,
      participantName: 'Participant', // Would come from registration
      score,
      timeTaken,
    });
    
    const leaderboard = this.leaderboards.get(attempt.contestId) || [];
    const rank = leaderboard.findIndex(e => e.participantId === attempt.participantId) + 1;
    const percentile = ((leaderboard.length - rank) / leaderboard.length) * 100;
    
    attempt.score = score;
    attempt.rank = rank;
    attempt.percentile = percentile;
    
    const result: QuizResult = {
      attemptId: attempt.id,
      contestId: attempt.contestId,
      participantId: attempt.participantId,
      participantName: 'Participant',
      score,
      totalMarks,
      correctAnswers,
      wrongAnswers,
      unattempted,
      timeTaken,
      rank,
      totalParticipants: leaderboard.length,
      percentile: Math.round(percentile * 100) / 100,
      isPassed: score >= totalMarks * 0.4, // 40% passing
      breakdown
    };
    
    return {
      success: true,
      data: result
    };
  }

  private updateLeaderboard(contestId: string, entry: LeaderboardEntry) {
    let leaderboard = this.leaderboards.get(contestId) || [];
    
    // Remove existing entry for this participant
    leaderboard = leaderboard.filter(e => e.participantId !== entry.participantId);
    
    // Add new entry
    leaderboard.push(entry);
    
    // Sort by score (desc) then by time (asc)
    leaderboard.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return this.parseTime(a.timeTaken) - this.parseTime(b.timeTaken);
    });
    
    // Update ranks
    leaderboard.forEach((e, i) => {
      e.rank = i + 1;
    });
    
    this.leaderboards.set(contestId, leaderboard);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private parseTime(time: string): number {
    const [mins, secs] = time.split(':').map(Number);
    return mins * 60 + secs;
  }

  async getLeaderboard(contestId: string, limit: number = 10): Promise<ApiResponse<LeaderboardEntry[]>> {
    await delay(200);
    
    const leaderboard = this.leaderboards.get(contestId) || [];
    
    return {
      success: true,
      data: leaderboard.slice(0, limit)
    };
  }

  async getAttempt(attemptId: string): Promise<ApiResponse<QuizAttempt>> {
    await delay(200);
    
    const attempt = this.attempts.find(a => a.id === attemptId);
    
    if (!attempt) {
      return {
        success: false,
        error: 'Attempt not found'
      };
    }
    
    return {
      success: true,
      data: attempt
    };
  }

  async reportViolation(
    attemptId: string,
    type: 'tab_switch' | 'fullscreen_exit' | 'face_not_detected' | 'multiple_faces'
  ): Promise<ApiResponse<{ violationCount: number }>> {
    await delay(100);
    
    const attempt = this.attempts.find(a => a.id === attemptId);
    
    if (!attempt) {
      return {
        success: false,
        error: 'Attempt not found'
      };
    }
    
    const existing = attempt.proctoringViolations.find(v => v.type === type);
    
    if (existing) {
      existing.count++;
      existing.timestamp = new Date().toISOString();
    } else {
      attempt.proctoringViolations.push({
        type,
        timestamp: new Date().toISOString(),
        count: 1
      });
    }
    
    const totalViolations = attempt.proctoringViolations.reduce((sum, v) => sum + v.count, 0);
    
    return {
      success: true,
      data: { violationCount: totalViolations }
    };
  }
}

export const quizService = new QuizService();
