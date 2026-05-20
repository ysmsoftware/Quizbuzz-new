// ============================================
// QuizBuzz Pro - Core Types
// ============================================

// Base Types
export type ContestStatus = 'draft' | 'published' | 'active' | 'completed' | 'cancelled';
export type QuestionType = 'mcq' | 'msq' | 'fill' | 'trueFalse';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type RegistrationStatus = 'pending' | 'confirmed' | 'cancelled' | 'revoked';
export type AttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'timed_out' | 'disqualified';
export type ContestPhase = 'DRAFT' | 'PUBLISHED' | 'REGISTRATION_CLOSED' | 'LIVE' | 'ENDED' | 'RESULTS_PUBLISHED' | 'CANCELLED';

// Contest & Questions
export interface Contest {
    id: string;
    title: string;
    slug: string;
    orgId: string;
    orgSlug: string;
    description: string;
    shortDescription: string;
    topic: string;
    tags: string[];
    category: string;
    difficulty: DifficultyLevel;
    status: ContestStatus;
    coverImage?: string;
    bannerImage?: string;
    thumbnailImage?: string;

    // Timing
    startTime: string;
    registrationDeadline: string;
    registrationStartDate: string;
    registrationEndDate: string;
    contestDate: string;
    contestStartTime: string;
    contestEndTime: string;
    durationMinutes: number;
    timezone: string;

    // Configuration
    totalQuestions: number;
    totalMarks: number;
    passingMarks: number;
    negativeMarking: boolean;
    negativeMarkValue?: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    allowBackNavigation: boolean;
    proctoringEnabled: boolean;
    fullscreenRequired: boolean;
    webcamRequired: boolean;
    tabSwitchLimit: number;
    allowedDevices?: ('mobile' | 'desktop' | 'tablet')[];

    // Registration & Fees
    fee: number;
    currency: string;
    registrationFee: number;
    maxParticipants: number;
    currentParticipants: number;
    razorpayKeyId?: string;

    // Content
    rules?: string[];
    prizes?: Prize[];
    registrationFields?: RegistrationField[];

    // Lifecycle
    publishedAt: string | null;
    cancelledAt: string | null;
    resultsPublishedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    organizerId: string;
    joinCode?: string | null;

    // Stats
    _count?: {
        participants?: number;
        payments?: number;
        submissions?: number;
        questions?: number;
    };
}

export interface RegistrationField {
    id: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'email' | 'tel';
    required: boolean;
    options?: string[];
    placeholder?: string;
}

export interface Prize {
    rank: number | string; // 1, 2, 3 or "4-10"
    title: string;
    amount?: number;
    description?: string;
}

export interface Question {
    id: string;
    contestId: string;
    questionNumber: number;
    type: QuestionType;
    text: string;
    imageUrl?: string;
    options: Option[];
    correctOptionIds: string[];
    marks: number;
    negativeMarks: number;
    explanation?: string;
    hint?: string;
    difficulty: DifficultyLevel;
    tags?: string[];
}

export interface Option {
    id: string;
    text: string;
    imageUrl?: string;
}

// Registration & Participants
export interface Registration {
    id: string;
    contestId: string;
    participantId: string;
    status: RegistrationStatus;
    registeredAt: string;
    paymentId?: string;
    paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
    amount?: number;
    paymentMethod?: string;
    participantDetails: ParticipantDetails;

    // Custom Fields & Opt-ins
    whatsappOptIn?: boolean;
    customFields?: Record<string, string>;

    // Quiz Status (for LIVE/ENDED)
    quizStatus?: 'not_joined' | 'waiting' | 'answering' | 'submitted' | 'absent';
    currentQuestionIndex?: number;
    totalQuestions?: number;
    joinedAt?: string;
    submittedAt?: string;
    lastActivityAt?: string;
    proctoringWarnings?: Array<{ type: string; count: number }>;
}

export interface ParticipantDetails {
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth?: string;
    institution?: string;
    city?: string;
    state?: string;
    country?: string;
    profileImage?: string;
}

// Quiz Attempt
export interface QuizAttempt {
    id: string;
    registrationId: string;
    contestId: string;
    participantId: string;
    status: AttemptStatus;
    startedAt?: string;
    submittedAt?: string;
    timeSpentSeconds: number;
    answers: Answer[];
    score?: number;
    rank?: number;
    percentile?: number;
    proctoringViolations: ProctoringViolation[];
}

export interface Answer {
    questionId: string;
    selectedOptionIds: string[];
    isMarkedForReview: boolean;
    timeSpentSeconds: number;
    answeredAt?: string;
}

export interface ProctoringViolation {
    type: 'tab_switch' | 'fullscreen_exit' | 'face_not_detected' | 'multiple_faces';
    timestamp: string;
    count: number;
}

// Results & Leaderboard
export interface QuizResult {
    attemptId: string;
    contestId: string;
    participantId: string;
    participantName: string;
    score: number;
    totalMarks: number;
    correctAnswers: number;
    wrongAnswers: number;
    unattempted: number;
    timeTaken: string;
    rank: number;
    totalParticipants: number;
    percentile: number;
    isPassed: boolean;
    breakdown: ResultBreakdown[];
}

export interface ResultBreakdown {
    questionId: string;
    questionNumber: number;
    questionText: string;
    yourAnswer: string[];
    correctAnswer: string[];
    isCorrect: boolean;
    marksObtained: number;
    maxMarks: number;
}

