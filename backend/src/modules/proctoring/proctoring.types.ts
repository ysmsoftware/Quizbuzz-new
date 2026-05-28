import { ProctoringEvent, ProctoringScore, ViolationType } from "@prisma/client";

export interface ProctoringEventRecord extends ProctoringEvent {
    metadata: any;
}

export interface ProctoringScoreRecord extends ProctoringScore {
    organization: {
        name: string;
    };
    participant?: {
        id: string;
        status: string;
        registrationRef: string;
        contact: {
            id: string;
            firstName: string;
            lastName: string;
            email: string;
            phone?: string | null;
        }
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
