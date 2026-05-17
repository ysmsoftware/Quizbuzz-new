import { ContestAnalyticsSnapshot } from "@prisma/client";

export interface ScoreDistributionEntry {
    score: number;
    count: number;
}

export interface AnalyticsSnapshot extends ContestAnalyticsSnapshot {
    scoreDistribution: ScoreDistributionEntry[];
}

export interface LiveAnalytics {
    activeNow: number;
    totalParticipated: number;
    totalSubmitted: number;
}

export interface AnalyticsResponse {
    snapshot: ContestAnalyticsSnapshot | null;
    live: LiveAnalytics;
}
