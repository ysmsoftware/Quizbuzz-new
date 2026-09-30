import { ContactRepository } from "./contact.repository";
import { MessagingService } from "../messaging/messaging.service";
import { CertificateService } from "../certificate/certificate.service";
import {
    ContactCertificateItem,
    ContactContestSummary,
    ContactListItem,
    ContactMessageItem,
    ContactResult,
    CreateContactDTO,
    FindContactsFilter,
    ListContactsQueryDTO,
    PaginatedContactsResult,
    UpdateContactDTO,
} from "./contact.types";
import { ConflictError, NotFoundError, } from "../../error/http-errors";

export class ContactService {

    constructor(
        private readonly contactRepo: ContactRepository,
        private readonly messagingService: MessagingService,
        private readonly certificateService: CertificateService,
    ) { }

    async create(organizationId: string, data: CreateContactDTO): Promise<ContactResult> {
        const existingByEmail = await this.contactRepo.findByEmail(data.email, organizationId);
        if (existingByEmail) {
            throw new ConflictError(`A contact with email "${data.email}" already exists in this organization.`);
        }

        if (data.phone) {
            const existingByPhone = await this.contactRepo.findByPhone(data.phone, organizationId);
            if (existingByPhone) {
                throw new ConflictError(`A contact with phone "${data.phone}" already exists in this organization.`);
            }
        }

        const contact = await this.contactRepo.create({ organizationId, ...data });

        return this._toContactResult(contact);
    }


    async findByEmailOrPhone(
        organizationId: string,
        email?: string,
        phone?: string
    ): Promise<ContactResult | null> {
        if (!email && !phone) return null;
        const contact = await this.contactRepo.findByEmailOrPhone(organizationId, email, phone);
        if (!contact) return null;
        return this._toContactResult(contact);
    }

    async lookup(organizationId: string, query: { email?: string; phone?: string }): Promise<ContactResult | null> {
        return this.findByEmailOrPhone(organizationId, query.email, query.phone);
    }

    async createForRegistration(
        organizationId: string,
        data: CreateContactDTO
    ): Promise<ContactResult> {
        const contact = await this.contactRepo.upsertByEmail({
            organizationId,
            ...data,
        });
        return this._toContactResult(contact);
    }

    // Read - single 

    async getById(id: string, organizationId: string): Promise<ContactResult> {
        const contact = await this.contactRepo.findById(id, organizationId);
        if (!contact) {
            throw new NotFoundError("Contact not found.");
        }
        return this._toContactResult(contact);
    }

    async list(organizationId: string, query: ListContactsQueryDTO): Promise<PaginatedContactsResult> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const filter: FindContactsFilter = {
            organizationId,
            skip,
            take: limit,
            ...(query.search !== undefined ? { search: query.search } : {}),
            ...(query.city !== undefined ? { city: query.city } : {}),
            ...(query.state !== undefined ? { state: query.state } : {}),
            ...(query.college !== undefined ? { college: query.college } : {}),
            ...(query.collegeId !== undefined ? { collegeId: query.collegeId } : {}),
            ...(query.letter !== undefined ? { letter: query.letter } : {}),
            ...(query.sortBy !== undefined ? { sortBy: query.sortBy } : {}),
            ...(query.sortOrder !== undefined ? { sortOrder: query.sortOrder } : {}),
        };

        const { rows, total } = await this.contactRepo.findAll(filter);

        const data: ContactListItem[] = rows.map((row) => ({
            id: row.id,
            email: row.email,
            phone: row.phone,
            firstName: row.firstName,
            lastName: row.lastName,
            college: row.college,
            city: row.city,
            state: row.state,
            createdAt: row.createdAt,
        }));

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async update(id: string, organizationId: string, data: UpdateContactDTO): Promise<ContactResult> {
        const existing = await this.contactRepo.findById(id, organizationId);
        if (!existing) {
            throw new NotFoundError("Contact not found.");
        }

        if (data.phone && data.phone !== existing.phone) {
            const phoneConflict = await this.contactRepo.findByPhone(
                data.phone,
                organizationId
            );
            if (phoneConflict && phoneConflict.id !== id) {
                throw new ConflictError(
                    `Another contact with phone "${data.phone}" already exists.`
                );
            }
        }

        const updated = await this.contactRepo.updateById(id, organizationId, data);
        return this._toContactResult(updated);
    }


