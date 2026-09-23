import nodemailer from "nodemailer";
import { TemplateParamsMap } from "../types/message-template";
import { MessageTemplate } from "../types/message-template.enum";
import { MessageTemplateResolver } from "../templates/message-template-resolver";
import logger from "../config/logger";
import { config } from "../config";
import { redis } from "../config/redis";
import { EmailRateLimiter, MailboxLimits, SlotBooking } from "./email-rate-limiter";

/** Auth emails — served from the per-mailbox critical reserve so a bulk blast never delays a login. */
const CRITICAL_TEMPLATES = new Set<MessageTemplate>([
    MessageTemplate.OTP_VERIFICATION_CODE,
    MessageTemplate.ADMIN_EMAIL_OTP,
    MessageTemplate.EMAIL_VERIFICATION,
    MessageTemplate.PASSWORD_RESET,
    MessageTemplate.ORG_INVITE,
]);

/** One sending account. The pool below is the rotation order — add a second mailbox here
 *  (or, later, load the list from ops-next) and the rate limiter spreads sends across them. */
interface EmailMailbox extends MailboxLimits {
    from: string;
    transporter: nodemailer.Transporter;
}

/** Thrown when every mailbox is at its hourly cap and the caller allowed scheduling: a future
 *  slot has been BOOKED for this message, which should be retried at `slot.at` with that slot. */
export class EmailScheduledError extends Error {
    constructor(public readonly slot: SlotBooking, public readonly reason: string) {
        super(reason);
        this.name = "EmailScheduledError";
    }
}

/** Thrown when every mailbox is at its hourly cap and the caller can't wait (direct sends). Nothing was booked. */
export class EmailRateLimitedError extends Error {
    constructor() {
        super("Hourly email limit reached on every mailbox — not sent.");
        this.name = "EmailRateLimitedError";
    }
}

export interface EmailSendOptions {
    /** A slot this message already booked earlier (it's now due) — send on it, don't book again. */
    slot?: SlotBooking | undefined;
    /** When no slot is free now, book the earliest future one and throw EmailScheduledError. */
    allowSchedule?: boolean;
}

export class EmailProvider {

    // Transporters are created inside the constructor, not at module load time.
    // Creating them as a top-level constant caused them to read env vars before dotenv.config()
    // had run on the VPS, resulting in undefined credentials and 535 auth errors.
    private readonly mailboxes: EmailMailbox[];
    private readonly limiter: EmailRateLimiter;

    constructor() {
        const smtp = config.messaging.smtp;
        const user = (smtp.user ?? "").trim();
        this.mailboxes = [
            {
                id: user,
                from: `<${user}>`,
                hourlyLimit: smtp.hourlyLimit,
                criticalReserve: Math.min(smtp.criticalReserve, smtp.hourlyLimit),
                transporter: nodemailer.createTransport({
                    host: (smtp.host ?? "").trim(),
                    port: Number(smtp.port ?? "587"),
                    secure: Number(smtp.port) === 465,
                    auth: { user, pass: (smtp.pass ?? "").trim() },
                }),
            },
        ];
        this.limiter = new EmailRateLimiter(redis, {
            prefix: `${config.queue.prefix}:email-rate`,
            windowMs: 60 * 60 * 1000,
            marginMs: smtp.safetyMarginMs,
        });
    }

    async send<T extends MessageTemplate>(
        template: T,
        destination: string,
        params: TemplateParamsMap[T],
        opts: EmailSendOptions = {},
    ): Promise<any> {

        if (!destination) {
            throw new Error("Destination is required");
        }

        const templateConfig = MessageTemplateResolver.getEmail(template);

        if (!templateConfig) {
            throw new Error(`Email template not implemented: ${template}`);
        }

        const { subject, html } = templateConfig.build(params as any);

        let mailbox = opts.slot && this.mailboxes.find((m) => m.id === opts.slot!.mailboxId);
        if (!mailbox) {
            const booking = await this.limiter.book(this.mailboxes, CRITICAL_TEMPLATES.has(template), !!opts.allowSchedule);
            if (!booking) throw new EmailRateLimitedError();
            if (!booking.immediate) {
                const mb = this.mailboxes.find((m) => m.id === booking.slot.mailboxId)!;
                const at = new Date(booking.slot.at);
                throw new EmailScheduledError(
                    booking.slot,
                    `Hourly email limit reached for ${mb.id} (${mb.hourlyLimit}/h). Scheduled to send at ${at.toISOString()}.`,
                );
            }
            mailbox = this.mailboxes.find((m) => m.id === booking.slot.mailboxId)!;
        }

        return mailbox.transporter.sendMail({ from: mailbox.from, to: destination, subject, html });
    }

}


// Singleton instance — reuse the same transporter across the app
let _emailProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
    if (!_emailProvider) _emailProvider = new EmailProvider();
    return _emailProvider;
}

/** Direct (un-queued) reset email — only for an admin with no organization to log it under;
 *  everyone else goes through the messaging queue (see AdminAuthService.forgotPassword). */
export async function sendResetPasswordEmail(
    to: string,
    name: string,
    resetLink: string
): Promise<void> {
    await getEmailProvider().send(MessageTemplate.PASSWORD_RESET, to, { name, resetLink });
    logger.info(`[auth] Password reset email sent to ${to}`);
}
