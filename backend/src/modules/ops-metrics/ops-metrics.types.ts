export interface InstanceHeartbeat {
    instanceId: string;
    role: "backend" | "worker";
    reportedAt: string;
    uptimeSec: number;
    memory: {
        rssMb: number;
        heapUsedMb: number;
        heapTotalMb: number;
        externalMb: number;
        heapLimitMb: number;
        heapUsedPct: number;
    };
    ws?: {
        activeConnections: number;
        maxConnections: number;
        draining: boolean;
    };
    redisHost: string;
}

export interface FleetSnapshot {
    reportingInstances: number;
    totals: {
        activeConnections: number;
        rssMb: number;
        heapUsedMb: number;
    };
    instances: InstanceHeartbeat[];
}

export interface LiveContestSummary {
    contestId: string;
    organizationId: string;
    title: string;
    status: string;
}
