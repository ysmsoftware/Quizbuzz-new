import { ContestStatus, ParticipantStatus, SubmissionStatus } from "@prisma/client";
import { OrganizationRepository } from "../organization/organization.repository";
import { ContestRepository } from "./contest.repository";
import { prisma } from "../../config/db";
import { ParticipantService } from "../participant/participant.service";
import { LeaderboardRepository } from "./leaderboard.repository";
import { MessagingService } from "../messaging/messaging.service";
import { SubmissionService } from "../submission/submission.service";
import { QuizSchedulerService } from "../quiz/quiz-scheduler.service";
import {
    CreateContestInput,
    UpdateContestInput,
    RegisterParticipantInput,
    RescheduleContestInput,
    CancelContestInput,
    ForceEndContestInput,
    TIMING_FIELDS,
} from "./contest.validator";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, FeatureUnavailableError } from "../../error/http-errors";
import { isFeatureEnabled } from "../../common/feature-flags";
import { createSlug, generateRandomString } from "../../utils/slug";
import { generateRegistrationRef } from "../../utils/ref";
import { config } from "../../config";
// Plan-limit enforcement (contests/cycle, participants/contest) now runs as
// middleware ahead of these routes — see src/middlewares/plan-limit.middleware.ts.
// This service no longer calls src/common/plan-entitlements.ts directly.
import { verifyContactToken } from "../../utils/tokens";
import { formatDateHuman, formatDateTimeHuman, formatTimeHuman } from "../../utils/timezone";
import { ContactService } from "../contact/contact.service";
import { UpdateContactDTO } from "../contact/contact.types";
import { CreateContestDTO, ListContestsFilter } from "./contest.types";
import { invalidateContestScoringConfigCache } from "../question/scoring-config.cache";
import { MessageTemplate } from "../../types/message-template.enum";
import { messageQueue, quizTimerQueue, contestReconciliationQueue } from "../../queues";
import { rankRows } from "../../workers/leaderboard.worker";
import { logAudit } from "../../common/audit-log";
import logger from "../../config/logger";


import { IParticipantRepository } from "../participant/participant.repository";
import { IPaymentRepository } from "../payment/payment.repository";
import { AmbassadorCampaignRepository } from "../ambassador-campaign/ambassador-campaign.repository";

/**
 * The slice of the socket gateway this service depends on — announcing lifecycle
 * changes to participants already connected to a contest room.
 *
 * Declared as its own port rather than taking QuizGateway directly: the gateway
 * depends on QuizService, so a direct dependency would create an import cycle, and
 * ContestService has no business knowing about sockets, rooms or namespaces.
 * Bound in container.ts via setBroadcaster(), mirroring injectTimerWorkerDeps().
 */
export interface IContestBroadcaster {
    emitContestRescheduled(contestId: string, payload: { startTime: string; endTime: string; reason?: string }): void;
    emitContestCancelled(contestId: string, payload: { reason: string }): void;
}

/**
 * The slice of quiz runtime + gateway behaviour force-end needs. Same reasoning as
 * IContestBroadcaster — force-end reuses the AUTO_SUBMIT path rather than
 * reimplementing submission logic.
 */
export interface IContestQuizTerminator {
    handleTimeExpiry(contestId: string): Promise<{ submitted: string[]; errors: Array<{ participantId: string; error: string }> }>;
    emitAutoSubmit(participantId: string, contestId: string, reason: string): Promise<void>;
}

/**
 * The slice of quiz runtime + gateway behaviour CONTEST_START needs. Same reasoning
 * as IContestQuizTerminator — shared by the scheduled quiz-timer job and the manual
 * "Start Now" override so the two start sequences can never diverge.
 */
export interface IContestQuizStarter {
    transitionToQuiz(contestId: string): Promise<{ transitioned: string[]; blocked: string[] }>;
    handleRejoin(contestId: string, participantId: string): Promise<{ contactId?: string } | null>;
    startQuizForParticipant(participantId: string, contestId: string, organizationId: string, contactId: string): Promise<void>;
    broadcastAdminEvent(contestId: string, event: string, data: unknown): void;
}

export class ContestService {
    constructor(
        private readonly orgRepo: OrganizationRepository,
        private readonly contestRepo: ContestRepository,
        private readonly participantService: ParticipantService,
        private readonly leaderboardRepo: LeaderboardRepository,
        private readonly contactService: ContactService,
        private readonly messagingService: MessagingService,
        private readonly submissionService: SubmissionService,
        private readonly schedulerService: QuizSchedulerService,
        private readonly participantRepo?: IParticipantRepository,
        private readonly paymentRepo?: IPaymentRepository,
        private readonly ambassadorCampaignRepo?: AmbassadorCampaignRepository,
    ) { }

    // ─── Late-bound collaborators (see IContestBroadcaster) ───────────────────
    private broadcaster?: IContestBroadcaster;
    private quizTerminator?: IContestQuizTerminator;
    private quizStarter?: IContestQuizStarter;

    setBroadcaster(broadcaster: IContestBroadcaster): void {
        this.broadcaster = broadcaster;
    }

    setQuizTerminator(terminator: IContestQuizTerminator): void {
        this.quizTerminator = terminator;
    }

    setQuizStarter(starter: IContestQuizStarter): void {
        this.quizStarter = starter;
    }

    // ─── Contest CRUD ─────────────────────────────────────────────────────────

    async createContest(organizationId: string, createdById: string, input: CreateContestInput) {
        const registrationDeadline = new Date(input.registrationDeadline);
        const startTime = new Date(input.startTime);
        const endTime = new Date(startTime.getTime() + input.duration * 60 * 1000);

        const org = await this.orgRepo.findById(organizationId);

        if (!org?.isActive) {
            throw new ForbiddenError("Organization is not active, and cannot create contests");
        }

        // Plan enforcement (contests-per-cycle, participant cap) already ran
        // in enforceContestCreateLimits middleware before this handler.

        // Fail fast at configuration time, not at checkout: an admin enabling
        // payment on a contest whose org has the Razorpay gateway disabled
        // (platform-wide kill switch or a per-org override) should find out
        // right here, not have every participant hit "Payment failed" later.
        // See PaymentService.createOrder's own (still-required) runtime check
        // for the same flag — this is a second, earlier gate, not a replacement.
        if (input.paymentEnabled) {
            await this.assertPaymentGatewayAvailable(organizationId);
        }

        if (registrationDeadline >= startTime) {
            throw new BadRequestError("Registration deadline must be before the start time")
        }

        const slug = await this.ensureUniqueSlug(input.title, organizationId);

        const data: CreateContestDTO = {
            ...input,
            organizationId,
            createdById,
            slug,
            endTime,
            registrationDeadline,
            startTime,
        };

        const contest = await this.contestRepo.create(organizationId, createdById, data);

        logAudit({
            action: "contest.created",
            targetType: "CONTEST",
            targetId: contest.id,
            targetLabel: contest.title,
            organizationId,
        });

        return contest;
    }

