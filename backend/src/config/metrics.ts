import { Registry, collectDefaultMetrics, Gauge } from 'prom-client';
import {
    submissionQueue,
    evaluationQueue,
    certificateQueue,
    analyticsQueue,
    messageQueue,
    quizTimerQueue,
    leaderboardQueue,
    captureMetadataQueue,
} from '../queues';

// ── Registry ──────────────────────────────────────────────────────────────────
export const metricsRegistry = new Registry();

// ── Default Node.js metrics (heap, GC, event loop lag) ───────────────────────
collectDefaultMetrics({
    register: metricsRegistry,
    prefix: 'quizbuzz_',
});

// ── BullMQ Queue Gauges ───────────────────────────────────────────────────────
const queueWaiting = new Gauge({
    name: 'quizbuzz_queue_waiting',
    help: 'Number of waiting jobs in BullMQ queue',
    labelNames: ['queue'],
    registers: [metricsRegistry],
});

const queueActive = new Gauge({
    name: 'quizbuzz_queue_active',
    help: 'Number of active jobs in BullMQ queue',
    labelNames: ['queue'],
    registers: [metricsRegistry],
});

const queueFailed = new Gauge({
    name: 'quizbuzz_queue_failed',
    help: 'Number of failed jobs in BullMQ queue',
    labelNames: ['queue'],
    registers: [metricsRegistry],
});

const queueCompleted = new Gauge({
    name: 'quizbuzz_queue_completed',
    help: 'Number of completed jobs in BullMQ queue',
    labelNames: ['queue'],
    registers: [metricsRegistry],
});

// ── Socket.io Gauge ───────────────────────────────────────────────────────────
export const socketConnections = new Gauge({
    name: 'quizbuzz_socket_connections',
    help: 'Number of active Socket.io connections',
    registers: [metricsRegistry],
});

// ── Queue metrics collector ───────────────────────────────────────────────────
const queues = [
    { name: 'submission', queue: submissionQueue },
    { name: 'evaluation', queue: evaluationQueue },
    { name: 'certificate', queue: certificateQueue },
    { name: 'analytics', queue: analyticsQueue },
    { name: 'message', queue: messageQueue },
    { name: 'quiz-timer', queue: quizTimerQueue },
    { name: 'leaderboard', queue: leaderboardQueue },
    { name: 'capture-metadata', queue: captureMetadataQueue },
];

export async function collectQueueMetrics() {
    await Promise.all(
        queues.map(async ({ name, queue }) => {
            try {
                const [waiting, active, failed, completed] = await Promise.all([
                    queue.getWaitingCount(),
                    queue.getActiveCount(),
                    queue.getFailedCount(),
                    queue.getCompletedCount(),
                ]);
                queueWaiting.set({ queue: name }, waiting);
                queueActive.set({ queue: name }, active);
                queueFailed.set({ queue: name }, failed);
                queueCompleted.set({ queue: name }, completed);
            } catch (_) {}
        })
    );
}
