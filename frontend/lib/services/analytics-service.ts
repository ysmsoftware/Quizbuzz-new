import type { Contest } from '@/lib/types';
import { MockDB } from '@/lib/mock/db';
import { getAnalyticsForContest, getOrgAnalytics } from '@/lib/mock/relations';

interface DailyMetric {
  date: string;
  registrations: number;
  paid: number;
  free: number;
  revenue: number;
}

interface ContestMetric {
  id: string;
  title: string;
  registrations: number;
  participationRate: number;
}

interface FunnelStep {
  name: string;
  value: number;
}

interface QuestionPerformance {
  questionId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  correctPercentage: number;
}

interface DeviceBreakdown {
  device: 'desktop' | 'mobile' | 'tablet';
  count: number;
  percentage: number;
}

interface TimeDistribution {
  bucket: string;
  count: number;
}

class AnalyticsService {
  private get dailyMetrics(): DailyMetric[] {
    return MockDB.analyticsCache.dailyRegistrations.map(dr => ({
      date: dr.date,
      registrations: dr.count,
      paid: Math.floor(dr.count * 0.8),
      free: Math.floor(dr.count * 0.2),
      revenue: Math.floor(dr.count * 0.8 * 200),
    }));
  }
  private get contestMetrics(): ContestMetric[] {
    return MockDB.contests.map(c => ({
      id: c.id,
      title: c.title,
      registrations: c._count?.participants || 0,
      participationRate: c._count?.participants ? ((c._count?.submissions || 0) / c._count.participants) : 0,
    }));
  }

  // constructor removed - data comes from MockDB

  getOrgAnalytics(orgId: string, dateRange: { from: string; to: string }) {
    return {
      dailyMetrics: this.dailyMetrics,
      totalRegistrations: this.dailyMetrics.reduce((sum, m) => sum + m.registrations, 0),
      totalRevenue: this.dailyMetrics.reduce((sum, m) => sum + m.revenue, 0),
      avgDailyRegistrations: Math.round(
        this.dailyMetrics.reduce((sum, m) => sum + m.registrations, 0) / this.dailyMetrics.length
      ),
      contestsByStatus: {
        live: 3,
        upcoming: 5,
        ended: 12,
        draft: 2,
      },
      topContests: this.contestMetrics,
    };
  }

  getContestAnalytics(contestId: string) {
    return {
      registrationFunnel: [
        { name: 'Visited page', value: 500 },
        { name: 'Started form', value: 420 },
        { name: 'Completed', value: 380 },
        { name: 'Paid', value: 340 },
        { name: 'Confirmed', value: 312 },
      ] as FunnelStep[],
      
      scoreDistribution: [
        { range: '0-10', count: 12, percentage: 3.8 },
        { range: '11-20', count: 28, percentage: 8.9 },
        { range: '21-30', count: 45, percentage: 14.4 },
        { range: '31-40', count: 62, percentage: 19.8 },
        { range: '41-50', count: 78, percentage: 25.0 },
        { range: '51-60', count: 52, percentage: 16.7 },
        { range: '61-70', count: 32, percentage: 10.2 },
      ],
      
      questionPerformance: [
        { questionId: 'q1', difficulty: 'easy', correctPercentage: 95 },
        { questionId: 'q2', difficulty: 'easy', correctPercentage: 92 },
        { questionId: 'q3', difficulty: 'medium', correctPercentage: 78 },
        { questionId: 'q4', difficulty: 'medium', correctPercentage: 65 },
        { questionId: 'q5', difficulty: 'hard', correctPercentage: 42 },
        { questionId: 'q6', difficulty: 'hard', correctPercentage: 35 },
      ] as QuestionPerformance[],
      
      timeDistribution: [
        { bucket: '0-5 min', count: 8 },
        { bucket: '5-10 min', count: 24 },
        { bucket: '10-15 min', count: 56 },
        { bucket: '15-20 min', count: 78 },
        { bucket: '20-30 min', count: 92 },
        { bucket: '30+ min', count: 54 },
      ] as TimeDistribution[],
      
      deviceBreakdown: [
        { device: 'desktop', count: 210, percentage: 67.3 },
        { device: 'mobile', count: 78, percentage: 25.0 },
        { device: 'tablet', count: 24, percentage: 7.7 },
      ] as DeviceBreakdown[],
    };
  }
}

export const analyticsService = new AnalyticsService();
