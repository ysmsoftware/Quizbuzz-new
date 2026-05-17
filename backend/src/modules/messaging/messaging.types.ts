import { MessageChannel, MessageTemplate, MessageStatus } from "@prisma/client";

export interface SendMessageDTO {
    participantId?: string | undefined;
    contactId?: string | undefined;
    contestId?: string | undefined;
    channel: MessageChannel;
    template: MessageTemplate;
    recipient: string;
    subject?: string | undefined;
    body?: string | undefined;
    parameters?: Record<string, string> | undefined;
}

export interface MessageLogResult {
    id: string;
    participantId: string | null;
    contestId: string | null;
    channel: MessageChannel;
    template: MessageTemplate;
    params: JSON | null;
    status: MessageStatus;
    recipient: string;
    subject: string | null;
    body: string | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
    attemptCount: Number;
    createdAt: Date;
    updatedAt: Date;
    contest?: {
        id: string;
        title: string;
    };
    contact?: {
        id: string;
        firstName: string;
        lastName: string | null;
        email: string;
        phone: string | null;
    };
}

export interface PaginatedMessagesResult {
    data: MessageLogResult[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
