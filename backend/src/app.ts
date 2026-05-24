import cookieParser from "cookie-parser";
import express from 'express';
import helmet from 'helmet';
import addRequestId from "express-request-id";
import cors from 'cors';
import morgan from 'morgan';
import logger, { morganStream } from "./config/logger";
import { prisma } from './config/db';

import { redis } from './config/redis';
import { globalErrorHandler } from "./middlewares/error.middleware";

import { config } from './config/index';

// Routes
import { apiRouter } from './routes';
import { paymentController } from "./container";
import { globalLimiter } from "./middlewares/rate-limit.js";

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

// Rate Limiting
// app.use('/api/v1', globalLimiter);

// Routes
app.use('/api/v1', apiRouter);

app.get('/health', async (req, res) => {
    const [db, cache] = await Promise.allSettled([
        prisma.$queryRaw`SELECT 1`,
        redis.ping(),
    ]);

    const healthy = db.status === 'fulfilled' && cache.status === 'fulfilled';

    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'OK' : 'DEGRADED',
        db: db.status === 'fulfilled' ? 'OK' : 'ERROR',
        cache: cache.status === 'fulfilled' ? 'OK' : 'ERROR',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        requestId: req.id,
    });
});


// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        requestId: req.id,
    });
});


app.use(globalErrorHandler);
export default app;
