/**
 * Quiz Module — Type Definitions
 *
 * Central type file for the real-time quiz conduction system.
 * Covers session state, WebSocket event payloads, proctoring,
 * identity auditing snapshots, and admin dashboard events.
 */

// ─── Quiz Phase (participant lifecycle within a quiz) ─────────────────────────

export type QuizPhase =
    | "AUTHENTICATING"
    | "WAITING"
    | "IN_QUIZ"
    | "SUBMITTED"
    | "DISCONNECTED";

// ─── Auth Steps ───────────────────────────────────────────────────────────────

export type AuthStep = "otp" | "joincode";

// ─── Readiness State (waiting room checks) ────────────────────────────────────

export interface ReadinessState {
    camera: boolean;
    otp: boolean;
    joincode: boolean;
}

// ─── Session State (stored in Redis hash) ─────────────────────────────────────

export interface QuizSessionState {
    contestId: string;
    organizationId: string;
    participantId: string;
    contactId: string;
    socketId: string;
    phase: QuizPhase;
    seed: string;
    startedAt: string;          // ISO string
    currentQuestion: number;    // 0-based index of last answered question
    totalQuestions: number;
    contestEndTime: string;     // ISO string — absolute quiz deadline
    violationCount: number;
    lastHeartbeatAt: string;    // ISO string
}

// ─── Snapshot / Identity Auditing ─────────────────────────────────────────────

export type CaptureType = "START" | "MID_POINT" | "RANDOM" | "PRE_SUBMIT";

export interface SnapshotCapture {
    participantId: string;
    contestId: string;
    organizationId: string;
    captureType: CaptureType;
    imageBase64: string;
    timestamp: string;          // ISO string
}

export interface SnapshotMetadata {
    id: string;
    participantId: string;
    contestId: string;
    captureType: CaptureType;
    s3Key: string;
    capturedAt: Date;
}

// ─── Proctoring Violations ────────────────────────────────────────────────────

export type ViolationType =
    | "FACE_NOT_DETECTED"
    | "MULTIPLE_FACES"
    | "AUDIO_ANOMALY"
    | "POOR_LIGHTING"
    | "GAZE_AWAY"
    | "TAB_SWITCH"
    | "WINDOW_BLUR"
    | "FULLSCREEN_EXIT"
    | "SCREEN_RESIZE";

export type ViolationSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface ViolationEvent {
    type: ViolationType;
    severity: ViolationSeverity;
    metadata?: Record<string, unknown>;
    timestamp: string;          // ISO string
}

export interface ViolationRecord extends ViolationEvent {
    participantId: string;
    contestId: string;
    organizationId: string;
}

export interface ViolationSummary {
    total: number;
    byType: Partial<Record<ViolationType, number>>;
    flagged: boolean;
    threshold: number;
}

// ─── Client → Server Payloads ─────────────────────────────────────────────────

export interface AuthenticatePayload {
    contestSlug: string;
    contactToken: string;
}

export interface VerifyOtpPayload {
    otp: string;
    contestId?: string;
}

export interface VerifyJoinCodePayload {
    joinCode: string;
}

export interface ReadyCheckPayload {
    cameraGranted: boolean;
}

export interface AnswerPayload {
    questionId: string;
    selectedOptionId: string | null;   // null = skip / clear selection
    answeredAt: string;                // ISO string — client timestamp
}

export interface SnapshotPayload {
    imageBase64: string;
    captureType: CaptureType;
    timestamp: string;
}

export interface JoinPayload {
    participantId: string;
}

export interface ViolationPayload {
    type: ViolationType;
    severity: ViolationSeverity;
    metadata?: Record<string, unknown>;
}

export interface SubmitPayload {
    reason?: "MANUAL" | "AUTO";
}

// ─── Server → Client Payloads ─────────────────────────────────────────────────

export interface AuthSuccessPayload {
    participantId: string;
    sessionToken: string;
    steps: AuthStep[];
}

export interface OtpSentPayload {
    channel: "EMAIL" | "WHATSAPP";
    maskedRecipient: string;
}

export interface StepVerifiedPayload {
    step: AuthStep;
    allComplete: boolean;
}

export interface WaitingRoomPayload {
    contestTitle: string;
    startTime: string;
    participantCount: number;
}

export interface QuizStartPayload {
    questions: unknown[];   // ParticipantQuestionView[] — typed at the service layer
    totalTimeMs: number;
    serverTimestamp: string;
}

export interface AnswerAckPayload {
    questionId: string;
    saved: boolean;
}

export interface TimeWarningPayload {
    secondsRemaining: number;
}

export interface SubmittedPayload {
    submissionRef: string;
}

export interface ViolationWarningPayload {
    type: ViolationType;
    count: number;
    threshold: number;
}

export interface ReconnectedPayload {
    phase: QuizPhase;
    questions: unknown[];
    savedAnswers: Record<string, { selectedOptionId: string | null; answeredAt: string }>;
    remainingTimeMs: number;
    serverTimestamp: string;
}

export interface SessionKilledPayload {
    reason: string;
}

export interface QuizErrorPayload {
    code: string;
    message: string;
}

// ─── Admin Dashboard Payloads ─────────────────────────────────────────────────

export interface AdminSubscribePayload {
    contestId: string;
}

export interface AdminWaitingRoomUpdate {
    contestId: string;
    count: number;
    participants: Array<{ id: string; name: string; joinedAt: string }>;
}

export interface AdminParticipantJoined {
    participantId: string;
    name: string;
    timestamp: string;
}

export interface AdminViolationAlert {
    participantId: string;
    name: string;
    type: ViolationType;
    severity: ViolationSeverity;
    count: number;
    threshold: number;
}

export interface AdminLiveStats {
    contestId: string;
    active: number;
    submitted: number;
    waiting: number;
    totalViolations: number;
}

export interface AdminSubmissionReceived {
    participantId: string;
    name: string;
    timestamp: string;
}

// ─── Internal Service Types ───────────────────────────────────────────────────

export interface QuizAuthResult {
    participantId: string;
    contactId: string;
    contestId: string;
    organizationId: string;
    sessionToken: string;
    requiredSteps: AuthStep[];
    contestTitle: string;
    contestStartTime: string;
    contestEndTime: string;
    contestDuration: number;        // minutes
    joinCodeRequired: boolean;
}

export interface SavedAnswer {
    selectedOptionId: string | null;
    answeredAt: string;
}

export interface QuizSubmitResult {
    submissionRef: string;
    timeTakenSecs: number;
    totalQuestions: number;
    attempted: number;
}
