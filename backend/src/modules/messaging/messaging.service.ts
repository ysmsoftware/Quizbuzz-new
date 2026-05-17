import { MessagingRepository } from "./messaging.repository";
import { ContactMessageItem } from "../contact/contact.types";
import { ParticipantRepository } from "../participant/participant.repository";
import { SendMessageDTO, MessageLogResult, PaginatedMessagesResult } from "./messaging.types";
import { MessageChannel, MessageStatus } from "@prisma/client";
import { NotFoundError } from "../../error/http-errors";
import { messageQueue } from "../../queues";
import logger from "../../config/logger";

export class MessagingService {
    constructor(
        private readonly messagingRepo: MessagingRepository,
        private readonly participantRepo: ParticipantRepository
    ) { }

    async getMessageById(id: string, organizationId?: string): Promise<MessageLogResult> {
        const message = await this.messagingRepo.findById(id, organizationId);
        if (!message) throw new Error("Message not found");

        return {
            ...message,
            contest: message.contest ? { id: message.contest.id, title: message.contest.title } : undefined,
            contact: message.participant?.contact ? {
                id: message.participant.contact.id,
                firstName: message.participant.contact.firstName,
                lastName: message.participant.contact.lastName,
                email: message.participant.contact.email,
                phone: message.participant.contact.phone
            } : undefined
        } as MessageLogResult;
    }

    async getMessagesByContact(
        contactId: string,
        organizationId: string,
        page: number,
        limit: number
    ): Promise<{ data: ContactMessageItem[]; total: number; totalPages: number }> {
        const skip = (page - 1) * limit;

        // Resolve participant IDs for this contact first to avoid deep joins in repository
        const participantIds = await this.participantRepo.findIdsByContactId(contactId, organizationId);

        if (participantIds.length === 0) {
            return { data: [], total: 0, totalPages: 0 };
        }

        const [rows, total] = await Promise.all([
            this.messagingRepo.findByParticipantIds(participantIds, organizationId, skip, limit),
            this.messagingRepo.countByParticipantIds(participantIds, organizationId),
        ]);

        const data: ContactMessageItem[] = (rows as any[]).map((m) => ({
            id: m.id,
            channel: m.channel,
            template: m.template,
            status: m.status,
            recipient: m.recipient,
            sentAt: m.sentAt,
            contestId: m.contest?.id ?? null,
            contestTitle: m.contest?.title ?? null,
            createdAt: m.createdAt,
        }));

        return { data, total, totalPages: Math.ceil(total / limit) };
    }

