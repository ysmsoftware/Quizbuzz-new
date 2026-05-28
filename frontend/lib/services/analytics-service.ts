class AnalyticsService {
  getOrgAnalytics(orgId: string, dateRange: { from: string; to: string }) {
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
