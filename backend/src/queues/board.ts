import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { 
    submissionQueue, 
    evaluationQueue, 
    certificateQueue, 
    analyticsQueue, 
    messageQueue, 
    quizTimerQueue, 
    leaderboardQueue, 
    captureMetadataQueue 
} from './index';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/v1/queues');

createBullBoard({
    queues: [
        new BullMQAdapter(submissionQueue),
        new BullMQAdapter(evaluationQueue),
        new BullMQAdapter(certificateQueue),
        new BullMQAdapter(analyticsQueue),
        new BullMQAdapter(messageQueue),
        new BullMQAdapter(quizTimerQueue),
        new BullMQAdapter(leaderboardQueue),
        new BullMQAdapter(captureMetadataQueue),
    ],
    serverAdapter: serverAdapter,
});

export const bullBoardRouter = serverAdapter.getRouter();
