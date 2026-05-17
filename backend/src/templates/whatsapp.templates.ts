import { MessageTemplate } from "../types/message-template.enum";
import { TemplateParamsMap } from "../types/message-template";

export const WhatsAppTemplates: {
    [K in MessageTemplate ]?: {
        campaignName: string;
        build: (params: TemplateParamsMap[K]) => {
            templateParams: string[];
            buttons?: any[];
        };
    };
} = {
     [MessageTemplate.OTP_VERIFICATION_CODE]: {
        campaignName: "otp verification code",
        build: (params) => ({
            templateParams: [
                params.otp,
            ]
        })
    },
    [MessageTemplate.BIRTHDAY_WISHES_YSM]: {
        campaignName: "birthday_wishes_ysm",
        build: (params) => ({
            templateParams: [
                params.name,
            ]
        })
    },
    [MessageTemplate.FEEDBACK_COLLECTION_MESSAGE]: {
        campaignName: "feedback_collection_message",
        build: (params) => ({
            templateParams: [
                params.name,
                params.eventName,
            ]
        })
    },
    [MessageTemplate.CERTIFICATE_ISSUED]: {
        campaignName: "certificate_issued",
        build: (params) => ({
            templateParams: [
                params.name,
                params.eventName,
                params.link
            ]
        })
    },
    [MessageTemplate.REGISTRATION_SUCCESSFUL]: {
        campaignName: "registration_successful",
        build: (params) => ({
            templateParams: [
                params.name,
                params.eventName,
                params.date,
                params.time,
                params.link,
            ]
        })
    },
    [MessageTemplate.WORKSHOP_REMINDER_MESSAGE]: {
        campaignName: "workshop_reminder_message",
        build: (params) => ({
            templateParams: [
                params.name,
                params.eventName,
                params.date,
                params.time,
                params.link,
            ]
        })
    },
    [MessageTemplate.PAYMENT_CONFIRMATION_MESSAGE]: {
        campaignName: "payment_confirmation_message",
        build: (params) => ({
            templateParams: [
                params.name,
                params.amount,
                params.eventName,

            ]
        })
    },
}