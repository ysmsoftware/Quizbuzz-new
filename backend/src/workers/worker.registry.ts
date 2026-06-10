import * as Sentry from "@sentry/node";
import logger from '../config/logger';
import { Worker } from './worker.interface';

class WorkerRegistry {
    private workers: Worker[] = [];

    register(worker: Worker) {
        if (this.workers.some((w) => w.name === worker.name)) {
            logger.warn(`Worker already registered, skipping: ${worker.name}`);
            return;
        }
        this.workers.push(worker);
        logger.info(`Worker registered: ${worker.name}`);
    }


    startAll() {
        logger.info(`Starting ${this.workers.length} workers...`);

        for (const worker of this.workers) {
            try {
                worker.start();
                logger.info(`Worker started: ${worker.name}`);
            } catch (error) {
                Sentry.captureException(error, {
                    tags: { worker: worker.name },
                    extra: { phase: "startup" },
                });
                logger.error(`Worker failed to start: ${worker.name}`, error);
            }
        }
    }
}

export const workerRegistry = new WorkerRegistry();