    async softDelete(id: string, organizationId: string): Promise<void> {
        const existing = await this.contactRepo.findById(id, organizationId);
        if (!existing) {
            throw new NotFoundError("Contact not found.");
        }
        await this.contactRepo.softDeleteById(id, organizationId);
    }

    // Relation read-throughs

    async getContests(
        id: string,
        organizationId: string
    ): Promise<ContactContestSummary[]> {
        const result = await this.contactRepo.findContestsByContactId(id, organizationId);
        if (!result) {
            throw new NotFoundError("Contact not found.");
        }

        return result.participants.map((p) => {
            const contestPrice = p.contest.paymentConfig?.amount ?? 0; // PaymentConfig.amount is rupees
            return {
                participantId: p.id,
                registrationRef: p.registrationRef,
                contestId: p.contest.id,
                contestTitle: p.contest.title,
                contestSlug: p.contest.slug,
                contestStartTime: p.contest.startTime,
                status: p.status,
                registeredAt: p.createdAt,
                checkedInAt: p.checkedInAt,
                joinedAt: p.joinedAt,
                disqualificationReason: p.disqualificationReason,
                contestPrice,
                payment: p.payment ? {
                    id: p.payment.id,
                    status: p.payment.status,
                    amount: p.payment.amount / 100,
                    currency: p.payment.currency,
                    razorpayOrderId: p.payment.razorpayOrderId,
                    razorpayPaymentId: p.payment.razorpayPaymentId,
                    paidAt: p.payment.paidAt,
                    attempts: p.payment.attempts,
                    failureReason: p.payment.failureReason,
                    createdAt: p.payment.createdAt,
                    orders: p.payment.orders.map((o) => ({ ...o, amount: o.amount / 100 })),
                } : undefined,
                certificate: p.certificate ? {
                    id: p.certificate.id,
                    status: p.certificate.status,
                    generatedAt: p.certificate.generatedAt,
                    deliveredAt: p.certificate.deliveredAt,
                    fileUrl: p.certificate.fileUrl,
                } : undefined,
                submission: p.submission ? {
                    id: p.submission.id,
                    status: p.submission.status,
                    submittedAt: p.submission.submittedAt,
                    score: p.submission.score ? p.submission.score.toString() : '0',
                    percentage: p.submission.percentage ? p.submission.percentage.toString() : '0',
                    rank: p.leaderboard ? p.leaderboard.rank : 0,
                    totalQuestions: p.submission.totalQuestions,
                    attempted: p.submission.attempted,
                    correct: p.submission.correct,
                    wrong: p.submission.wrong,
                    skipped: p.submission.skipped,
                    isPassed: p.submission.isPassed,
                    timeTakenSecs: p.submission.timeTakenSecs,
                } : undefined,
            };
        });
    }

    async getMessages(id: string, organizationId: string, page: number, limit: number): Promise<{ data: ContactMessageItem[]; total: number; totalPages: number }> {
        return this.messagingService.getMessagesByContact(id, organizationId, page, limit);
    }

    async getCertificates(id: string, organizationId: string, page: number, limit: number): Promise<{ data: ContactCertificateItem[]; total: number; totalPages: number }> {
        const result = await this.certificateService.getCertificatesByContact(id, organizationId, page, limit);
        return {
            data: result.data.map(c => ({
                id: c.id,
                contestId: c.contestId,
                contestTitle: c.contest?.title ?? "Unknown Contest",
                status: c.status,
                fileUrl: c.fileUrl,
                generatedAt: c.generatedAt,
                deliveredAt: c.deliveredAt
            })),
            total: result.total,
            totalPages: result.totalPages
        };
    }

    // helpers 

    // Map a raw Prisma Contact row to the clean ContactResult shape
    private _toContactResult(contact: {
        id: string;
        email: string;
        phone: string | null;
        firstName: string;
        lastName: string | null;
        college: string | null;
        department: string | null;
        collegeId: string | null;
        departmentId: string | null;
        city: string | null;
        state: string | null;
        createdAt: Date;
        updatedAt: Date;
    }): ContactResult {
        return {
            id: contact.id,
            email: contact.email,
            phone: contact.phone,
            firstName: contact.firstName,
            lastName: contact.lastName,
            college: contact.college,
            department: contact.department,
            collegeId: contact.collegeId,
            departmentId: contact.departmentId,
            city: contact.city,
            state: contact.state,
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt,
        };
    }
}