    async getContest(contestId: string, organizationId: string) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");
        return {
            ...contest,
            // Derived, not stored — keeps config.quiz.manualStartVisibilityWindow the
            // single source of truth instead of duplicating the threshold in the client.
            manualStartVisibleFrom: new Date(
                contest.startTime.getTime() - config.quiz.manualStartVisibilityWindow * 1000,
            ).toISOString(),
        };
    }

    async getContestContext(contestId: string, organizationId: string) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        return {
            id: contest.id,
            organizationId: contest.organizationId,
            status: contest.status,
            shuffleQuestions: contest.shuffleQuestions,
            shuffleOptions: contest.shuffleOptions,
        };
    }

    async listContests(organizationId: string, query: ListContestsFilter) {
        const { data, total } = await this.contestRepo.list(organizationId, query);
        const { page, limit = 20 } = query;
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // ─── Public (no auth) ─────────────────────────────────────────────────────

    async listPublicContests(params: { search?: string; page?: number; limit?: number }) {
        const { search, page = 1, limit = 20 } = params;

        const where: any = {
            isDeleted: false,
            status: {
                in: [
                    ContestStatus.PUBLISHED,
                    ContestStatus.REGISTRATION_CLOSED,
                    ContestStatus.LIVE,
                    ContestStatus.EVALUATION,
                    ContestStatus.RESULTS_OUT,
                    ContestStatus.COMPLETED,
                ],
            },
            ...(search && {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            this.contestRepo.findManyPublic({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' as const },
            }),
            this.contestRepo.countPublic(where),
        ]);

        return {
            data,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getPublicContestBySlug(slug: string, referralCode?: string) {
        const contest = await this.contestRepo.findBySlugPublic(slug);
        if (!contest) {
            throw new NotFoundError("Contest not found or not publicly available");
        }
        // Strip joinCode (security) and the raw per-question `questions` array
        // (internal join rows — clients only need the aggregated totals below).
        const { joinCode, questions, ...safeContest } = contest as any;
        const totalMarks = Array.isArray(questions)
            ? questions.reduce((sum: number, q: { marks: number }) => sum + (q.marks ?? 0), 0)
            : 0;
        // Number(...) — negativeMark is a Prisma Decimal; summing the raw Decimal
        // instances (or letting them serialize as-is) is the same bug class as
        // elsewhere in this codebase (see question.shuffle.ts, submission.repository.ts).
        // The waiting room derives "negative marking on/off" and a per-question
        // average from this sum, the same way it derives marks-per-question from
        // totalMarks — there's no single per-contest negativeMark column since it's
        // set per question.
        const totalNegativeMarks = Array.isArray(questions)
            ? questions.reduce((sum: number, q: { negativeMark?: unknown }) => sum + (Number(q.negativeMark) || 0), 0)
            : 0;

        // Same "missing/unrecognized code -> proceed silently" rule as the attribution
        // lookup in registerParticipant below: an invalid/expired ?ref= never breaks the
        // page, it just means no ambassador-specific WhatsApp/social preview card.
        let referralPreview: Awaited<ReturnType<AmbassadorCampaignRepository["findReferralPreviewForContest"]>> = null;
        if (referralCode && this.ambassadorCampaignRepo) {
            referralPreview = await this.ambassadorCampaignRepo.findReferralPreviewForContest(referralCode, contest.id);
        }

        return {
            ...safeContest,
            joinCodeRequired: !!joinCode,
            totalQuestions: safeContest._count?.questions ?? 0,
            totalMarks,
            totalNegativeMarks,
            // Server's clock at the moment this payload was built. The waiting room
            // anchors its countdown to this instead of the browser clock — the quiz
            // actually starts on the SERVER's schedule, so a client whose clock drifts
            // would otherwise still show "1 min to go" while being pushed into the quiz.
            serverTime: new Date().toISOString(),
            referralPreview,
        };
    }

    async updateContest(contestId: string, organizationId: string, dto: UpdateContestInput) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        const editableStatuses: ContestStatus[] = [ContestStatus.DRAFT, ContestStatus.PUBLISHED, ContestStatus.REGISTRATION_CLOSED];
        if (!editableStatuses.includes(contest.status)) {
            throw new BadRequestError("Contest can only be edited while in DRAFT, PUBLISHED, or REGISTRATION_CLOSED status");
        }

        // Same fail-fast-at-configuration-time gate as createContest: re-verify
        // whenever the admin is actually turning payment on or editing its
        // configuration (fee amount, currency, etc.) — not on every unrelated
        // PATCH to a contest that already has payment enabled.
        const isConfiguringPayment =
            dto.paymentEnabled === true ||
            (dto.paymentConfig !== undefined && (dto.paymentEnabled ?? contest.paymentEnabled));
        if (isConfiguringPayment) {
            await this.assertPaymentGatewayAvailable(organizationId);
        }

        // Timing changes on a published contest must go through rescheduleContest():
        // it applies the whole new schedule atomically and notifies registrants.
        // Allowing them here would let a timing change slip through unnotified, and
        // one-field-at-a-time PATCHes re-run the cancel/reschedule cycle per request.
        if (contest.status !== ContestStatus.DRAFT) {
            const attemptedTimingFields = TIMING_FIELDS.filter((f) => (dto as Record<string, unknown>)[f] !== undefined);
            if (attemptedTimingFields.length > 0) {
                throw new BadRequestError(
                    `Cannot change ${attemptedTimingFields.join(", ")} on a ${contest.status} contest. ` +
                    `Use POST /contests/${contestId}/reschedule so participants are notified.`,
                );
            }
        }

        // Once registration has been manually closed, only the participant cap may still be raised
        if (contest.status === ContestStatus.REGISTRATION_CLOSED) {
            const allowedFields = new Set(["maxParticipants"]);
            const attemptedFields = Object.keys(dto);
            const disallowed = attemptedFields.filter((f) => !allowedFields.has(f));
            if (disallowed.length > 0) {
                throw new BadRequestError(
                    `Only maxParticipants can be changed once registration is closed (attempted: ${disallowed.join(", ")})`
                );
            }
        }

        if (dto.maxParticipants !== undefined && dto.maxParticipants !== null) {
            const currentParticipantCount = await this.contestRepo.countParticipants(contestId);
            if (dto.maxParticipants < currentParticipantCount) {
                throw new BadRequestError(
                    `Max participants cannot be set below the current registered count (${currentParticipantCount})`
                );
            }
            // Plan enforcement (participants/contest cap) already ran in
            // enforceContestUpdateParticipantCap middleware before this handler.
        }

        // Recompute endTime if startTime or duration changes
        const newStartTime = dto.startTime ? new Date(dto.startTime) : contest.startTime;
        const newRegDeadline = dto.registrationDeadline ? new Date(dto.registrationDeadline) : contest.registrationDeadline;

        if (newRegDeadline >= newStartTime) {
            throw new BadRequestError("Registration deadline must be before the start time");
        }
        if (dto.startTime && newStartTime <= new Date()) {
            throw new BadRequestError("Start time must be in the future");
        }

        const newDuration = dto.duration ?? contest.duration;
        const newEndTime = new Date(newStartTime.getTime() + newDuration * 60 * 1000);

        const { applyToExistingQuestions, ...contestData } = dto;

        const updatedContest = await prisma.$transaction(async (tx) => {
            const updated = await this.contestRepo.update(
                contestId,
                organizationId,
                { ...contestData, endTime: newEndTime } as any,
                tx
            );

            if (applyToExistingQuestions) {
                const marksVal = contestData.defaultQuestionMarks ?? contest.defaultQuestionMarks;
                const negMarksVal = contestData.defaultQuestionNegativeMark ?? contest.defaultQuestionNegativeMark;

                await tx.contestQuestion.updateMany({
                    where: { contestId, organizationId },
                    data: {
                        marks: marksVal,
                        negativeMark: negMarksVal,
                    },
                });
            }

            return updated;
        });

        if (applyToExistingQuestions) {
            // Bulk mark/negativeMark update changes every row the cached
            // scoring config would return for this contest — invalidate
            // outside the transaction (cache isn't transactional with Postgres).
            await invalidateContestScoringConfigCache(contestId, organizationId);
        }

        return updatedContest;
    }

    async updateContestCertificateTemplate(contestId: string, organizationId: string, certificateTemplateId: string) {
        if (!certificateTemplateId) {
            throw new BadRequestError("Certificate template ID is required");
        }

        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        const template = await prisma.certificateTemplate.findFirst({
            where: { id: certificateTemplateId, organizationId }
        });
        if (!template) throw new NotFoundError("Certificate template not found");

        return await this.contestRepo.updateCertificateTemplate(contestId, organizationId, certificateTemplateId);
    }

    async publishContest(contestId: string, organizationId: string) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        if (contest.status !== ContestStatus.DRAFT) {
            throw new BadRequestError("Only DRAFT contests can be published");
        }

        // The gateway flag can change in the window between a contest being
        // created and it being published (draft contests can sit for days) —
        // re-check right before it goes live to real participants, one last
        // time, so this never becomes the participant's problem to discover.
        if (contest.paymentEnabled) {
            await this.assertPaymentGatewayAvailable(organizationId);
        }

        if (new Date(contest.registrationDeadline) <= new Date()) {
            throw new BadRequestError("Registration deadline is already in the past");
        }

        const questionCount = await this.contestRepo.countQuestions(contestId);
        if (questionCount === 0) {
            throw new BadRequestError("Cannot publish a contest with no questions assigned");
        }

        const joinCode = this.generateJoinCode();

        const updated = await this.contestRepo.updateStatus(contestId, organizationId, ContestStatus.PUBLISHED, joinCode);

        await this.applySchedule(
            contestId,
            organizationId,
            new Date(contest.startTime),
            new Date(contest.endTime),
            contest.showResultsAfter ?? 24,
        );

        logAudit({
            action: "contest.published",
            targetType: "CONTEST",
            targetId: contestId,
            targetLabel: contest.title,
            organizationId,
            metadata: { joinCode },
        });

        return { status: updated.status, joinCode };
    }

    /**
     * Install the full timer + reminder schedule for a contest.
     *
     * Single place where "what jobs should exist for this schedule" is expressed, so
     * publish and reschedule cannot drift apart. Both underlying scheduler calls
     * already evict any existing job of the same id before adding, which is what makes
     * this safe to re-run on an already-scheduled contest.
     */
    private async applySchedule(
        contestId: string,
        organizationId: string,
        startTime: Date,
        endTime: Date,
        showResultsAfter: number,
    ): Promise<void> {
        await this.schedulerService.scheduleContestLifecycle(
            contestId,
            organizationId,
            startTime,
            endTime,
            showResultsAfter,
        );
        await this.schedulerService.scheduleReminders(contestId, organizationId, startTime);
    }

    /** Remove every scheduled job for a contest — used by cancel and force-end. */
    private async clearSchedule(contestId: string): Promise<void> {
        await this.schedulerService.cancelContestJobs(contestId);
        await this.schedulerService.cancelReminders(contestId);
    }


    /**
     * Manually close registration ahead of the scheduled deadline.
     * Blocks any further sign-ups while leaving the contest otherwise untouched —
     * the start-time job still fires normally.
     */
    async closeRegistration(contestId: string, organizationId: string) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        if (contest.status !== ContestStatus.PUBLISHED) {
            throw new BadRequestError("Only PUBLISHED contests with open registration can be closed early");
        }

        const updated = await this.contestRepo.updateStatus(contestId, organizationId, ContestStatus.REGISTRATION_CLOSED);
        logger.info(`[contest] Registration manually closed early for contest ${contestId}`);

        return { status: updated.status };
    }

    // ─── Lifecycle operations ─────────────────────────────────────────────────
    //
    // Reschedule / cancel / force-end are separate endpoints rather than flags on
    // updateContest because notification is driven by *which operation was called*,
    // never by diffing which fields changed. Diffing is ambiguous (a duration change
    // is also an endTime change) and would let a material change go unannounced.

    /** Statuses from which the schedule may still be moved — i.e. before it starts. */
    private static readonly RESCHEDULABLE: ReadonlyArray<ContestStatus> = [
        ContestStatus.PUBLISHED,
        ContestStatus.REGISTRATION_CLOSED,
    ];

    /** Statuses from which a contest may be called off outright. */
    private static readonly CANCELLABLE: ReadonlyArray<ContestStatus> = [
        ContestStatus.DRAFT,
        ContestStatus.PUBLISHED,
        ContestStatus.REGISTRATION_CLOSED,
    ];

    /**
     * Move a contest's schedule atomically and tell registrants.
     *
     * The whole new schedule is validated together and written once, unlike PATCH
     * which sends one field per request — that path rejects valid final intents
     * because it validates each intermediate state (e.g. moving startTime earlier
     * before moving the registration deadline).
     *
     * Deliberately not permitted once LIVE: participants would already be mid-exam,
     * and supporting it would mean purging Redis session state and regressing status,
     * which is a materially riskier operation. Force-end is the escape hatch there.
     */
    async rescheduleContest(contestId: string, organizationId: string, input: RescheduleContestInput) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        if (!ContestService.RESCHEDULABLE.includes(contest.status)) {
            throw new ConflictError(
                contest.status === ContestStatus.LIVE
                    ? "A live contest cannot be rescheduled. Use force-end to stop it early."
                    : `Cannot reschedule a ${contest.status} contest`,
            );
        }

        const startTime = new Date(input.startTime);
        const registrationDeadline = input.registrationDeadline
            ? new Date(input.registrationDeadline)
            : contest.registrationDeadline;
        const duration = input.duration ?? contest.duration;
        const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

        if (startTime <= new Date()) {
            throw new BadRequestError("Start time must be in the future");
        }
        if (registrationDeadline >= startTime) {
            throw new BadRequestError("Registration deadline must be before the start time");
        }

        const previousStartTime = contest.startTime;

        const updated = await this.contestRepo.update(contestId, organizationId, {
            startTime,
            registrationDeadline,
            duration,
            endTime,
        } as any);

        // Reinstall every timer + reminder against the new schedule. Both scheduler
        // calls evict same-id jobs first, so no stale job can survive with its old delay.
        await this.applySchedule(
            contestId,
            organizationId,
            startTime,
            endTime,
            updated.showResultsAfter ?? 24,
        );

        // Anyone already waiting gets the new time pushed over their existing socket.
        this.broadcaster?.emitContestRescheduled(contestId, {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            ...(input.reason ? { reason: input.reason } : {}),
        });

        if (input.notifyParticipants && contest.status !== ContestStatus.DRAFT) {
            const timezone = await this.orgRepo.findTimezone(organizationId);
            await this.notifyParticipants(contestId, organizationId, MessageTemplate.CONTEST_RESCHEDULED, {
                previousDate: this.formatForParticipant(previousStartTime, timezone),
                reason: input.reason ?? "",
            });
        }

        logger.info(
            `[contest] Rescheduled ${contestId}: ${previousStartTime.toISOString()} → ${startTime.toISOString()} ` +
            `(duration ${duration}m, notify=${input.notifyParticipants})`,
        );

        return updated;
    }

    /**
     * Call a contest off before it starts.
     *
     * Blocked once LIVE: participants are mid-exam and their answers must be preserved
     * and submitted, which is force-end's job — cancelling would discard them.
     */
    async cancelContest(contestId: string, organizationId: string, input: CancelContestInput) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        // Idempotent: re-cancelling is a no-op rather than an error, so a retried
        // request (or a double-click that slipped past idempotency) stays safe.
        if (contest.status === ContestStatus.CANCELLED) {
            return { status: contest.status };
        }

        if (!ContestService.CANCELLABLE.includes(contest.status)) {
            throw new ConflictError(
                contest.status === ContestStatus.LIVE
                    ? "A live contest cannot be cancelled. Use force-end so participants' answers are submitted."
                    : `Cannot cancel a ${contest.status} contest`,
            );
        }

        const updated = await this.contestRepo.updateStatus(contestId, organizationId, ContestStatus.CANCELLED);

        await this.clearSchedule(contestId);

        this.broadcaster?.emitContestCancelled(contestId, { reason: input.reason });

        // A DRAFT has no registrants, so there is nobody to tell.
        if (input.notifyParticipants && contest.status !== ContestStatus.DRAFT) {
            await this.notifyParticipants(contestId, organizationId, MessageTemplate.CONTEST_CANCELLED, {
                reason: input.reason,
            });
        }

        logger.info(`[contest] Cancelled ${contestId} (was ${contest.status}): ${input.reason}`);

        logAudit({
            action: "contest.cancelled",
            targetType: "CONTEST",
            targetId: contestId,
            targetLabel: contest.title,
            organizationId,
            metadata: { reason: input.reason },
        });

        return { status: updated.status };
    }

    /**
     * Stop a running contest immediately, preserving and submitting every active
     * participant's answers.
     *
     * This is the on-demand form of the scheduled AUTO_SUBMIT job and reuses the exact
     * same runtime path (handleTimeExpiry → emitAutoSubmit → triggerEvaluation) so the
     * two can't diverge. The only difference is the trigger.
     */
    async forceEndContest(contestId: string, organizationId: string, input: ForceEndContestInput) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        if (contest.status !== ContestStatus.LIVE) {
            throw new ConflictError(`Only a LIVE contest can be force-ended (current status: ${contest.status})`);
        }

        if (!this.quizTerminator) {
            throw new BadRequestError("Quiz runtime is unavailable — cannot force-end the contest");
        }

        const { submitted, errors } = await this.quizTerminator.handleTimeExpiry(contestId);

        for (const participantId of submitted) {
            await this.quizTerminator.emitAutoSubmit(participantId, contestId, "force_ended");
        }

        // No further timers should fire for this contest — the AUTO_SUBMIT job it would
        // otherwise still hold would re-run this whole path at the original endTime.
        await this.clearSchedule(contestId);

        // Same absentee sweep the scheduled end performs, so a force-ended contest
        // reaches the same final participant states as one that ran to completion.
        await this.schedulerService.scheduleMarkAbsent(contestId, organizationId);

        await this.triggerEvaluation(contestId, organizationId);

        logger.info(
            `[contest] Force-ended ${contestId}: ${submitted.length} submitted, ${errors.length} errors` +
            (input.reason ? ` — ${input.reason}` : ""),
        );

        return { status: ContestStatus.EVALUATION, submitted: submitted.length, errors: errors.length };
    }

    /** Statuses from which a contest may still be manually started. */
    private static readonly MANUALLY_STARTABLE: ReadonlyArray<ContestStatus> = [
        ContestStatus.PUBLISHED,
        ContestStatus.REGISTRATION_CLOSED,
    ];

    /**
     * Run the CONTEST_START sequence: flip status to LIVE, move waiting-room
     * participants into the quiz, DB-fallback for anyone the socket path missed, and
     * broadcast admin stats.
     *
     * Shared by quiz-timer.worker.ts's scheduled handler and startContestNow below so
     * the two triggers can never produce different outcomes — see
     * docs/contest-start-reliability-spec.md §5.2.
     */
    async runContestStartSequence(
        contestId: string,
        organizationId: string,
    ): Promise<{ transitioned: string[]; blocked: string[] }> {
        if (!this.quizStarter) {
            throw new BadRequestError("Quiz runtime is unavailable — cannot start the contest");
        }

        await this.contestRepo.updateStatus(contestId, organizationId, ContestStatus.LIVE);

        const { transitioned, blocked } = await this.quizStarter.transitionToQuiz(contestId);

        const startedPids = new Set<string>();
        for (const pid of transitioned) {
            try {
                const session = await this.quizStarter.handleRejoin(contestId, pid);
                const contactId = session?.contactId ?? "";
                await this.quizStarter.startQuizForParticipant(pid, contestId, organizationId, contactId);
                startedPids.add(pid);
            } catch (err) {
                logger.error(`[contest] Failed to start quiz for ${pid}: ${(err as Error).message}`);
            }
        }

        // DB-level fallback: participants still REGISTERED/CHECKED_IN/IN_WAITING whose
        // socket never emitted quiz:v1:join (network blip, page refresh, slow connection).
        if (this.participantRepo) {
            try {
                const dbParticipants = await this.participantRepo.findAwaitingStart(contestId, organizationId);
                for (const p of dbParticipants) {
                    if (startedPids.has(p.id)) continue;
                    try {
                        await this.quizStarter.startQuizForParticipant(p.id, contestId, organizationId, p.contactId);
                        logger.info(`[contest] DB-fallback: started quiz for ${p.id}`);
                    } catch (err) {
                        logger.error(`[contest] DB-fallback failed for ${p.id}: ${(err as Error).message}`);
                    }
                }
            } catch (err) {
                logger.error(`[contest] DB-fallback query failed: ${(err as Error).message}`);
            }
        }

        this.quizStarter.broadcastAdminEvent(contestId, "admin:v1:live-stats", {
            contestId,
            active: transitioned.length,
            submitted: 0,
            waiting: blocked.length,
            totalViolations: 0,
        });

        return { transitioned, blocked };
    }

    /**
     * Admin-triggered fallback for when the scheduled CONTEST_START job never fires
     * (the "Two-Redis Trap" incident this spec exists to close). Idempotent against a
     * still-pending scheduled job: that job is evicted here so it cannot also fire and
     * double-run the start sequence, and a race where it fires anyway is a no-op —
     * quiz-timer.worker.ts's handleContestStart treats LIVE the same as CANCELLED/COMPLETED.
     */
    async startContestNow(contestId: string, organizationId: string) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        if (!ContestService.MANUALLY_STARTABLE.includes(contest.status)) {
            throw new ConflictError(
                contest.status === ContestStatus.LIVE
                    ? "Contest is already LIVE"
                    : `Cannot manually start a ${contest.status} contest`,
            );
        }

        await this.schedulerService.cancelStartJob(contestId);

        const { transitioned, blocked } = await this.runContestStartSequence(contestId, organizationId);

        logger.info(
            `[contest] Manually started ${contestId}: ${transitioned.length} transitioned, ${blocked.length} blocked`,
        );

        return { status: ContestStatus.LIVE, transitioned: transitioned.length, blocked: blocked.length };
    }

    /**
     * Periodic safety net (Phase 2 of docs/contest-start-reliability-spec.md): catches
     * a CONTEST_START job that is simply gone — Redis mode-switch data loss, a failed
     * re-schedule, an operator error — which the worker's own staleness self-heal
     * cannot catch, since that only corrects a job firing at the wrong time, not one
     * that never fires at all. Manual "Start Now" is the human-triggered fallback for
     * the same gap; this is the automatic one.
     *
     * Queries Contest directly (already indexed on [startTime, status]) rather than a
     * separate schedule table — see the spec §6.3 for why a second persisted copy of
     * "when does this start" was rejected as its own source of drift risk.
     */
    async reconcileMissingStartJobs(): Promise<{ checked: number; fixed: number }> {
        const now = Date.now();
        const windowStart = new Date(now - config.quiz.reconciliationGraceMs);
        const windowEnd = new Date(now + config.quiz.reconciliationLookaheadMs);

        const candidates = await this.contestRepo.findStartReconciliationCandidates(windowStart, windowEnd);

        let fixed = 0;
        for (const contest of candidates) {
            try {
                const existing = await quizTimerQueue.getJob(`start-${contest.id}`);
                if (existing) continue; // healthy — no action, no log noise

                await this.schedulerService.ensureStartJob(contest.id, contest.organizationId, contest.startTime);
                fixed++;
                logger.warn(
                    `[contest-reconciliation] Re-enqueued missing CONTEST_START job for contest ${contest.id} ` +
                    `(scheduled for ${contest.startTime.toISOString()})`,
                );
            } catch (err) {
                logger.error(
                    `[contest-reconciliation] Failed to check/fix contest ${contest.id}: ${(err as Error).message}`,
                );
            }
        }

        logger.info(`[contest-reconciliation] Sweep complete — checked=${candidates.length}, fixed=${fixed}`);

        if (fixed > 0) {
            logAudit({
                action: "system.contest_reconciliation_fired",
                targetType: "SYSTEM",
                targetId: "contest-reconciliation",
                targetLabel: "Contest start reconciliation sweep",
                actorType: "SYSTEM",
                metadata: { checked: candidates.length, fixed },
            });
        }

        return { checked: candidates.length, fixed };
    }

    /** Registers the recurring BullMQ job that drives reconcileMissingStartJobs on a schedule. */
    async ensureContestStartReconciliationJob(): Promise<void> {
        const jobId = "periodic-contest-start-reconciliation";

        const repeatables = await contestReconciliationQueue.getRepeatableJobs();
        const existing = repeatables.find((repeatable) => repeatable.id === jobId);
        if (existing) {
            await contestReconciliationQueue.removeRepeatableByKey(existing.key);
        }

        await contestReconciliationQueue.add(
            "reconcile-contest-starts",
            {},
            {
                jobId,
                repeat: { every: config.quiz.reconciliationIntervalMs },
                removeOnComplete: true,
                removeOnFail: true,
            },
        );

        logger.info(
            `[contest-service] Recurring contest-start reconciliation scheduled every ${config.quiz.reconciliationIntervalMs / 60000} minutes`,
        );
    }

    /**
     * Fan out a contest-scoped template to every registrant via the existing
     * bulk-notify pipeline (the same one that sends the 24h/1h reminders).
     */
    private async notifyParticipants(
        contestId: string,
        organizationId: string,
        template: MessageTemplate,
        extraParams: Record<string, string>,
    ): Promise<void> {
        await messageQueue.add("bulk-notify", { contestId, organizationId, template, extraParams });
        logger.info(`[contest] Queued ${template} notification for contest ${contestId}`);
    }

    private formatForParticipant(date: Date, timezone: string | null): string {
        return formatDateTimeHuman(date, timezone);
    }

    async deleteContest(contestId: string, organizationId: string) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        if (contest.status !== ContestStatus.DRAFT && contest.status !== ContestStatus.COMPLETED) {
            throw new BadRequestError("Only DRAFT or COMPLETED contests can be deleted");
        }

        return this.contestRepo.softDelete(contestId, organizationId);
    }

    async archiveContest(contestId: string, organizationId: string) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        return this.contestRepo.archive(contestId, organizationId);
    }

    async listArchivedContests(organizationId: string, query: Omit<ListContestsFilter, 'isArchived'>) {
        const { data, total } = await this.contestRepo.list(organizationId, { ...query, isArchived: true });
        const { page = 1, limit = 20 } = query;
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }



    // ─── Registration ─────────────────────────────────────────────────────────

    async getRegisterStatus(contestSlug: string, contactToken: string, phone?: string) {
        const tokenPayload = await verifyContactToken(contactToken);
        const email = tokenPayload.email;

        const contest = await this.contestRepo.findBySlugPublic(contestSlug);
        if (!contest) throw new NotFoundError("Contest not found");

        // A phone number is only usable for matching once it's a complete,
        // normalized 10-digit number — anything shorter is the participant
        // still mid-typing it into the details-step field, not a lookup key.
        // See registration audit, issue A (phone-match should also prefill,
        // same as an email match already does below).
        const normalizedPhone = phone ? phone.replace(/\D/g, "").replace(/^(91|0{2}91)/, "") : undefined;
        const phoneForLookup = normalizedPhone && /^\d{10}$/.test(normalizedPhone) ? normalizedPhone : undefined;

        const contact = await this.contactService.findByEmailOrPhone(
            contest.organizationId,
            email,
            phoneForLookup
        );
        if (!contact) {
            return { existing: null };
        }

        // A contact from a PRIOR registration (any contest in this org) —
        // surfaced so the frontend can prefill the details form instead of
        // asking a returning participant to retype everything. Only
        // relevant on the "no participant for THIS contest yet" paths below
        // (where the form is actually shown); once a participant record for
        // this contest exists, the frontend shows an already-registered
        // screen instead, so prefill data isn't needed there.
        const knownContact = {
            firstName:  contact.firstName,
            lastName:   contact.lastName,
            phone:      contact.phone,
            college:    contact.college,
            department: contact.department,
            city:       contact.city,
            state:      contact.state,
        };

        if (!this.participantRepo) {
            return { existing: null, knownContact };
        }

        const participant = await this.participantRepo.findByContactId(
            contest.organizationId,
            contest.id,
            contact.id
        );

        if (!participant) {
            return { existing: null, knownContact };
        }

        if (participant.status === ParticipantStatus.REGISTERED) {
            return {
                existing: {
                    participantId: participant.id,
                    registrationRef: participant.registrationRef,
                    status: "REGISTERED",
                },
            };
        }

        if (participant.status === ParticipantStatus.PENDING_PAYMENT) {
            let resumable = false;
            let paymentStatus = "PENDING";
            let ageMs = 0;

            if (this.paymentRepo) {
                const payment = await this.paymentRepo.findByParticipantId(participant.id);
                if (payment) {
                    paymentStatus = payment.status;
                    ageMs = Date.now() - payment.createdAt.getTime();
                    resumable = payment.status !== "SUCCESS" && ageMs < config.payment.orderReuseWindowMs;
                }
            }

            return {
                existing: {
                    participantId: participant.id,
                    registrationRef: participant.registrationRef,
                    status: "PENDING_PAYMENT",
                    payment: {
                        status: paymentStatus,
                        ageMs,
                        resumable,
                    },
                },
            };
        }

        return { existing: null };
    }

    async registerParticipant(contestSlug: string, dto: RegisterParticipantInput) {
        // 0. Platform-wide registration pause (new_registrations_paused flag,
        // org-unaware — supportsOrgOverride: false). Checked before the OTP
        // token verification so a paused registration fails fast.
        if (await isFeatureEnabled("new_registrations_paused")) {
            throw new FeatureUnavailableError(
                "new_registrations_paused",
                "New registrations are temporarily paused. Please try again shortly."
            );
        }

        // 1. Verify the OTP contact token so we know the phone/email is real
        const tokenPayload = await verifyContactToken(dto.contactToken);
        if (tokenPayload.email !== dto.email) {
            throw new BadRequestError("Contact token email does not match registration email");
        }

        // 2. Fetch contest
        const contest = await this.contestRepo.findBySlugPublic(contestSlug);
        if (!contest) throw new NotFoundError("Contest not found");

        const now = new Date();
        if (contest.status !== ContestStatus.PUBLISHED) {
            throw new BadRequestError("Contest is not open for registration");
        }
        if (now > contest.registrationDeadline) {
            throw new BadRequestError("Registration deadline has passed");
        }
        if (contest.maxParticipants !== null && (contest as any)._count?.participants >= contest.maxParticipants) {
            throw new BadRequestError("Contest has reached its maximum participant limit");
        }

        // Plan enforcement backstop (participants/contest, for contests with no
        // self-imposed maxParticipants) already ran in enforceParticipantRegistrationLimit
        // middleware before this handler.

        // 3. Resolve contactId — service orchestrates, repos do the queries
        const existingContact = await this.contactService.findByEmailOrPhone(
            contest.organizationId,
            dto.email,
            dto.phone
        );

        let contactId: string;
        // What email/phone this registration is ACTUALLY associated with —
        // may differ from dto.email/dto.phone when an existing contact was
        // matched by phone under a different (older) email, since email is
        // deliberately never overwritten on an existing contact (below).
        // Returned to the frontend so the success screen can tell the
        // participant the truth instead of just echoing back what they
        // typed. See registration audit, issue A.
        let effectiveEmail: string;
        let effectivePhone: string;

        if (existingContact) {
            contactId = existingContact.id;
            effectiveEmail = existingContact.email;
            effectivePhone = existingContact.phone ?? dto.phone;

            // Sync any fields the participant actually changed (e.g. a
            // stale phone/college from a prior registration, now editable
            // on a prefilled form) back onto the Contact record. Only
            // fields that are both submitted AND different are included —
            // an optional field left blank on this submission never
            // overwrites a value already on file. Email is deliberately
            // excluded: a returning participant registering with a new
            // email but a phone number already on file keeps their
            // original email as the contact's email of record (see
            // effectiveEmail above, surfaced to the frontend instead of
            // silently overriding it either way).
            const contactUpdates: UpdateContactDTO = {};
            if (dto.firstName !== undefined && dto.firstName !== existingContact.firstName) contactUpdates.firstName = dto.firstName;
            if (dto.lastName !== undefined && dto.lastName !== existingContact.lastName) contactUpdates.lastName = dto.lastName;
            if (dto.phone !== undefined && dto.phone !== existingContact.phone) contactUpdates.phone = dto.phone;
            if (dto.college !== undefined && dto.college !== existingContact.college) contactUpdates.college = dto.college;
            if (dto.department !== undefined && dto.department !== existingContact.department) contactUpdates.department = dto.department;
            if (dto.city !== undefined && dto.city !== existingContact.city) contactUpdates.city = dto.city;
            if (dto.state !== undefined && dto.state !== existingContact.state) contactUpdates.state = dto.state;

            if (Object.keys(contactUpdates).length > 0) {
                try {
                    await this.contactService.update(existingContact.id, contest.organizationId, contactUpdates);
                    if (contactUpdates.phone !== undefined) effectivePhone = contactUpdates.phone;
                } catch (err) {
                    // Don't let a profile-sync failure (e.g. the new phone
                    // number already belongs to a different contact) block
                    // the actual registration — the participant still gets
                    // their seat, just with the previously-stored contact
                    // data rather than the edited values.
                    logger.warn(`[contest] Failed to sync contact ${existingContact.id} profile on re-registration: ${(err as Error).message}`);
                }
            }
        } else {
            // Create new contact
            const newContact = await this.contactService.createForRegistration(
                contest.organizationId,
                {
                    email: dto.email,
                    phone: dto.phone,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    college: dto.college,
                    department: dto.department,
                    city: dto.city,
                    state: dto.state,
                }
            );
            contactId = newContact.id;
            effectiveEmail = dto.email;
            effectivePhone = dto.phone;
        }

        // 4. Create or reuse Participant — check existing record first
        let participant;
        let existingParticipant = null;
        if (this.participantRepo) {
            existingParticipant = await this.participantRepo.findByContactId(
                contest.organizationId,
                contest.id,
                contactId
            );
        }

        if (existingParticipant) {
            if (existingParticipant.status === ParticipantStatus.REGISTERED) {
                throw new ConflictError("You are already registered for this contest");
            }
            if (existingParticipant.status === ParticipantStatus.PENDING_PAYMENT) {
                // Reuse existing PENDING_PAYMENT row (order refresh happens in createOrder if needed)
                participant = existingParticipant;
            }
        }

        if (!participant) {
            const registrationRef = generateRegistrationRef();

            // Ambassador referral capture (additive, §6.5) — only runs when a
            // ref code was actually submitted, so the common no-referral path
            // never pays for an extra query. Missing/unrecognized code →
            // proceed exactly as before, silently unattributed.
            let referredByEnrollmentId: string | undefined;
            if (dto.referralCode && this.ambassadorCampaignRepo) {
                const enrollment = await this.ambassadorCampaignRepo.findEnrollmentByReferralCodeForContest(
                    dto.referralCode,
                    contest.id,
                );
                if (enrollment) referredByEnrollmentId = enrollment.id;
            }

            try {
                participant = await this.participantService.registerParticipant({
                    organizationId: contest.organizationId,
                    contestId: contest.id,
                    contactId,
                    registrationRef,
                    // Paid contests: hold the seat as PENDING_PAYMENT until the
                    // Razorpay webhook confirms the payment was captured.
                    status: contest.paymentEnabled
                        ? ParticipantStatus.PENDING_PAYMENT
                        : ParticipantStatus.REGISTERED,
                    ...(referredByEnrollmentId ? { referredByEnrollmentId } : {}),
                    ...(dto.customFields ? { customFields: dto.customFields } : {}),
                });
            } catch (err: any) {
                if (err?.code === "P2002") {
                    throw new ConflictError("You are already registered for this contest");
                }
                throw err;
            }
        }

        // 5. Free contest — done
        if (!contest.paymentEnabled) {
            // Enqueue confirmation message
            const timezone = await this.orgRepo.findTimezone(contest.organizationId);
            this.messagingService.enqueueMessage(contest.organizationId, {
                participantId: participant.id,
                contestId: contest.id,
                channel: "EMAIL",
                template: MessageTemplate.REGISTRATION_SUCCESSFUL,
                recipient: dto.email,
                params: {
                    name: dto.firstName,
                    eventName: contest.title,
                    date: contest.startTime ? formatDateHuman(contest.startTime, timezone) : 'TBD',
                    time: contest.startTime ? formatTimeHuman(contest.startTime, timezone) : 'TBD',
                    link: `${config.app.frontendUrl}/quiz/${contest.slug}/join`,
                    joinCode: contest.joinCode || 'N/A',
                },
            }).catch((err) => {
                logger.error(`[contest] Failed to enqueue registration confirmation: ${(err as Error).message}`);
            });

            return {
                registrationRef: participant.registrationRef,
                participantId: participant.id,
                paymentRequired: false,
                status: "REGISTERED",
                // The email/phone this registration is actually associated
                // with — may differ from what was submitted if an existing
                // contact was matched by phone under an older email. See
                // registration audit, issue A.
                contactEmail: effectiveEmail,
                contactPhone: effectivePhone,
            };
        }


        return {
            registrationRef: participant.registrationRef,
            participantId: participant.id,
            paymentRequired: true,
            payment: {
                amount: Number(contest.paymentConfig!.amount),
                currency: contest.paymentConfig!.currency ?? "INR",
                description: `Registration fee for ${contest.title}`,
            },
            contactEmail: effectiveEmail,
            contactPhone: effectivePhone,
        };
    }

    // ─── Participants (Admin) ─────────────────────────────────────────────────

    async getParticipants(
        contestId: string,
        organizationId: string,
        query: { status?: ParticipantStatus | null | undefined; search?: string | null | undefined; page: number; limit: number }
    ) {
        return this.participantService.getParticipants(organizationId, contestId, query);
    }

    async getParticipantById(contestId: string, organizationId: string, participantId: string) {
        return this.participantService.getParticipantById(contestId, participantId, organizationId);
    }

    async disqualifyParticipant(
        contestId: string,
        organizationId: string,
        participantId: string,
        reason: string
    ) {
        // Notify participant of disqualification (fire-and-forget)
        const participant = await this.participantService.getParticipantById(contestId, participantId, organizationId);
        if (participant?.contact?.email) {
            const contest = await this.getContest(contestId, organizationId);
            this.messagingService.enqueueMessage(organizationId, {
                participantId,
                contestId,
                channel: "EMAIL",
                template: MessageTemplate.DISQUALIFICATION_NOTICE,
                recipient: participant.contact.email,
                params: {
                    name: participant.contact.firstName,
                    eventName: contest.title,
                    reason,
                },
            }).catch((err) => {
                logger.error(`[contest] Failed to enqueue disqualification notice: ${(err as Error).message}`);
            });
        }

        return this.participantService.disqualifyParticipant(contestId, participantId, organizationId, reason);
    }

    // ─── Evaluation & Results ─────────────────────────────────────────────────


    async triggerEvaluation(contestId: string, organizationId: string) {
        const contest = await this.getContest(contestId, organizationId);

        if (contest.status === ContestStatus.DRAFT || contest.status === ContestStatus.CANCELLED) {
            throw new BadRequestError("Evaluation cannot be triggered on a DRAFT or CANCELLED contest");
        }

        await this.contestRepo.updateStatus(contestId, organizationId, ContestStatus.EVALUATION);

        // Fan-out: enqueue individual evaluation jobs for all SUBMITTED submissions
        const { queued } = await this.submissionService.triggerContestEvaluation(organizationId, contestId);
        logger.info(`[contest] Triggered evaluation for contest ${contestId}: ${queued} jobs enqueued`);

        return { status: ContestStatus.EVALUATION };
    }

    async declareResults(contestId: string, organizationId: string) {
        const contest = await this.getContest(contestId, organizationId);

        // Idempotent: if results are already out, return early
        if (contest.status === ContestStatus.RESULTS_OUT || contest.status === ContestStatus.COMPLETED) {
            logger.info(`[contest] declareResults: Contest ${contestId} already in ${contest.status} — no-op`);
            return { status: contest.status };
        }

        if (contest.status === ContestStatus.DRAFT || contest.status === ContestStatus.CANCELLED) {
            throw new BadRequestError("Results cannot be declared on a DRAFT or CANCELLED contest");
        }

        // Check if there are any submissions still in SUBMITTED status (pending evaluation)
        const pendingCount = await this.submissionService.countByContest(contestId, organizationId, [SubmissionStatus.SUBMITTED]);
        if (pendingCount > 0) {
            throw new BadRequestError("Submissions are still being evaluated. Wait for evaluation to complete.");
        }

        // Check leaderboard state
        const evaluatedCount = await this.submissionService.countByContest(contestId, organizationId, [SubmissionStatus.EVALUATED]);
        let entryCount = await this.leaderboardRepo.countEntries(contestId, organizationId);

        // If evaluations exist but leaderboard entries don't, build inline
        if (evaluatedCount > 0 && entryCount === 0) {
            logger.info(`[contest] declareResults: Building leaderboard inline for contest ${contestId} (${evaluatedCount} evaluated, 0 entries)`);
            const scores = await this.leaderboardRepo.fetchEvaluatedScores(contestId, organizationId);
            if (scores.length > 0) {
                const ranked = rankRows(scores);
                await this.leaderboardRepo.buildLeaderboard(contestId, organizationId, ranked);
                entryCount = ranked.length;
                logger.info(`[contest] declareResults: Built ${entryCount} leaderboard entries inline for contest ${contestId}`);
            }
        }

        // Final guard: if there are still no entries, block declaration
        if (entryCount === 0 && evaluatedCount > 0) {
            throw new BadRequestError("Leaderboard could not be built. Please try again or contact support.");
        }

        // Publish all entries and update contest status
        await this.leaderboardRepo.publishAll(contestId, organizationId);
        await this.contestRepo.updateStatus(contestId, organizationId, ContestStatus.RESULTS_OUT);

        logAudit({
            action: "contest.results_declared",
            targetType: "CONTEST",
            targetId: contestId,
            targetLabel: contest.title,
            organizationId,
        });

        // Notify all participants that results are out (fan-out via worker)
        // Pass contest slug so the worker can build the leaderboard URL
        await messageQueue.add('bulk-notify', {
            contestId, organizationId, template: MessageTemplate.RESULTS_PUBLISHED,
            contestSlug: contest.slug,
        }, { jobId: `results-notify-${contestId}` });
        logger.info(`[contest] Enqueued results-published notification for contest ${contestId}`);

        return { status: ContestStatus.RESULTS_OUT };
    }

    /**
     * Returns info about the auto-declare schedule for the frontend confirmation modal.
     * Allows the admin to know whether they are declaring results early.
     */
    async getResultsDeclarationInfo(contestId: string, organizationId: string) {
        const contest = await this.getContest(contestId, organizationId);

        const showResultsAfter = contest.showResultsAfter ?? 24;
        const endTime = new Date(contest.endTime);
        const scheduledAt = new Date(endTime.getTime() + showResultsAfter * 3600 * 1000);
        const now = new Date();
        const isEarlyDeclare = now < scheduledAt;

        const evaluatedCount = await this.submissionService.countByContest(contestId, organizationId, [SubmissionStatus.EVALUATED]);
        const entryCount = await this.leaderboardRepo.countEntries(contestId, organizationId);
        const pendingCount = await this.submissionService.countByContest(contestId, organizationId, [SubmissionStatus.SUBMITTED]);

        return {
            showResultsAfter,
            scheduledAt: scheduledAt.toISOString(),
            isEarlyDeclare,
            isAlreadyDeclared: contest.status === ContestStatus.RESULTS_OUT || contest.status === ContestStatus.COMPLETED,
            leaderboardReady: entryCount > 0,
            evaluatedCount,
            pendingCount,
        };
    }


    async getLeaderboard(
        contestId: string,
        organizationId: string,
        page: number,
        limit: number
    ) {
        const contest = await this.contestRepo.findById(contestId, organizationId || undefined);
        if (!contest) throw new NotFoundError("Contest not found");

        const { entries, total } = await this.leaderboardRepo.findAll(contestId, contest.organizationId, page, limit);
        return {
            entries,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getAdminLeaderboard(
        contestId: string,
        organizationId: string,
        page: number,
        limit: number
    ) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        const { entries, total } = await this.leaderboardRepo.findAllAdmin(contestId, contest.organizationId, page, limit);
        return {
            entries,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }



    // ─── Helpers ──────────────────────────────────────────────────────────────

    async areAnyLive(contestIds: string[], organizationId: string): Promise<boolean> {
        if (contestIds.length === 0) return false;
        const { total } = await this.contestRepo.listByIds(contestIds, organizationId, ContestStatus.LIVE);
        return total > 0;
    }

    private async ensureUniqueSlug(title: string, organizationId: string): Promise<string> {
        let slug = createSlug(title);
        if (!slug) slug = "contest";
        let attempt = 0;

        while (true) {
            const suffix = attempt > 0 ? `-${generateRandomString(4).toLowerCase()}` : "";
            const candidate = `${slug}${suffix}`;
            const existing = await prisma.contest.findFirst({
                where: { slug: candidate }
            });

            if (!existing) return candidate;
            attempt++;

            if (attempt > config.app.maxSlugRetries) {
                throw new BadRequestError("Could not generate a unique slug for this contest title");
            }
        }
    }

    private generateJoinCode(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const length = 5;
        return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    }

    /**
     * Admin-facing counterpart to the runtime gate in PaymentService.createOrder
     * (same "razorpay_gateway_active" flag). That check has to stay — it's what
     * protects an already-published paid contest if the flag gets flipped off
     * mid-flight — but it was the *only* check, which meant an org admin could
     * fully configure and publish a paid contest whose org had payments disabled
     * and never find out until a real participant hit "Payment failed" at
     * checkout. This surfaces the same condition to the admin, at the moment
     * they enable/configure payment, instead of to the participant at checkout.
     */
    private async assertPaymentGatewayAvailable(organizationId: string): Promise<void> {
        if (!(await isFeatureEnabled("razorpay_gateway_active", { organizationId }))) {
            throw new FeatureUnavailableError(
                "razorpay_gateway_active",
                "Payments are not enabled for your organization right now, so this contest can't accept a registration fee. Contact support to enable payments, or publish this contest as a free contest.",
            );
        }
    }
}