import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { ContestService } from "./contest.service";
import {
    CreateContestSchema,
    UpdateContestSchema,
    UpdateContestCertificateTemplateSchema,
    ListContestsQuerySchema,
    RegisterParticipantSchema,
    RegisterStatusSchema,
    CancelContestSchema,
    RescheduleContestSchema,
    ForceEndContestSchema,
    StartContestNowSchema,
    RequestPrizeRewardImageUploadUrlSchema,
    DisqualifyParticipantSchema,
} from "./contest.validator";
import { UnauthorizedError, BadRequestError } from "../../error/http-errors";
import { storageService } from "../../services/storage.service";
import { getStorageProvider } from "../../providers/storage.provider";

// Presigned-PUT-URL flow (see ambassador-campaign.service.ts's getPosterUploadUrl) — a
// separate singleton from storageService above, which is the older base64-body upload
// path uploadBanner() below still uses. Constructed here directly (not via container.ts)
// to avoid a circular import: container.ts itself imports ContestController.
const storageProvider = getStorageProvider();

export class ContestController {
    constructor(private readonly contestService: ContestService) { }

    // ─── Contest CRUD ─────────────────────────────────────────────────────────

    createContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const data = CreateContestSchema.parse(req.body);

            const contest = await this.contestService.createContest(
                user.organizationId,
                user.id,
                data
            );

