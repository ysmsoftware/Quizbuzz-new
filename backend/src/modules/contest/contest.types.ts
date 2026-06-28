import { ContestStatus, Prisma } from "@prisma/client";

// PRIZE INPUT
export interface PrizeDTO {
  rankFrom: number;
  rankTo: number;
  amount: number;
  currency?: string | undefined;
  label?: string | undefined;
  benefits?: string[] | undefined;
}

export interface PrizeDetail {
  id: string;
  rankFrom: number;
  rankTo: number;
  amount: number;
  currency?: string | undefined;
  label?: string | undefined;
  benefits?: string[] | undefined;
}
// CREATE CONTEST

export interface CreateContestDTO {
  organizationId: string;
  createdById: string;
  title: string;
  description?: string | undefined;
  slug: string;
  details?: string | undefined;
  topics?: string[] | undefined;
  rules?: string[] | undefined;
  paymentEnabled?: boolean | undefined;
  paymentConfig?: { amount: number; currency: string; description?: string | undefined } | undefined;
  duration: number; // minutes
  cutoffScore?: number | undefined; // percentage
  maxParticipants?: number | undefined;
  registrationDeadline: Date;
  startTime: Date;
  endTime: Date;
  joinCode?: string | undefined;
  shuffleQuestions?: boolean | undefined;
  shuffleOptions?: boolean | undefined;
  proctoringEnabled?: boolean | undefined;
  showResultsAfter?: number | undefined; // hours
  prizes?: PrizeDTO[] | undefined;
  bannerImage?: string | null | undefined;
}


// UPDATE CONTEST

export type UpdateContestDTO = Partial<
  Omit<
    CreateContestDTO,
    "organizationId" | "createdById"
  >
>;

// REGISTRATION

export interface RegisterParticipantDTO {
  contestSlug: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName?: string;
  college?: string;
  department?: string;
  city?: string;
  state?: string;
  /** Idempotency key passed by client to prevent duplicate registrations */
  idempotencyKey: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegistrationResult {
  participantId: string;
  registrationRef: string;
  contestId: string;
  contactId: string;
  isFreeContest: boolean;
  status: string;
  payment?: {
    paymentOrderId?: string;
    amount?: number;
    currency?: string;
  }
}

// QUERY FILTERS

export interface ListContestsFilter {
  status?: ContestStatus | null | undefined;
  page?: number;
  limit?: number;
  search?: string | null | undefined;
  isArchived?: boolean;
}

export interface ListParticipantsFilter {
  contestId: string;
  status?: string;
  page?: number;
  limit?: number;
}

// CONTEST REPO RETURN SHAPES
// (extend as needed — keep them minimal)

export interface ContestSummary {
  id: string;
  title: string;
  slug: string;
  status: ContestStatus;
  startTime: Date;
  registrationDeadline: Date;
  registrationCount: number;
  paymentEnabled: boolean;
  paymentConfig?: { amount: number; currency: string; description?: string | null } | null;
}

export interface ContestDetail {
  id: string;
  title: string;
  slug: string;
  status: ContestStatus;
  description: string | null;
  details: string | null;
  topics: string[];
  rules: string[];
  paymentEnabled: boolean;
  paymentConfig: { amount: number; currency: string; description: string | null } | null;
  duration: number;
  cutoffScore: number | null;
  maxParticipants: number | null;
  startTime: Date;
  endTime: Date;
  registrationDeadline: Date;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  proctoringEnabled: boolean;
  showResultsAfter: number;
  joinCode: string | null;
  prizes: PrizeDetail[];
  bannerImage: string | null;
  _count: { questions: number; participants: number };
}

export type ParticipantRow = Prisma.ParticipantGetPayload<{
  include: { contact: true; payment: true };
}>;

export interface ParticipantDetail {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  college: string | null;
  department: string | null;
  city: string | null;
  state: string | null;
  registrationRef: string;
  status: string;
  registeredAt: Date;
  payment?: {
    paymentOrderId?: string;
    amount?: number;
    currency?: string;
    status?: string;
  }
}

export interface ReorderQuestionsDto {
  order: string[]; // ordered array of questionIds
}