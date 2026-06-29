import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

function ctrl() { return require("../../container").messagingController; }

export const messagingRouter = Router();

messagingRouter.get("/templates",                           authenticatedOrgMiddleware, (req, res, next) => ctrl().getTemplates(req, res, next));
messagingRouter.get("/:id",                                 authenticatedOrgMiddleware, (req, res, next) => ctrl().getMessageById(req, res, next));
messagingRouter.post("/send",                               authenticatedOrgMiddleware, (req, res, next) => ctrl().sendMessage(req, res, next));
messagingRouter.post("/:id/retry",                          authenticatedOrgMiddleware, (req, res, next) => ctrl().retryMessage(req, res, next));
messagingRouter.post("/retry-failed",                       authenticatedOrgMiddleware, (req, res, next) => ctrl().retryFailedMessages(req, res, next));
messagingRouter.get("/contact/:contactId",                  authenticatedOrgMiddleware, (req, res, next) => ctrl().getMessagesByContact(req, res, next));
messagingRouter.get("/contest/:contestId",                  authenticatedOrgMiddleware, (req, res, next) => ctrl().getMessagesByContest(req, res, next));
messagingRouter.get("/contest/:contestId/contact/:contactId", authenticatedOrgMiddleware, (req, res, next) => ctrl().getMessagesByContactInContest(req, res, next));
