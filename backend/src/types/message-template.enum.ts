export enum MessageTemplate {
    OTP_VERIFICATION_CODE = "OTP_VERIFICATION_CODE",
    BIRTHDAY_WISHES_YSM     = "BIRTHDAY_WISHES_YSM",
    FEEDBACK_COLLECTION_MESSAGE     = "FEEDBACK_COLLECTION_MESSAGE",
    CERTIFICATE_ISSUED      = "CERTIFICATE_ISSUED",
    REGISTRATION_SUCCESSFUL     = "REGISTRATION_SUCCESSFUL",
    WORKSHOP_REMINDER_MESSAGE   = "WORKSHOP_REMINDER_MESSAGE",
    PAYMENT_CONFIRMATION_MESSAGE = "PAYMENT_CONFIRMATION_MESSAGE",
    PAYOUT_TRANSFER_CONFIRMATION = "PAYOUT_TRANSFER_CONFIRMATION",

    // Admin / system templates (email-only — no Aisensy campaign)
    EMAIL_VERIFICATION       = "EMAIL_VERIFICATION",
    PASSWORD_RESET           = "PASSWORD_RESET",
    ORG_INVITE               = "ORG_INVITE",
    ADMIN_EMAIL_OTP          = "ADMIN_EMAIL_OTP",

    // Contest lifecycle
    DISQUALIFICATION_NOTICE  = "DISQUALIFICATION_NOTICE",
    RESULTS_PUBLISHED        = "RESULTS_PUBLISHED",
    CONTEST_RESCHEDULED      = "CONTEST_RESCHEDULED",
    CONTEST_CANCELLED        = "CONTEST_CANCELLED",

    // Ambassador program
    AMBASSADOR_APPLICATION_RECEIVED = "AMBASSADOR_APPLICATION_RECEIVED",
    AMBASSADOR_APPLICATION_APPROVED = "AMBASSADOR_APPLICATION_APPROVED",
    AMBASSADOR_APPLICATION_REJECTED = "AMBASSADOR_APPLICATION_REJECTED",

    CUSTOM                   = "CUSTOM",
}

/**
 * Templates that do NOT require a contestId.
 * These can be sent directly from the Contacts tab or admin flows.
 */
export const CONTACT_ONLY_TEMPLATES = new Set<MessageTemplate>([
    MessageTemplate.OTP_VERIFICATION_CODE,
    MessageTemplate.BIRTHDAY_WISHES_YSM,
    MessageTemplate.EMAIL_VERIFICATION,
    MessageTemplate.PASSWORD_RESET,
    MessageTemplate.ORG_INVITE,
    MessageTemplate.ADMIN_EMAIL_OTP,
    MessageTemplate.PAYOUT_TRANSFER_CONFIRMATION,
    MessageTemplate.AMBASSADOR_APPLICATION_RECEIVED,
    MessageTemplate.AMBASSADOR_APPLICATION_APPROVED,
    MessageTemplate.AMBASSADOR_APPLICATION_REJECTED,
]);

/**
 * Templates that require contest context (contestName, date, link, etc.)
 * If contestId is not supplied, we attempt to auto-resolve it from ContactEvent.
 * If the contact belongs to multiple contests, the caller must supply contestId explicitly.
 */
export const EVENT_REQUIRED_TEMPLATES = new Set<MessageTemplate>([
    MessageTemplate.FEEDBACK_COLLECTION_MESSAGE,
    MessageTemplate.CERTIFICATE_ISSUED,
    MessageTemplate.REGISTRATION_SUCCESSFUL,
    MessageTemplate.WORKSHOP_REMINDER_MESSAGE,
    MessageTemplate.PAYMENT_CONFIRMATION_MESSAGE,
    MessageTemplate.DISQUALIFICATION_NOTICE,
    MessageTemplate.RESULTS_PUBLISHED,
    MessageTemplate.CONTEST_RESCHEDULED,
    MessageTemplate.CONTEST_CANCELLED,
]);