import { config } from "../config";
import logger from "../config/logger";
import { MessageTemplateResolver } from "../templates/message-template-resolver";
import { TemplateParamsMap } from "../types/message-template";
import { MessageTemplate } from "../types/message-template.enum";

export interface IWhatsAppProvider {
    send<T extends MessageTemplate>(
        template: T,
        destination: string,
        params: TemplateParamsMap[T]
    ): Promise<any>;
}

export class WhatsAppProvider implements IWhatsAppProvider {

    async send<T extends MessageTemplate>(
        template: T,
        destination: string,
        params: TemplateParamsMap[T]
    ): Promise<any> {

        if (!destination) {
            throw new Error("Destination is required");
        }

        const templateConfig = MessageTemplateResolver.getWhatsApp(template);

        if (!templateConfig) {
            throw new Error(`WhatsApp template not implemented: ${template}`);
        }

        const { campaignName, build } = templateConfig;

        const { templateParams, buttons } = build(params as any);

        // Ensure all template params are strings as the API expects
        const safeTemplateParams = templateParams.map(p => String(p));


        const payload = {
            apiKey: config.messaging.whatsapp.apiKey,
            campaignName: campaignName,
            destination: destination,
            userName: params.name,
            templateParams: safeTemplateParams,
            source: "My Contact",
            ...(buttons && { buttons }),
            media: {},
            carouselCards: [],
            location: {},
            paramsFallbackValue: {
                FirstName: "user"
            }
        }

        const apiUrl = config.messaging.whatsapp.url;
        if (!apiUrl) {
            throw new Error("WHATSAPP_OTP_API_URL is not configured")
        }

        // Make API request (log payload for verification)
        logger.debug("WhatsApp payload:", payload);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${config.messaging.whatsapp.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const responseData = await response.json();
        
        logger.info(`WhatsApp message send: ${campaignName} to ${payload.userName}`);

        if (!response.ok) {
            logger.error(`WhatsApp send failed`, responseData);
            throw new Error("WhatsApp send failed")
        }

        logger.info(`WhatsApp send`, responseData);
        return responseData;
    }
}