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

/**
 * Thrown by any call site gated on isFeatureEnabled() (src/common/feature-flags.ts)
 * when a flag resolves to false — global kill-switch or a per-org override turning
 * a feature off. Kept distinct from ForbiddenError, same reasoning as
 * PlanLimitExceededError above: the product owner was explicit that turning a
 * feature off must never be a silent no-op, so the frontend needs a single
 * recognizable FEATURE_DISABLED code to render one consistent "unavailable"
 * state instead of every call site inventing its own copy.
 */
export class FeatureUnavailableError extends AppError {
    constructor(
        public readonly featureKey: string,
        message = "This feature is currently unavailable.",
    ) {
        super(message, 403);
    }
}

export class AmbassadorApplicationExistsError extends ConflictError {
    constructor(public readonly email: string) {
        super(`An ambassador application for "${email}" already exists for this organization.`);
    }
}

export class InvalidApplicationDataError extends BadRequestError {
    constructor(public readonly violations: { field: string; issue: string }[]) {
        super("One or more required fields are missing or invalid.");
    }
}