export interface LeaderboardEntry {
    rank: number;
    participantId: string;
    participantName: string;
    profileImage?: string;
    score: number;
    timeTaken: string;
    institution?: string;
}

// Form Types
export interface RegistrationFormData {
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth?: string;
    institution?: string;
    city?: string;
    state?: string;
    country: string;
    agreeToTerms: boolean;
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// Filter Types
export interface ContestFilters {
    status?: ContestStatus;
    category?: string;
    difficulty?: DifficultyLevel;
    search?: string;
    dateRange?: {
        start: string;
        end: string;
    };
}

// ============================================
// Messaging & Templates
// ============================================

export type MessageChannel = 'whatsapp' | 'email' | 'both';
export type MessageStatus = 'draft' | 'scheduled' | 'sent' | 'failed';
export type SystemEventType = 'registration_confirmed' | 'day_before_reminder' | 'hour_reminder' | 'contest_started' | 'results_published' | 'certificate_ready';
export type RecipientFilter = 'all' | 'confirmed' | 'paid' | 'custom';

export interface MessageTemplate {
    id: string;
    orgId: string;
    name: string;
    subject?: string;
    channel: MessageChannel;
    body: string;
    variables: string[];
    isSystem: boolean;
    systemEvent?: SystemEventType;
    createdAt: string;
    updatedAt: string;
}

export interface MessageDraft {
    id: string;
    contestId: string;
    templateId: string;
    channel: MessageChannel;
    recipientFilter: RecipientFilter;
    customFilter?: Record<string, any>;
    recipientCount: number;
    scheduledFor?: string;
    status: MessageStatus;
    createdAt: string;
}

export interface SentMessage {
    id: string;
    contestId: string;
    templateId: string;
    channel: MessageChannel;
    sentAt: string;
    totalRecipients: number;
    deliveredCount: number;
    failedCount: number;
    status: 'sent' | 'partial' | 'failed';
}

// ============================================
// Organization & Team
// ============================================

export type TeamRole = 'admin' | 'editor' | 'viewer';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    description?: string;
    website?: string;
    industry?: string;
    logo?: string;
    favicon?: string;
    primaryColor?: string;
    secondaryColor?: string;
    razorpayKeyId?: string;
    razorpayKeySecret?: string;
    testMode: boolean;
    aisensynAPIKey?: string;
    whatsappNumber?: string;
    smtpConfig?: {
        host: string;
        port: number;
        username: string;
        password: string;
        from: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface TeamMember {
    id: string;
    orgId: string;
    email: string;
    name: string;
    role: TeamRole;
    status: 'active' | 'inactive';
    joinedAt: string;
}

export interface TeamInvitation {
    id: string;
    orgId: string;
    email: string;
    role: TeamRole;
    status: InvitationStatus;
    sentAt: string;
    expiresAt: string;
    acceptedAt?: string;
}

export interface ParticipantProfile {
    id: string;
    participantId: string;
    fullName: string;
    email: string;
    phone: string;
    avatar?: string;
    bio?: string;
    socialLinks?: {
        linkedin?: string;
        twitter?: string;
        github?: string;
    };
    notificationPreferences: {
        emailReminders: boolean;
        whatsappReminders: boolean;
        emailResults: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

// ============================================
// API Server Types (real backend)
// ============================================

/**
 * Admin user from GET /auth/admin/me
 */
export interface AdminUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    emailVerified: boolean;
}

/**
 * Organization membership from /auth/admin/me
 */
export interface OrgMembership {
    id: string;
    name: string;
    slug: string;
    role: 'OWNER' | 'ADMIN' | 'VIEWER';
}

/**
 * Server contest shape from GET /contests/:id
 */
export interface ServerContest {
    id: string;
    title: string;
    slug: string;
    status: 'DRAFT' | 'PUBLISHED' | 'REGISTRATION_CLOSED' | 'LIVE' | 'EVALUATION' | 'RESULTS_OUT' | 'COMPLETED' | 'CANCELLED';
    description?: string;
    details?: string;
    topics?: string[];
    rules?: string[];
    paymentEnabled: boolean;
    paymentConfig?: {
        amount: number;
        currency: string;
        description?: string;
    };
    duration: number;
    cutoffScore?: number;
    maxParticipants?: number;
    registrationDeadline: string;
    startTime: string;
    endTime: string;
    joinCode: string | null;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResultsAfter: number;
    prizes?: Array<{
        rankFrom: number;
        rankTo: number;
        prize: string;
        benefits?: string[];
    }>;
    createdAt: string;
    updatedAt: string;
}

/**
 * Server question shape
 */
export interface ServerQuestion {
    id: string;
    questionText: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    hint?: string;
    explanation?: string;
    tags?: string[];
    options: ServerOption[];
    createdAt: string;
}

/**
 * Server option shape
 */
export interface ServerOption {
    id: string;
    text: string;
    isCorrect: boolean;
    position: number;
}

/**
 * Contest participant shape from GET /contests/:contestId/participants/:participantId
 */
export interface ContestParticipant {
    id: string;
    registrationRef: string;
    status: 'REGISTERED' | 'CHECKED_IN' | 'IN_WAITING' | 'IN_QUIZ' | 'SUBMITTED' | 'DISQUALIFIED' | 'ABSENT';
    joinedAt?: string;
    checkedInAt?: string;
    contact?: {
        id: string;
        email: string;
        phone?: string;
        firstName: string;
        lastName?: string;
        college?: string;
        department?: string;
        city?: string;
        state?: string;
    };
}
