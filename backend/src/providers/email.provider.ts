import nodemailer from "nodemailer";
import { TemplateParamsMap } from "../types/message-template";
import { MessageTemplate } from "../types/message-template.enum";
import { MessageTemplateResolver } from "../templates/message-template-resolver";
import logger from "../config/logger";
import { config } from "../config";

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
    // not a campaign template, so it lives here not in the template resolver
    const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
            <h2 style="color:#1a1a1a;">Reset your password</h2>
            <p>Hi ${name},</p>
            <p>We received a request to reset your SmartFormFlow password.</p>
            <p>Click the button below. This link expires in <strong>15 minutes</strong>.</p>
            <a href="${resetLink}"
               style="display:inline-block;padding:12px 24px;background:#6d28d9;
                      color:#fff;border-radius:6px;text-decoration:none;font-weight:600;
                      margin:16px 0;">
                Reset Password
            </a>
            <p style="color:#666;font-size:13px;">
                If you didn't request this, you can safely ignore this email.
                Your password will not change.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
            <p style="color:#999;font-size:12px;">
                Or copy this link into your browser:<br/>
                <span style="word-break:break-all;">${resetLink}</span>
            </p>
        </div>
    `;

    await provider.transporter.sendMail({
        from: `<${config.messaging.smtp.user}>`,
        to,
        subject: "Reset your password",
        html,
    });

    logger.info(`[auth] Password reset email sent to ${to}`);
}