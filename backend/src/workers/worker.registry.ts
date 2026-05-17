import logger from '../config/logger';
import { Worker } from './worker.interface';

class WorkerRegistry {
    private workers: Worker[] = [];

    register(worker: Worker) {
        this.workers.push(worker);
        logger.info(`Worker registered: ${worker.name}`);
    }


    startAll() {
        logger.info(`Starting ${this.workers.length} workers...`);

        for(const worker of this.workers) {
            try{
                worker.start();
                logger.info(`Worker started: ${worker.name}`);
            } catch(error) {
                logger.error(`Worker failed to start: ${worker.name}`, error);
            }
        }
    }
}

export const workerRegistry = new WorkerRegistry();