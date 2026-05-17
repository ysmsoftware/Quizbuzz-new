import { MessageTemplate } from "../types/message-template.enum";
import { EmailTemplates } from "./email.templates";
import { WhatsAppTemplates } from "./whatsapp.templates";

export class MessageTemplateResolver {

    static getWhatsApp(template: MessageTemplate) {
        const t = WhatsAppTemplates[template];
        if (!t) {
            throw new Error(`WhatsApp template for ${template} not found`);
        }
        return t;
    }
    static getEmail(template: MessageTemplate) { 
        const t = EmailTemplates[template];
        if(!t) {
            throw new Error(`Email template for ${template} not found`);
        }
        return t;
    }

    // Later we can add methods for SMS or other channels as needed
    /**
    static getSms(template: MessageTemplate) { 
        return SmsTemplates[template];
    }
    */
}