            res.status(201).json({
                success: true,
                message: "Contest created",
                data: {
                    id: contest.id,
                    slug: contest.slug,
                    status: contest.status,
                    joinCode: contest.joinCode,
                },
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    listContests = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            const query = ListContestsQuerySchema.parse(req.query);

            const contests = await this.contestService.listContests(user.organizationId, query);

            res.status(200).json({ success: true, data: contests, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    listArchivedContests = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            const query = ListContestsQuerySchema.parse(req.query);

            const contests = await this.contestService.listArchivedContests(user.organizationId, query);

            res.status(200).json({ success: true, data: contests, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            const contest = await this.contestService.getContest(
                req.params.contestId as string,
                user.organizationId
            );

            res.status(200).json({ success: true, data: contest, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    updateContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            const data = UpdateContestSchema.parse(req.body);

            const contest = await this.contestService.updateContest(
                req.params.contestId as string,
                user.organizationId,
                data
            );

            res.status(200).json({ success: true, data: contest, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    updateContestCertificateTemplate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            const { certificateTemplateId } = UpdateContestCertificateTemplateSchema.parse(req.body);

            const contest = await this.contestService.updateContestCertificateTemplate(
                req.params.contestId as string,
                user.organizationId,
                certificateTemplateId
            );

            res.status(200).json({ success: true, data: contest, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    publishContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            const result = await this.contestService.publishContest(
                req.params.contestId as string,
                user.organizationId
            );

            res.json({ success: true, message: "Contest published", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // ─── Lifecycle operations ─────────────────────────────────────────────────

    rescheduleContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const data = RescheduleContestSchema.parse(req.body);

            const contest = await this.contestService.rescheduleContest(
                req.params.contestId as string,
                user.organizationId,
                data,
            );

            res.status(200).json({ success: true, message: "Contest rescheduled", data: contest, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    cancelContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const data = CancelContestSchema.parse(req.body);

            const result = await this.contestService.cancelContest(
                req.params.contestId as string,
                user.organizationId,
                data,
            );

            res.status(200).json({ success: true, message: "Contest cancelled", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    forceEndContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const data = ForceEndContestSchema.parse(req.body ?? {});

            const result = await this.contestService.forceEndContest(
                req.params.contestId as string,
                user.organizationId,
                data,
            );

            res.status(200).json({ success: true, message: "Contest ended", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    startContestNow = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            StartContestNowSchema.parse(req.body ?? {});

            const result = await this.contestService.startContestNow(
                req.params.contestId as string,
                user.organizationId,
            );

            res.status(200).json({ success: true, message: "Contest started", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    closeRegistration = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            const result = await this.contestService.closeRegistration(
                req.params.contestId as string,
                user.organizationId
            );

            res.json({ success: true, message: "Registration closed", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    deleteContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            await this.contestService.deleteContest(req.params.contestId as string, user.organizationId);

            res.json({ success: true, message: "Contest deleted", requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    archiveContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            await this.contestService.archiveContest(req.params.contestId as string, user.organizationId);

            res.json({ success: true, message: "Contest archived", requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // ─── Public Routes (no auth) ──────────────────────────────────────────────

    listPublicContests = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { search, page, limit } = req.query;
            const result = await this.contestService.listPublicContests({
                search: search as string,
                page: page ? parseInt(page as string) : 1,
                limit: limit ? Math.min(parseInt(limit as string), 50) : 20,
            });
            res.json({ success: true, data: result });
        } catch (err) {
            next(err);
        }
    };

    getPublicContestBySlug = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const slug = req.params.slug as string;
            // Ambassador referral links append ?ref=<code> — resolved server-side into a
            // campaign-specific WhatsApp/social link-preview (poster image + campaign name)
            // when it's a valid, approved, live enrollment; see getPublicContestBySlug.
            const ref = typeof req.query.ref === "string" ? req.query.ref : undefined;
            const contest = await this.contestService.getPublicContestBySlug(slug, ref);
            res.json({ success: true, data: contest });
        } catch (err) {
            next(err);
        }
    };

    // ─── Registration (Public) ────────────────────────────────────────────────

    registerParticipant = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = RegisterParticipantSchema.parse(req.body);
            const result = await this.contestService.registerParticipant(
                req.params.contestSlug as string,
                dto
            );

            res.status(201).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getRegisterStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = RegisterStatusSchema.parse(req.body);
            const result = await this.contestService.getRegisterStatus(
                req.params.contestSlug as string,
                dto.contactToken,
                dto.phone
            );

            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // ─── Evaluation & Results ─────────────────────────────────────────────────

    triggerEvaluation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const result = await this.contestService.triggerEvaluation(
                req.params.contestId as string,
                user.organizationId
            );

            res.json({ success: true, message: "Evaluation triggered", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    disqualifyParticipant = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const { reason } = DisqualifyParticipantSchema.parse(req.body);

            await this.contestService.disqualifyParticipant(
                req.params.contestId as string,
                user.organizationId,
                req.params.participantId as string,
                reason
            );

            res.json({ success: true, message: "Participant disqualified", requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    declareResults = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const result = await this.contestService.declareResults(
                req.params.contestId as string,
                user.organizationId
            );

            res.json({ success: true, message: "Results declared", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getResultsDeclarationInfo = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const result = await this.contestService.getResultsDeclarationInfo(
                req.params.contestId as string,
                user.organizationId
            );

            res.json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const contestId = req.params.contestId as string;
            const organizationId = req.user?.organizationId ?? "";

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;

            const result = await this.contestService.getLeaderboard(
                contestId,
                organizationId,
                page,
                limit
            );

            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getAdminLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const contestId = req.params.contestId as string;
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;

            const result = await this.contestService.getAdminLeaderboard(
                contestId,
                user.organizationId,
                page,
                limit
            );

            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    uploadBanner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const { fileData, fileName } = req.body;
            if (!fileData || !fileName) {
                throw new BadRequestError("File data and file name are required.");
            }

            // Extract base64 content
            // Data URL format: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
            const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            let buffer: Buffer;
            let contentType: string;

            if (matches && matches.length === 3) {
                contentType = matches[1];
                buffer = Buffer.from(matches[2], "base64");
            } else {
                // Try decoding direct base64
                contentType = "image/png"; // default
                buffer = Buffer.from(fileData, "base64");
            }

            const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
            const key = `banners/${user.organizationId}/${Date.now()}_${cleanFileName}`;

            const uploadResult = await storageService.upload(key, buffer, contentType);

            res.status(200).json({
                success: true,
                message: "Banner uploaded successfully",
                data: {
                    url: uploadResult.url,
                    key: uploadResult.key
                },
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    // Presigned-PUT-URL flow for a prize goodie image (see ambassador-campaign.service.ts's
    // getPosterUploadUrl) — the frontend PUTs the raw file straight to storage with the
    // returned `url`, then strips the query string off it to get the permanent object URL.
    getPrizeRewardImageUploadUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const dto = RequestPrizeRewardImageUploadUrlSchema.parse(req.body);
            if (!dto.mimeType.startsWith("image/")) {
                throw new BadRequestError("File must be an image.");
            }

            const folder = `contest-prize-reward-image/${user.organizationId}/${crypto.randomUUID()}`;
            const result = await storageProvider.getPresignedPutUrl({
                filename: dto.filename,
                folder,
                mimeType: dto.mimeType,
                expiresInSeconds: 300,
            });

            res.status(200).json({
                success: true,
                message: "Upload URL generated successfully",
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };
}