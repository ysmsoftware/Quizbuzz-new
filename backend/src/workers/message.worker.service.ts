import { MessageTemplate } from "../types/message-template.enum";
import logger from "../config/logger";
import { MessagingService } from "../modules/messaging/messaging.service";
import { MessageProvider } from "../providers/message.provider";
import { TemplateParamsMap } from "../types/message-template";
import { prisma } from "../config/db";
import { config } from "../config";


export class MessageWorkerService {

    constructor(private messageService: MessagingService) { }

    async process(messageLogId: string) {
        const log = await this.messageService.getMessageById(messageLogId)

        if (!log) {
            throw new Error("Message log not found");
        }
        if (log.status === "SENT") {
            return;
        }

        const provider = MessageProvider.getProvider(log.channel);

        // Resolve destination — fall back to log.recipient for admin/system
        // messages that don't have an associated participant/contact.
        const destination = log.channel === "EMAIL"
            ? (log.contact?.email ?? log.recipient)
            : (log.contact?.phone ?? log.recipient);

        if (!destination) {
            throw new Error("Destination is missing");
        }

        try {
            await this.messageService.updateMessageStatus(log.id, "PROCESSING");

            logger.info("Sending message", {
                messageLogId: log.id,
                channel: log.channel,
                template: log.template,
                destination: destination,
                params: log.params,
            });

            const response = await provider.send(
                log.template as MessageTemplate,
                destination,
                log.params as unknown as TemplateParamsMap[MessageTemplate],
            );

            await this.messageService.updateMessageStatus(log.id, "SENT", {
                providerMsgId: (response as any)?.messageId ?? null,
                sentAt: new Date(),
                metadata: response ?? null,
            });


        } catch (error) {
            const errMessage = (error as Error).message;

            logger.error(`[message-worker] Failed to send message ${log.id}: ${errMessage}`);

            await this.messageService.incrementAttempt(log.id);

            // Mark as FAILED on the last attempt so the admin can see it
            if (Number(log.attemptCount) + 1 >= 3) {
                await this.messageService.updateMessageStatus(log.id, "FAILED", {
                    failureReason: errMessage,
                });
            }

            // Rethrow so BullMQ knows the job failed and its failed event fires.
            // Without this, BullMQ treats a silently-caught error as a successful completion.
            throw error;
        }
    }

    /**
     * Fan-out handler for bulk notifications (reminders, results published, etc.)
     * Fetches all participants for a contest and creates individual send-message jobs.
     */
    async processBulkNotify(data: { contestId: string; organizationId: string; template: string; contestSlug?: string }) {
        const { contestId, organizationId, template } = data;

        logger.info(`[message-worker] Starting bulk-notify: template=${template} contest=${contestId}`);

        // Fetch contest with all fields needed for template params
        const contest = await prisma.contest.findFirst({
            where: { id: contestId, organizationId },
            select: { title: true, startTime: true, slug: true, joinCode: true },
        });

        if (!contest) {
            logger.error(`[message-worker] Contest ${contestId} not found for bulk-notify`);
            return;
        }

        const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || config.app.frontendUrl || 'https://quizbuzz.in';
        const isResultsTemplate = template === 'RESULTS_PUBLISHED';

        // Fetch all registered participants with their contact info
        const participants = await prisma.participant.findMany({
            where: { contestId, organizationId },
            include: {
                contact: { select: { id: true, firstName: true, email: true } },
            },
        });

        logger.info(`[message-worker] Found ${participants.length} participants for bulk-notify`);

        let enqueued = 0;
        for (const p of participants) {
            if (!p.contact?.email) continue;

            try {
                await this.messageService.enqueueMessage(organizationId, {
                    participantId: p.id,
                    contestId,
                    channel: "EMAIL",
                    template,
                    recipient: p.contact.email,
                    params: {
                        name: p.contact.firstName,
                        eventName: contest.title,
                        date: contest.startTime
                            ? new Date(contest.startTime).toLocaleDateString('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' })
                            : 'TBD',
                        time: contest.startTime
                            ? new Date(contest.startTime).toLocaleTimeString('en-IN', { timeStyle: 'short', timeZone: 'Asia/Kolkata' })
                            : 'TBD',
                        // Results: link to public leaderboard. Reminder/confirmation: link to contest page.
                        link: isResultsTemplate
                            ? `${appUrl}/quiz/${contest.slug}/results`
                            : `${appUrl}/contests/${contest.slug}`,
                        joinCode: contest.joinCode ?? 'To be revealed on contest day',
                    },
                });
                enqueued++;
            } catch (err) {
                logger.error(`[message-worker] Failed to enqueue for participant ${p.id}: ${(err as Error).message}`);
            }
        }

        logger.info(`[message-worker] Bulk-notify complete: ${enqueued}/${participants.length} enqueued`);
    }

}