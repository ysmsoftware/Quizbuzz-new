import { Router } from "express";
import { messagingController } from "../../container";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

export const messagingRouter = Router();

// Admin Message Management Routes
messagingRouter.get("/templates", authenticatedOrgMiddleware, messagingController.getTemplates);
messagingRouter.get("/:id", authenticatedOrgMiddleware, messagingController.getMessageById);
messagingRouter.post("/send", authenticatedOrgMiddleware, messagingController.sendMessage);
messagingRouter.post("/:id/retry", authenticatedOrgMiddleware, messagingController.retryMessage);
messagingRouter.post("/retry-failed", authenticatedOrgMiddleware, messagingController.retryFailedMessages);

// Messages by entity
messagingRouter.get("/contact/:contactId", authenticatedOrgMiddleware, messagingController.getMessagesByContact);
messagingRouter.get("/contest/:contestId", authenticatedOrgMiddleware, messagingController.getMessagesByContest);
messagingRouter.get("/contest/:contestId/contact/:contactId", authenticatedOrgMiddleware, messagingController.getMessagesByContactInContest);
