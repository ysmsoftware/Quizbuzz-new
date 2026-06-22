import { Router } from "express";
import { submissionController } from "../../container";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";
import { idempotency } from "../../middlewares/idempotency.middleware";

export const submissionRouter = Router();

// ─── Admin routes (org-scoped, JWT required) ──────────────────────────────────

/**
 * GET /admin/contests/:contestId/submissions
 * List all submissions for a contest — paginated, filterable.
 */
submissionRouter.get("/admin/contests/:contestId/submissions", authenticatedOrgMiddleware, submissionController.getContestSubmissions);

/**
 * GET /admin/contests/:contestId/submissions/stats
 * Status breakdown counts — PENDING / SUBMITTED / EVALUATED / INVALIDATED.
 * NOTE: declared BEFORE /:submissionId so Express doesn't match "stats" as an ID.
 */
submissionRouter.get("/admin/contests/:contestId/submissions/stats", authenticatedOrgMiddleware, submissionController.getSubmissionStats);

/**
 * POST /admin/contests/:contestId/submissions/evaluate
 * Trigger bulk evaluation — enqueues one job per SUBMITTED submission.
 */
submissionRouter.post("/admin/contests/:contestId/submissions/evaluate", authenticatedOrgMiddleware, submissionController.triggerContestEvaluation);

/**
 * GET /admin/submissions/:submissionId
 * Full detail for a single submission — answers, scores, contact info.
 */
submissionRouter.get("/admin/submissions/:submissionId", authenticatedOrgMiddleware, submissionController.getSubmissionById);

/**
 * PATCH /admin/submissions/:submissionId/invalidate
 * Manually invalidate a submission (post-disqualification or admin override).
 */
submissionRouter.patch("/admin/submissions/:submissionId/invalidate", authenticatedOrgMiddleware, submissionController.invalidateSubmission);

/**
 * GET /admin/contacts/:contactId/submissions
 * All submissions for a contact across all contests — admin contact profile.
 */
submissionRouter.get("/admin/contacts/:contactId/submissions", authenticatedOrgMiddleware, submissionController.getContactSubmissions);

// ─── Participant-facing route (contactToken auth) ─────────────────────────────

/**
 * POST /:contestId/submit
 * Manual submission for participants — idempotent.
 */
submissionRouter.post("/:contestId/submit", idempotency, submissionController.submit);

/**
 * GET /submission/:participantId
 */

submissionRouter.get("/submission/:participantId", submissionController.getMySubmission);

