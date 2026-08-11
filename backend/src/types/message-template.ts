import { MessageTemplate } from "./message-template.enum"

export type TemplateParamsMap = {

    [MessageTemplate.OTP_VERIFICATION_CODE]: {
        otp: string,
        name: string,
    },
    [MessageTemplate.BIRTHDAY_WISHES_YSM]: {
        name: string,
    },
    [MessageTemplate.FEEDBACK_COLLECTION_MESSAGE]: {
        name: string,
        eventName: string,
    },
    [MessageTemplate.CERTIFICATE_ISSUED]: {
        name: string,
        eventName: string,
        link: string,
    },
    [MessageTemplate.REGISTRATION_SUCCESSFUL]: {
        name: string,
        eventName: string,
        date: string,
        time: string,
        link: string,
        joinCode: string,
    },
    [MessageTemplate.WORKSHOP_REMINDER_MESSAGE]: {
        name: string,
        eventName: string,
        date: string,
        time: string,
        /** Participant-specific join link for the quiz (/quiz/{slug}/join), not the generic contest info page. */
        link: string,
        /** Optional — shown alongside the join link when the join code is already known. */
        joinCode?: string,
    },
    [MessageTemplate.PAYMENT_CONFIRMATION_MESSAGE]: {
        name: string,
        amount: string,
        eventName: string,
    },
    [MessageTemplate.PAYOUT_TRANSFER_CONFIRMATION]: {
        name: string,
        grossAmount: string,
        commissionPercent: string,
        commissionAmount: string,
        gatewayFeePercent: string,
        gatewayFeeAmount: string,
        gstPercent: string,
        gstAmount: string,
        totalDeducted: string,
        transferAmount: string,
        transferId: string,
    },

    // ── Admin / system templates ──────────────────────────────────────────────

    [MessageTemplate.EMAIL_VERIFICATION]: {
        name: string,
        verificationLink: string,
    },
    [MessageTemplate.PASSWORD_RESET]: {
        name: string,
        resetLink: string,
    },
    [MessageTemplate.ORG_INVITE]: {
        name: string,
        orgName: string,
        inviteLink: string,
    },
    [MessageTemplate.ADMIN_EMAIL_OTP]: {
        name: string,
        otp: string,
    },

    // ── Contest lifecycle ──────────────────────────────────────────────────────

    [MessageTemplate.DISQUALIFICATION_NOTICE]: {
        name: string,
        eventName: string,
        reason: string,
    },
    [MessageTemplate.RESULTS_PUBLISHED]: {
        name: string,
        eventName: string,
        link: string,
    },
    [MessageTemplate.CONTEST_RESCHEDULED]: {
        name: string,
        eventName: string,
        /** New start date/time — bulk-notify derives these from the updated contest. */
        date: string,
        time: string,
        /** Where the contest was scheduled before the change. */
        previousDate: string,
        reason: string,
        link: string,
    },
    [MessageTemplate.CONTEST_CANCELLED]: {
        name: string,
        eventName: string,
        date: string,
        time: string,
        reason: string,
    },
    [MessageTemplate.AMBASSADOR_APPLICATION_RECEIVED]: {
        name: string,
        orgName: string,
    },
    [MessageTemplate.AMBASSADOR_APPLICATION_APPROVED]: {
        name: string,
        orgName: string,
        link: string,
    },
    [MessageTemplate.AMBASSADOR_APPLICATION_REJECTED]: {
        name: string,
        orgName: string,
        reason: string,
    },

    [MessageTemplate.CUSTOM]: {
        name: string,
        [key: string]: string,
    },
}