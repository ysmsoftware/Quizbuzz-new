import nodemailer from "nodemailer";
import { TemplateParamsMap } from "../types/message-template";
import { MessageTemplate } from "../types/message-template.enum";
import { MessageTemplateResolver } from "../templates/message-template-resolver";
import logger from "../config/logger";
import { config } from "../config";
import { renderEmailLayout, emailButton, linkFallback, P, SMALL } from "../templates/email-layout";

export interface IEmailProvider {
    send<T extends MessageTemplate>(
        template: T,
        destination: string,
        params: TemplateParamsMap[T]
    ): Promise<any>;
}

export class EmailProvider {

    // Transporter is created lazily inside the constructor, not at module load time.
    // Creating it as a top-level constant caused it to read env vars before dotenv.config()
    // had run on the VPS, resulting in undefined credentials and 535 auth errors.
    public transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: (config.messaging.smtp.host ?? "").trim(),
            port: Number((config.messaging.smtp.port ?? "587")),
            secure: (config.messaging.smtp.port ?? "") === 465,
            auth: {
                user: (config.messaging.smtp.user ?? "").trim(),
                pass: (config.messaging.smtp.pass ?? "").trim(),
            },
        });
    }

    async send<T extends MessageTemplate>(
        template: T,
        destination: string,
        params: TemplateParamsMap[T]
    ): Promise<any> {

        if (!destination) {
            throw new Error("Destination is required");
        }

        const templateConfig = MessageTemplateResolver.getEmail(template);

        if (!templateConfig) {
            throw new Error(`Email template not implemented: ${template}`);
        }

        const { subject, html } = templateConfig.build(params as any);

        const info = await this.transporter.sendMail({
            from: `<${config.messaging.smtp.user}>`,
            to: destination,
            subject,
            html,
        });

        return info;
    }

}


// Singleton instance — reuse the same transporter across the app
let _emailProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
    if (!_emailProvider) _emailProvider = new EmailProvider();
    return _emailProvider;
}

export async function sendResetPasswordEmail(
    to: string,
    name: string,
    resetLink: string
): Promise<void> {
    const provider = getEmailProvider();

    // Build the HTML inline — this is a transactional auth email,
    // not a campaign template, so it lives here not in the template resolver.
    // Uses the shared branded layout so it looks consistent with every
    // other QuizBuzz email.
    const html = renderEmailLayout({
        preheader: "Reset your QuizBuzz password",
        heading: "Reset your password",
        bodyHtml: `
            <p style="${P}">Hi ${name},</p>
            <p style="${P}">We received a request to reset your QuizBuzz password. Click the button below — this link expires in <strong>15 minutes</strong>.</p>
            ${emailButton("Reset Password", resetLink)}
            <p style="${SMALL}">If you didn't request this, you can safely ignore this email. Your password will not change.</p>
            ${linkFallback(resetLink)}
        `,
    });

    await provider.transporter.sendMail({
        from: `<${config.messaging.smtp.user}>`,
        to,
        subject: "Reset your password — QuizBuzz",
        html,
    });

    logger.info(`[auth] Password reset email sent to ${to}`);
}