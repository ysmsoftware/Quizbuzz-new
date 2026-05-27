import { Router } from "express";
import { proctoringController } from "../../container";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

export const proctoringRouter = Router();

// All proctoring routes are admin-only
proctoringRouter.use(authenticatedOrgMiddleware);

// Get overview stats for a contest
proctoringRouter.get(
    "/contests/:contestId/overview", 
    proctoringController.getContestOverview
);

// List flagged participants
proctoringRouter.get(
    "/contests/:contestId/flagged", 
    proctoringController.getFlaggedParticipants
);

// List detailed events for a specific participant
proctoringRouter.get(
    "/contests/:contestId/participants/:participantId/events", 
    proctoringController.getParticipantEvents
);

// Dismiss or confirm a violation
proctoringRouter.patch(
    "/scores/:scoreId/status", 
    proctoringController.updateViolationStatus
);

// Admin-only: get snapshot captures (presigned read URLs) for a participant
proctoringRouter.get(
    "/contests/:contestId/participants/:participantId/captures",
    proctoringController.getParticipantCaptures
);