    async getMessagesByContest(
        contestId: string,
        organizationId: string,
        page: number,
        limit: number
    ): Promise<PaginatedMessagesResult> {
        const skip = (page - 1) * limit;

        const [rows, total] = await Promise.all([
            this.messagingRepo.findByContestId(contestId, organizationId, skip, limit),
            this.messagingRepo.countByContestId(contestId, organizationId),
        ]);

        const data: MessageLogResult[] = (rows as any[]).map((m) => ({
            ...m,
            contact: m.participant?.contact ? {
                id: m.participant.contact.id,
                firstName: m.participant.contact.firstName,
                lastName: m.participant.contact.lastName,
                email: m.participant.contact.email,
                phone: m.participant.contact.phone
            } : undefined
        } as MessageLogResult));

        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getMessagesByContactInContest(
        contactId: string,
        contestId: string,
        organizationId: string,
        page: number,
        limit: number
    ): Promise<PaginatedMessagesResult> {
        const skip = (page - 1) * limit;

        const [rows, total] = await Promise.all([
            this.messagingRepo.findByContactAndContest(contactId, contestId, organizationId, skip, limit),
            this.messagingRepo.countByContactAndContest(contactId, contestId, organizationId),
        ]);

        const data: MessageLogResult[] = (rows as any[]).map((m) => ({
            ...m,
            contest: m.contest ? { id: m.contest.id, title: m.contest.title } : undefined
        } as MessageLogResult));

        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async sendMessage(dto: SendMessageDTO, organizationId: string): Promise<MessageLogResult> {
        let participantId = dto.participantId;

        // If participantId not provided, try to find it via contactId + contestId
        if (!participantId && dto.contactId && dto.contestId) {
            participantId = await this.participantRepo.findIdByContactAndContest(dto.contactId, dto.contestId, organizationId) || undefined;
        }

        const message = await this.messagingRepo.create({
            organization: { connect: { id: organizationId } },
            ...(participantId ? { participant: { connect: { id: participantId } } } : {}),
            ...(dto.contestId ? { contest: { connect: { id: dto.contestId } } } : {}),
            channel: dto.channel,
            template: dto.template,
            recipient: dto.recipient,
            subject: dto.subject ?? null,
            body: dto.body ?? null,
            params: (dto.parameters as any) ?? null,
            metadata: (dto.parameters as any) ?? null,
            status: "QUEUED"
        });

        // Enqueue for async processing by the message worker
        await messageQueue.add('send-message', { messageLogId: message.id }, {
            jobId: message.id,
        });

        logger.info(`[messaging] Enqueued send-message job for messageLog ${message.id}`);

        return message as any;
    }

    async retryMessage(messageId: string, organizationId: string): Promise<MessageLogResult> {
        const message = await this.messagingRepo.findById(messageId, organizationId);
        if (!message) throw new Error("Message not found");

        // Can only retry if it's FAILED
        if (message.status !== "FAILED") {
            throw new Error(`Cannot retry message with status ${message.status}. Only FAILED messages can be retried.`);
        }

        const updated = await this.messagingRepo.updateStatus(messageId, "QUEUED", {
            retryCount: { increment: 1 }
        });

        // Re-enqueue for processing
        await messageQueue.add('send-message', { messageLogId: messageId }, {
            jobId: `retry-${messageId}-${Date.now()}`,
        });

        logger.info(`[messaging] Enqueued retry job for messageLog ${messageId}`);

        return updated as any;
    }

    async retryFailedMessages(organizationId: string): Promise<{ count: number }> {
        const failedMessages = await this.messagingRepo.findFailedMessages(organizationId);

        for (const msg of failedMessages) {
            await this.messagingRepo.updateStatus(msg.id, "QUEUED", {
                retryCount: { increment: 1 }
            });

            // Re-enqueue each failed message
            await messageQueue.add('send-message', { messageLogId: msg.id }, {
                jobId: `retry-${msg.id}-${Date.now()}`,
            });
        }

        logger.info(`[messaging] Enqueued ${failedMessages.length} retry jobs for org ${organizationId}`);

        return { count: failedMessages.length };
    }

    // ─── Convenience method — used by other services to create + enqueue in one call ──

    /**
     * Creates a MessageLog record and enqueues it for async delivery.
     * This is the primary method other services should use to send messages.
     *
     * @param organizationId - The org scope for the message
     * @param opts - Message details (channel defaults to EMAIL)
     */
    async enqueueMessage(
        organizationId: string,
        opts: {
            participantId?: string;
            contestId?: string;
            channel?: MessageChannel;
            template: string;
            recipient: string;
            subject?: string;
            params?: Record<string, string>;
        }
    ): Promise<void> {
        await this.sendMessage({
            participantId: opts.participantId,
            contestId: opts.contestId,
            channel: opts.channel ?? "EMAIL",
            template: opts.template as any,
            recipient: opts.recipient,
            subject: opts.subject,
            parameters: opts.params,
        }, organizationId);
    }

    /**
     * Internal method for workers to update status during processing.
     * Enforces state transitions.
     */
    async updateMessageStatus(id: string, status: MessageStatus,  additionalData: any = {}) {
        return this.messagingRepo.updateStatus(id, status, additionalData);
    }

    async incrementAttempt(id: string) {
        const message = await this.messagingRepo.findById(id);
        if (!message) {
            throw new NotFoundError("Message not found");
        }

        await this.messagingRepo.incrementAttempt(id);
    }
}
