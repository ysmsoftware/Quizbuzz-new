import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";
import { idempotency } from "../../middlewares/idempotency.middleware";

function ctrl() { return require("../../container").submissionController; }

export const submissionRouter = Router();

// Admin routes (org-scoped, JWT required)
submissionRouter.get("/admin/contests/:contestId/submissions",         authenticatedOrgMiddleware, (req, res, next) => ctrl().getContestSubmissions(req, res, next));
submissionRouter.get("/admin/contests/:contestId/submissions/stats",   authenticatedOrgMiddleware, (req, res, next) => ctrl().getSubmissionStats(req, res, next));
submissionRouter.post("/admin/contests/:contestId/submissions/evaluate", authenticatedOrgMiddleware, (req, res, next) => ctrl().triggerContestEvaluation(req, res, next));
submissionRouter.get("/admin/submissions/:submissionId",               authenticatedOrgMiddleware, (req, res, next) => ctrl().getSubmissionById(req, res, next));
submissionRouter.patch("/admin/submissions/:submissionId/invalidate",  authenticatedOrgMiddleware, (req, res, next) => ctrl().invalidateSubmission(req, res, next));
submissionRouter.get("/admin/contacts/:contactId/submissions",         authenticatedOrgMiddleware, (req, res, next) => ctrl().getContactSubmissions(req, res, next));

// Participant-facing routes
submissionRouter.post("/:contestId/submit", idempotency, (req, res, next) => ctrl().submit(req, res, next));
submissionRouter.get("/submissions/me/:participantId",    (req, res, next) => ctrl().getMySubmission(req, res, next));
