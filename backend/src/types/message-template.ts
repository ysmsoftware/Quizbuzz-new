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
        link: string,
    },
    [MessageTemplate.PAYMENT_CONFIRMATION_MESSAGE]: {
        name: string,
        amount: string,
        eventName: string,
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
    [MessageTemplate.CUSTOM]: {
        name: string,
        [key: string]: string,
    },
}