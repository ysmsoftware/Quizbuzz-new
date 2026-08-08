import { AppError } from "./app-error";

export class BadRequestError extends AppError {
    constructor(message = "Bad request") {
        super(message, 400);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized") {
        super(message, 401);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Resource not found") {
        super(message, 404);
    }
}

export class ConflictError extends AppError {
    constructor(message = "Conflict") {
        super(message, 409);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "Forbidden") {
        super(message, 403);
    }
}

export class UnprocessableEntityError extends AppError {
    constructor(message = "Unprocessable entity") {
        super(message, 422);
    }
}

/**
 * Thrown by src/common/plan-entitlements.ts whenever an organization's
 * subscription plan limit would be exceeded (contests/cycle, participants/contest,
 * questions/contest, org members). Kept distinct from ForbiddenError so the error
 * middleware and the frontend can special-case it (e.g. show an "Upgrade plan" CTA)
 * instead of a generic 403 message.
 */
export type PlanLimitType =
    | "contestsPerCycle"
    | "participantsPerContest"
    | "questionsPerContest"
    | "orgMembers";

export class PlanLimitExceededError extends AppError {
    constructor(
        public readonly limitType: PlanLimitType,
        public readonly limit: number,
        public readonly current: number,
        message?: string,
    ) {
        super(message ?? PlanLimitExceededError.defaultMessage(limitType, limit), 403);
    }

    private static defaultMessage(limitType: PlanLimitType, limit: number): string {
        switch (limitType) {
            case "contestsPerCycle":
                return `Your plan allows a maximum of ${limit} contest(s) per billing cycle. Upgrade your plan to create more.`;
            case "participantsPerContest":
                return `Your plan allows a maximum of ${limit} participant(s) per contest. Upgrade your plan to allow more registrations.`;
            case "questionsPerContest":
                return `Your plan allows a maximum of ${limit} question(s) per contest. Upgrade your plan to add more.`;
            case "orgMembers":
                return `Your plan allows a maximum of ${limit} organization member(s). Upgrade your plan to invite more.`;
        }
    }
}