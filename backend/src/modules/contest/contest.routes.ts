import { Router } from "express";
import { contestController, participantController } from "../../container";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";


export const contestRouter = Router();

contestRouter.post("/", authenticatedOrgMiddleware, contestController.createContest);
contestRouter.get("/", authenticatedOrgMiddleware, contestController.listContests);

contestRouter.post("/register/:contestSlug", contestController.registerParticipant);

// ─── Public Routes (no auth) ──────────────────────────────────────────────
contestRouter.get("/public", contestController.listPublicContests);
contestRouter.get("/public/:slug", contestController.getPublicContestBySlug);

contestRouter.get("/:contestId", authenticatedOrgMiddleware, contestController.getContest);
contestRouter.patch("/:contestId", authenticatedOrgMiddleware, contestController.updateContest);
contestRouter.delete("/:contestId", authenticatedOrgMiddleware, contestController.deleteContest);

contestRouter.post("/:contestId/publish", authenticatedOrgMiddleware, contestController.publishContest);


// ─── Participants (Admin) ─────────────────────────────────────────────────

contestRouter.get("/:contestId/participants", authenticatedOrgMiddleware, participantController.listParticipants);
contestRouter.get("/:contestId/participants/:participantId", authenticatedOrgMiddleware, participantController.getParticipantDetails);
contestRouter.patch("/:contestId/participants/:participantId/disqualify", authenticatedOrgMiddleware, participantController.disqualifyParticipant);

// ─── Evaluation & Results ─────────────────────────────────────────────────
contestRouter.post("/:contestId/evaluate", authenticatedOrgMiddleware, contestController.triggerEvaluation);
contestRouter.post("/:contestId/declare-results", authenticatedOrgMiddleware, contestController.declareResults);

// Public Leaderboard
contestRouter.get("/:contestId/leaderboard", contestController.getLeaderboard);

