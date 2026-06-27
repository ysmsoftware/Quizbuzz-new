import { ContestStatus, ParticipantStatus, SubmissionStatus } from "@prisma/client";
import { ContestRepository } from "./contest.repository";
import { ParticipantService } from "../participant/participant.service";
import { LeaderboardRepository } from "./leaderboard.repository";
import { MessagingService } from "../messaging/messaging.service";
import { SubmissionService } from "../submission/submission.service";
import { QuizSchedulerService } from "../quiz/quiz-scheduler.service";
import {
    CreateContestInput,
    UpdateContestInput,
    ListContestsQueryInput,
    RegisterParticipantInput,
    AssignQuestionsInput,
    ReorderQuestionsInput,
    GenerateCertificatesInput,
} from "./contest.validator";
import { BadRequestError, ConflictError, NotFoundError } from "../../error/http-errors";
import { createSlug } from "../../utils/slug";
import { generateRegistrationRef } from "../../utils/ref";
import { config } from "../../config";
import { verifyContactToken } from "../../utils/tokens";
import { ContactService } from "../contact/contact.service";
import { CreateContestDTO, ListContestsFilter } from "./contest.types";
import { MessageTemplate } from "../../types/message-template.enum";
import { messageQueue } from "../../queues";
import { rankRows } from "../../workers/leaderboard.worker";
import logger from "../../config/logger";


export class ContestService {
    constructor(
        private readonly contestRepo: ContestRepository,
        private readonly participantService: ParticipantService,
        private readonly leaderboardRepo: LeaderboardRepository,
        private readonly contactService: ContactService,
        private readonly messagingService: MessagingService,
        private readonly submissionService: SubmissionService,
        private readonly schedulerService: QuizSchedulerService,
    ) { }

    // ─── Contest CRUD ─────────────────────────────────────────────────────────

    async createContest(organizationId: string, createdById: string, input: CreateContestInput) {
        const registrationDeadline = new Date(input.registrationDeadline);
        const startTime = new Date(input.startTime);
        const endTime = new Date(startTime.getTime() + input.duration * 60 * 1000);

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
        // Strip joinCode for security — never expose to public
        const { joinCode, ...safeContest } = contest as any;
        return {
            ...safeContest,
            joinCodeRequired: !!joinCode,
        };
    }

    async updateContest(contestId: string, organizationId: string, dto: UpdateContestInput) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) throw new NotFoundError("Contest not found");

        if (contest.status !== ContestStatus.DRAFT) {
            throw new BadRequestError("Contest can only be edited while in DRAFT status");
        }

        // Recompute endTime if startTime or duration changes
        const newStartTime = dto.startTime ? new Date(dto.startTime) : contest.startTime;
        const newDuration = dto.duration ?? contest.duration;
        const newEndTime = new Date(newStartTime.getTime() + newDuration * 60 * 1000);

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

        // Schedule reminder notifications as delayed BullMQ jobs
        const now = Date.now();
        const startMs = new Date(contest.startTime).getTime();

        const delay24h = startMs - 24 * 60 * 60 * 1000 - now;
        const delay1h = startMs - 60 * 60 * 1000 - now;

        if (delay24h > 0) {
            await messageQueue.add('bulk-notify', {
                contestId, organizationId, template: MessageTemplate.WORKSHOP_REMINDER_MESSAGE,
            }, { delay: delay24h, jobId: `reminder-24h-${contestId}` });
            logger.info(`[contest] Scheduled 24h reminder for contest ${contestId}`);
        }
        if (delay1h > 0) {
            await messageQueue.add('bulk-notify', {
                contestId, organizationId, template: MessageTemplate.WORKSHOP_REMINDER_MESSAGE,
            }, { delay: delay1h, jobId: `reminder-1h-${contestId}` });
            logger.info(`[contest] Scheduled 1h reminder for contest ${contestId}`);
        }

        // Schedule automated lifecycle (start, warnings, auto-submit)
        await this.schedulerService.scheduleContestLifecycle(
            contestId,
            organizationId,
            new Date(contest.startTime),
            new Date(contest.endTime),
            contest.showResultsAfter ?? 24,
        );

        return { status: updated.status, joinCode };
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

    async registerParticipant(contestSlug: string, dto: RegisterParticipantInput) {
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

        // 4. Create Participant — wrap in P2002 guard to handle the race condition
        // where two concurrent requests pass the duplicate check above simultaneously.
        // The @@unique([contactId, contestId]) constraint catches it at DB level;
        // we translate it to a clean 409 instead of letting a 500 escape.
        const registrationRef = generateRegistrationRef();
        let participant;
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
                registrationRef,
                participantId: participant.id,
                paymentRequired: false,
                status: "REGISTERED",
            };
        }


        return {
            registrationRef,
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