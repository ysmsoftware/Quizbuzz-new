import { ProctoringEvent, ProctoringScore, ViolationType } from "@prisma/client";

export interface ProctoringEventRecord extends ProctoringEvent {
    metadata: any;
}

export interface ProctoringScoreRecord extends ProctoringScore {
    organization: {
        name: string;
    };
}

export interface ProctoringOverview {
    totalEvents: number;
    flaggedParticipants: number;
    eventsByType: Record<ViolationType | string, number>;
}

export interface UpdateViolationStatusInput {
    isDismissed: boolean;
    adminNotes?: string;
}

export interface ProctoringPaginationOptions {
    page: number;
    limit: number;
    type?: ViolationType | undefined;
    isFlagged?: boolean | undefined;
}
