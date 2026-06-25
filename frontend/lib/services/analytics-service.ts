export interface TopContestRow {
  id: string;
  title: string;
  registrations: number;
  participationRate: number;
}

export interface OrgAnalytics {
  dailyMetrics: Array<{ date: string; registrations: number; revenue: number }>;
  totalRegistrations: number;
  totalRevenue: number;
  avgDailyRegistrations: number;
  contestsByStatus: { live: number; upcoming: number; ended: number; draft: number };
  topContests: TopContestRow[];
}

class AnalyticsService {
  getOrgAnalytics(orgId: string, dateRange: { from: string; to: string }): OrgAnalytics {
    return {
      dailyMetrics: [],
      totalRegistrations: 0,
      totalRevenue: 0,
      avgDailyRegistrations: 0,
      contestsByStatus: { live: 0, upcoming: 0, ended: 0, draft: 0 },
      topContests: [],
    };
  }

  getContestAnalytics(contestId: string) {
    return {
      registrationFunnel: [],
      scoreDistribution: [],
      questionPerformance: [],
      timeDistribution: [],
      deviceBreakdown: [],
    };
  }
}

export const analyticsService = new AnalyticsService();
