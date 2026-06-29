
import cookieParser from "cookie-parser";
import express from 'express';
import helmet from 'helmet';
import addRequestId from "express-request-id";
import cors from 'cors';
import morgan from 'morgan';
import * as Sentry from "@sentry/node";
import logger, { morganStream } from "./config/logger";
import { prisma } from './config/db';
import path from "path";

import { redis } from './config/redis';
import { globalErrorHandler } from "./middlewares/error.middleware";
import { metricsRegistry, collectQueueMetrics } from './config/metrics';

import { config } from './config/index';


import { apiRouter } from './routes';
import { paymentController } from "./container";
import v8 from 'v8';

// Connection counter — incremented/decremented by SocketService on connect/disconnect.
// Read by /health to implement drain mode: when at capacity, /health returns 503
// so ALB stops routing new WebSocket connections to this instance while existing
// sockets continue uninterrupted.
let activeWsConnections = 0;
export function incrementWsConnections() { activeWsConnections++; }
export function decrementWsConnections() { if (activeWsConnections > 0) activeWsConnections--; }
export function getActiveWsConnections() { return activeWsConnections; }


const app = express();

app.set("trust proxy", 1);

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(addRequestId());

// payment webhook
app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    paymentController.handleWebhook
);

// CORS
app.use(cors({
    origin: config.cors.allowedOrigins,
    credentials: config.cors.allowedCredentials,
}));


app.use(cookieParser());


morgan.token('id', (req: any) => req.id);
app.use(morgan(
    ":id :method :url :status :res[content-length] - :response-time ms",
    { stream: morganStream }
));



// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/storage", express.static(path.join(process.cwd(), "storage")));


// routes
app.use('/api/v1', apiRouter);


app.get('/metrics', async (req, res) => {
    await collectQueueMetrics();
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
});

app.get('/health', async (req, res) => {
    const [db, cache] = await Promise.allSettled([
        prisma.$queryRaw`SELECT 1`,
        redis.ping(),
    ]);

    const dbOk    = db.status === 'fulfilled';
    const cacheOk = cache.status === 'fulfilled';

    // Drain mode: instance is at or above the configured WebSocket connection cap,
    // or heap usage has exceeded the configured threshold (default 80%).
    // Returning 503 here causes ALB to stop routing NEW connections to this instance
    // while all existing WebSocket sessions continue uninterrupted — the ALB never
    // closes an already-established TCP connection when a target goes unhealthy.
    const maxConnections = config.websocket.maxConnections;
    const mem            = process.memoryUsage();
    const heapUsed       = mem.heapUsed;
    // Use v8 heap_size_limit (the actual cap set by --max-old-space-size) as the
    // denominator. This gives a meaningful percentage relative to the real limit.
    // Using heapUsed/heapTotal is WRONG — heapTotal is the currently allocated arena
    // (starts tiny at ~4MB on startup) so 3MB/4MB = 75% looks alarming but is fine.
    const heapLimit      = v8.getHeapStatistics().heap_size_limit;
    const heapPct        = heapLimit > 0 ? Math.round((heapUsed / heapLimit) * 100) : 0;
    const heapThresholdPct = Number(process.env.HEALTH_HEAP_THRESHOLD_PCT ?? 80);

    const atConnectionCap = activeWsConnections >= maxConnections;
    const atMemoryCap     = heapPct >= heapThresholdPct;
    const draining        = atConnectionCap || atMemoryCap;

    // Overall: unhealthy if DB or cache is down, OR if instance is draining
    const healthy = dbOk && cacheOk && !draining;

    const status = !dbOk || !cacheOk ? 'DEGRADED'
                 : draining           ? 'DRAINING'
                 :                      'OK';

    res.status(healthy ? 200 : 503).json({
        status,
        db:               dbOk    ? 'OK' : 'ERROR',
        cache:            cacheOk ? 'OK' : 'ERROR',
        wsConnections:    activeWsConnections,
        wsMaxConnections: maxConnections,
        heapUsedMb:       Math.round(heapUsed / 1024 / 1024),
        heapLimitMb:      Math.round(heapLimit / 1024 / 1024),
        heapUsedPct:      heapPct,
        heapThresholdPct,
        draining,
        atConnectionCap,
        atMemoryCap,
        uptime:           process.uptime(),
        timestamp:        new Date().toISOString(),
        requestId:        req.id,
    });
});
app.get('/sentry-test', () => { throw new Error('Manual Sentry test - backend'); });

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        requestId: req.id,
    });
});


Sentry.setupExpressErrorHandler(app);


app.use(globalErrorHandler);
export default app;
