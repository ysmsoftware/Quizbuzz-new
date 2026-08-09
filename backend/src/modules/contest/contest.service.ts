import { ContestStatus, ParticipantStatus, SubmissionStatus } from "@prisma/client";
import { OrganizationRepository } from "../organization/organization.repository";
import { ContestRepository } from "./contest.repository";
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
import { createSlug } from "../../utils/slug";
import { generateRegistrationRef } from "../../utils/ref";
import { config } from "../../config";
// Plan-limit enforcement (contests/cycle, participants/contest) now runs as
// middleware ahead of these routes — see src/middlewares/plan-limit.middleware.ts.
// This service no longer calls src/common/plan-entitlements.ts directly.
import { verifyContactToken } from "../../utils/tokens";
import { ContactService } from "../contact/contact.service";
import { CreateContestDTO, ListContestsFilter } from "./contest.types";
import { MessageTemplate } from "../../types/message-template.enum";
import { messageQueue } from "../../queues";
import { rankRows } from "../../workers/leaderboard.worker";
import logger from "../../config/logger";


import { IParticipantRepository } from "../participant/participant.repository";
import { IPaymentRepository } from "../payment/payment.repository";

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
    ) { }

    // ─── Late-bound collaborators (see IContestBroadcaster) ───────────────────
    private broadcaster?: IContestBroadcaster;
    private quizTerminator?: IContestQuizTerminator;

    setBroadcaster(broadcaster: IContestBroadcaster): void {
        this.broadcaster = broadcaster;
    }

    setQuizTerminator(terminator: IContestQuizTerminator): void {
        this.quizTerminator = terminator;
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

        return this.contestRepo.create(organizationId, createdById, data);
    }

    async getContest(contestId: string, organizationId: string) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");
        return contest;
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
                orderBy: { startTime: 'asc' as const },
            }),
            this.contestRepo.countPublic(where),
        ]);

        return {
            data,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getPublicContestBySlug(slug: string) {
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
        return {
            ...safeContest,
            joinCodeRequired: !!joinCode,
            totalQuestions: safeContest._count?.questions ?? 0,
            totalMarks,
            // Server's clock at the moment this payload was built. The waiting room
            // anchors its countdown to this instead of the browser clock — the quiz
            // actually starts on the SERVER's schedule, so a client whose clock drifts
            // would otherwise still show "1 min to go" while being pushed into the quiz.
            serverTime: new Date().toISOString(),
        };
    }

    async updateContest(contestId: string, organizationId: string, dto: UpdateContestInput) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        const editableStatuses: ContestStatus[] = [ContestStatus.DRAFT, ContestStatus.PUBLISHED, ContestStatus.REGISTRATION_CLOSED];
        if (!editableStatuses.includes(contest.status)) {
            throw new BadRequestError("Contest can only be edited while in DRAFT, PUBLISHED, or REGISTRATION_CLOSED status");
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

        // No job (re)scheduling here: timing fields are rejected above for anything
        // past DRAFT, and a DRAFT contest has no lifecycle jobs yet — they are created
        // by publishContest(). Post-publish timing changes go through rescheduleContest().
        return this.contestRepo.update(contestId, organizationId, { ...dto, endTime: newEndTime } as any);
    }

    async publishContest(contestId: string, organizationId: string) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        if (contest.status !== ContestStatus.DRAFT) {
            throw new BadRequestError("Only DRAFT contests can be published");
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
            await this.notifyParticipants(contestId, organizationId, MessageTemplate.CONTEST_RESCHEDULED, {
                previousDate: this.formatForParticipant(previousStartTime),
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

    private formatForParticipant(date: Date): string {
        return new Date(date).toLocaleString("en-IN", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
        });
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

    async getRegisterStatus(contestSlug: string, contactToken: string) {
        const tokenPayload = await verifyContactToken(contactToken);
        const email = tokenPayload.email;

        const contest = await this.contestRepo.findBySlugPublic(contestSlug);
        if (!contest) throw new NotFoundError("Contest not found");

        const contact = await this.contactService.findByEmailOrPhone(
            contest.organizationId,
            email
        );
        if (!contact) {
            return { existing: null };
        }

        if (!this.participantRepo) {
            return { existing: null };
        }

        const participant = await this.participantRepo.findByContactId(
            contest.organizationId,
            contest.id,
            contact.id
        );

        if (!participant) {
            return { existing: null };
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

        if (existingContact) {
            contactId = existingContact.id;
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
            this.messagingService.enqueueMessage(contest.organizationId, {
                participantId: participant.id,
                contestId: contest.id,
                channel: "EMAIL",
                template: MessageTemplate.REGISTRATION_SUCCESSFUL,
                recipient: dto.email,
                params: {
                    name: dto.firstName,
                    eventName: contest.title,
                    date: contest.startTime
                        ? new Date(contest.startTime).toLocaleDateString('en-IN', { dateStyle: 'long' })
                        : 'TBD',
                    time: contest.startTime
                        ? new Date(contest.startTime).toLocaleTimeString('en-IN', { timeStyle: 'short' })
                        : 'TBD',
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
            }
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
        let attempt = 0;

        while (true) {
            const suffix = attempt > 0 ? `-${attempt}` : "";
            const candidate = `${slug}${suffix}`;
            const existing = await this.contestRepo.findBySlug(candidate, organizationId);

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
}