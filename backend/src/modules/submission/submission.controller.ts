import { Request, Response, NextFunction } from "express";
import { SubmissionService } from "./submission.service";
import { ListSubmissionsFilter } from "./submission.types";
import {
    listSubmissionsSchema,
    invalidateSubmissionSchema,
    submitSubmissionSchema,
} from "./submission.validator";

export class SubmissionController {
    constructor(private readonly submissionService: SubmissionService) { }

    // ── Admin: single submission by ID ────────────────────────────────────────

    /**
     * GET /admin/submissions/:submissionId
     * Returns full detail — answers, scores, contact info.
     */
    getSubmissionById = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const submissionId = req.params.submissionId as string;
            const submission = await this.submissionService.getSubmissionById(
                organizationId,
                submissionId
            );
            res.status(200).json({ success: true, data: submission });
        } catch (err) {
            next(err);
        }
    };

    // ── Admin: all submissions for a contest ──────────────────────────────────

    /**
     * GET /admin/contests/:contestId/submissions
     * Paginated. Supports ?status=&search=&page=&limit=
     */
    getContestSubmissions = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const contestId = req.params.contestId as string;
            const filter: ListSubmissionsFilter = listSubmissionsSchema.parse(req.query ?? {});

            const result = await this.submissionService.getContestSubmissions(
                organizationId,
                contestId,
                filter
            );
            res.status(200).json({ success: true, ...result });
        } catch (err) {
            next(err);
        }
    };

    // ── Admin: status breakdown counts ────────────────────────────────────────

    /**
     * GET /admin/contests/:contestId/submissions/stats
     */
    getSubmissionStats = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const contestId = req.params.contestId as string;
            const stats = await this.submissionService.getSubmissionStats(organizationId, contestId);

            res.status(200).json({ success: true, data: stats });
        } catch (err) {
            next(err);
        }
    };

    // ── Admin: all submissions for a contact ──────────────────────────────────

    /**
     * GET /admin/contacts/:contactId/submissions
     * Cross-contest view — all submissions by this contact.
     */
    getContactSubmissions = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const contactId = req.params.contactId as string;
            const filter = listSubmissionsSchema.parse(req.query);

            const result = await this.submissionService.getContactSubmissions(
                organizationId,
                contactId,
                filter as any
            );
            res.status(200).json({ success: true, ...result });
        } catch (err) {
            next(err);
        }
    };

    // ── Admin: invalidate ─────────────────────────────────────────────────────

    /**
     * PATCH /admin/submissions/:submissionId/invalidate
     * Body: { reason: string }
     */
    invalidateSubmission = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const submissionId = req.params.submissionId as string;
            const { reason } = invalidateSubmissionSchema.parse(req.body);

            await this.submissionService.invalidateSubmission(organizationId, submissionId, reason);

            res.status(200).json({
                success: true,
                message: "Submission invalidated"
            });
        } catch (err) {
            next(err);
        }
    };

    // ── Admin: trigger evaluation for a whole contest ─────────────────────────

    /**
     * POST /admin/contests/:contestId/submissions/evaluate
     * Enqueues one evaluation job per SUBMITTED submission.
     * Idempotent — jobs with duplicate IDs are ignored by BullMQ.
     */
    triggerContestEvaluation = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const contestId = req.params.contestId as string;

            const result = await this.submissionService.triggerContestEvaluation(organizationId, contestId);

            res.status(202).json({
                success: true,
                message: `Evaluation queued for ${result.queued} submissions`,
                data: result,
            });
        } catch (err) {
            next(err);
        }
    };

    // ── Participant-facing ────────────────────────────────────────────────────

    /**
     * GET /submissions/me/:participantId
     * Participant reads their own result.
     * Auth: contactToken verified by route middleware.
     */
    getMySubmission = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const participantId = req.params.participantId as string;
            const submission = await this.submissionService.getMySubmission(participantId);

            res.status(200).json({ success: true, data: submission });

        } catch (err) {
            next(err);
        }
    };

    /**
     * POST /:contestId/submit
     * Manual REST-based submission for participants.
     */
    submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const contestId = req.params.contestId as string;
            const data = submitSubmissionSchema.parse(req.body);

            const result = await this.submissionService.submit(contestId, data);

            res.status(202).json({
                success: true,
                message: "Submission accepted",
                data: result
            });
        } catch (err) {
            next(err);
        }
    };
}
