import { Router } from "express";
import { participantController } from "../../container";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

export const participantRouter = Router();

// These routes are typically nested under /contests/:contestId/participants
// But we define them here for domain clarity

participantRouter.get(
    "/:contestId/participants",
    authenticatedOrgMiddleware,
    participantController.listParticipants
);

participantRouter.get(
    "/:contestId/participants/status-summary",
    authenticatedOrgMiddleware,
    participantController.getStatusSummary
);

participantRouter.post(
    "/:contestId/participants/bulk-status",
    authenticatedOrgMiddleware,
    participantController.bulkStatusOverride
);

participantRouter.get(
    "/:contestId/participants/:participantId",
    authenticatedOrgMiddleware,
    participantController.getParticipantDetails
);

participantRouter.patch(
    "/:contestId/participants/:participantId/disqualify",
    authenticatedOrgMiddleware,
    participantController.disqualifyParticipant
);

participantRouter.post(
    "/:contestId/participants/export",
    authenticatedOrgMiddleware,
    participantController.triggerExport
);

participantRouter.get(
    "/:contestId/participants/export/:exportId",
    authenticatedOrgMiddleware,
    participantController.getExportStatus
);
