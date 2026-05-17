import { MessageChannel } from "@prisma/client";
import { EmailProvider } from "./email.provider";
import { WhatsAppProvider } from "./whatsapp.provider";

// Providers are created lazily on first use, NOT at module load time.
// Module-level instantiation runs before dotenv.config() on the VPS worker
// process, causing env vars to be undefined and SMTP auth to fail with 535.
let emailProvider: EmailProvider | null = null;
let whatsappProvider: WhatsAppProvider | null = null;

export class MessageProvider {
    static getProvider(type: MessageChannel) {
        switch (type) {
            case "EMAIL":
                if (!emailProvider) emailProvider = new EmailProvider();
                return emailProvider;
            case "WHATSAPP":
                if (!whatsappProvider) whatsappProvider = new WhatsAppProvider();
                return whatsappProvider;
            default:
                throw new Error(`Unsupported message type: ${type}`);
        }
    }
}