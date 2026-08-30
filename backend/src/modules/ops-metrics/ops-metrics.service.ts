import v8 from "v8";
import { redis } from "../../config/redis";
import { config } from "../../config";
import { prisma } from "../../config/db";
import logger from "../../config/logger";
import { getActiveWsConnections } from "../../ws-connections";
import { QuizSession } from "../quiz/quiz.session";
import { InstanceHeartbeat, FleetSnapshot, LiveContestSummary } from "./ops-metrics.types";

const HEARTBEAT_KEY_PREFIX = "ops:instance:";

// TTL is 3x the report interval so one or two missed ticks (a GC pause, a
// slow Redis round-trip) don't make a still-live instance disappear from
// the fleet view — but a genuinely dead/replaced instance still ages out
// within a bounded window instead of lingering forever in SCAN results.
const HEARTBEAT_TTL_SEC = Math.max(15, Math.ceil((config.opsMetrics.heartbeatIntervalMs / 1000) * 3));

export class OpsMetricsService {
    constructor(private readonly session: QuizSession) { }

    private key(role: "backend" | "worker"): string {
        return `${HEARTBEAT_KEY_PREFIX}${config.app.instanceId}:${role}`;
    }

    /**
     * Builds this process's own snapshot. `ws` is only populated for the
     * backend role — the worker process never runs the Socket.IO server
     * (see quiz-lifecycle audit: worker.ts never calls socketService.attach),
     * so an active-connection count from it would always read zero and be
     * misleading rather than just absent.
     */
    private buildHeartbeat(role: "backend" | "worker"): InstanceHeartbeat {
        const mem = process.memoryUsage();
        const heapLimit = v8.getHeapStatistics().heap_size_limit;

        const heartbeat: InstanceHeartbeat = {
            instanceId: config.app.instanceId,
            role,
            reportedAt: new Date().toISOString(),
            uptimeSec: Math.round(process.uptime()),
            memory: {
                rssMb: Math.round(mem.rss / 1024 / 1024),
                heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
                heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
                externalMb: Math.round(mem.external / 1024 / 1024),
                heapLimitMb: Math.round(heapLimit / 1024 / 1024),
                heapUsedPct: heapLimit > 0 ? Math.round((mem.heapUsed / heapLimit) * 100) : 0,
            },
            redisHost: config.redis.host,
        };

        if (role === "backend") {
            const activeConnections = getActiveWsConnections();
            heartbeat.ws = {
                activeConnections,
                maxConnections: config.websocket.maxConnections,
                draining: activeConnections >= config.websocket.maxConnections,
            };
        }

        return heartbeat;
    }

    /**
     * Called on a timer from both server.ts (role="backend") and worker.ts
     * (role="worker"). Never throws — a metrics-reporting failure must never
     * take down the actual application; log and let the next tick retry.
     */
    async reportHeartbeat(role: "backend" | "worker"): Promise<void> {
        try {
            const heartbeat = this.buildHeartbeat(role);
            await redis.set(this.key(role), JSON.stringify(heartbeat), "EX", HEARTBEAT_TTL_SEC);
        } catch (err) {
            logger.error(`[ops-metrics] Failed to report heartbeat (${role}):`, err);
        }
    }

    /**
     * Fan-in read: every instance (admin or ASG) writes its own heartbeat to
     * the SAME shared Redis (the Docker container in idle mode, ElastiCache
     * in live mode) — so whichever instance answers this HTTP request can
     * read every other instance's latest snapshot without needing direct
     * network access to them. This is required, not just convenient: ASG
     * quiz instances have no public IP and sit in a private subnet, so
     * there's no other way for the ops dashboard (an external host) to see
     * their per-instance numbers at all.
     */
    async getFleetSnapshot(): Promise<FleetSnapshot> {
        const keys: string[] = [];
        let cursor = "0";
        do {
            const [nextCursor, batch] = await redis.scan(cursor, "MATCH", `${HEARTBEAT_KEY_PREFIX}*`, "COUNT", 100);
            cursor = nextCursor;
            keys.push(...batch);
        } while (cursor !== "0");

        if (keys.length === 0) {
            return { reportingInstances: 0, totals: { activeConnections: 0, rssMb: 0, heapUsedMb: 0 }, instances: [] };
        }

        const values = await redis.mget(...keys);
        const instances: InstanceHeartbeat[] = values
            .map((raw) => {
                try { return raw ? (JSON.parse(raw) as InstanceHeartbeat) : null; }
                catch { return null; }
            })
            .filter((v): v is InstanceHeartbeat => v !== null)
            .sort((a, b) => a.instanceId.localeCompare(b.instanceId) || a.role.localeCompare(b.role));

        const totals = instances.reduce(
            (acc, i) => ({
                activeConnections: acc.activeConnections + (i.ws?.activeConnections ?? 0),
                rssMb: acc.rssMb + i.memory.rssMb,
                heapUsedMb: acc.heapUsedMb + i.memory.heapUsedMb,
            }),
            { activeConnections: 0, rssMb: 0, heapUsedMb: 0 }
        );

        return { reportingInstances: instances.length, totals, instances };
    }

    /**
     * Contests currently worth watching — same LIVE/REGISTRATION_CLOSED
     * filter durability.service.ts's periodic snapshot sweep already uses,
     * so the dashboard's contest picker matches exactly what the durability
     * worker considers "in flight" too.
     */
    async listLiveContests(): Promise<LiveContestSummary[]> {
        const contests = await prisma.contest.findMany({
            where: { status: { in: ["LIVE", "REGISTRATION_CLOSED"] } },
            select: { id: true, organizationId: true, title: true, status: true },
            orderBy: { createdAt: "desc" },
        });
        return contests.map((c) => ({
            contestId: c.id,
            organizationId: c.organizationId,
            title: c.title,
            status: c.status,
        }));
    }

    /**
     * Pure Redis, zero DB — the same getLiveSnapshot() the admin live-stats
     * socket broadcast already uses (quiz.gateway.ts's emitAdminLiveStats),
     * just exposed here as a pollable HTTP read instead of a socket push.
     */
    async getContestSnapshot(contestId: string) {
        return this.session.getLiveSnapshot(contestId, config.proctoring.threshold);
    }
}
