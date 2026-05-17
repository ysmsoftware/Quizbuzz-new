import { MessageTemplate } from "../types/message-template.enum";
import { TemplateParamsMap } from "../types/message-template";

export const EmailTemplates: {
    [K in MessageTemplate]?: {
        build: (params: TemplateParamsMap[K]) => {
            subject: string;
            html: string;
        };
    };
} = {
    [MessageTemplate.OTP_VERIFICATION_CODE]: {
        build: (params) => ({
            subject: `Your OTP for YSM Info Solution`,
            html: `
                <p>Your One-Time Password (OTP) is: <strong>${params.otp}</strong></p>
                <p>This OTP is valid for the next 10 minutes. Please do not share it with anyone.</p>
                <p>If you did not request this OTP, please ignore this email.</p>
                <p>Thank You!<br/> - Team YSM Info Solution</p>
            `,
        }),
    },
    [MessageTemplate.BIRTHDAY_WISHES_YSM]: {
        build: (params) => ({
            subject: `Happy Birthday from YSM Info Solution! 🎂`,
            html: `
                <p>Hello ${params.name},</p>
                <p>Team <strong>YSM Info Solution</strong> wishes you a very <strong>Happy Birthday!</strong> 🎉</p>
                <p>May this year bring you success, growth and new opportunities.</p>
                <p>Keep shining and keep learning!<br/> - Team YSM Info Solution</p>
            `,
        }),
    },

    [MessageTemplate.FEEDBACK_COLLECTION_MESSAGE]: {
        build: (params) => ({
            subject: `We Value Your Feedback - ${params.name}`,
            html: `
                <p>Dear ${params.name},</p>
                <p>Thank you for being part of <strong>${params.eventName}</strong>.</p>
                <p>Please share your feedback: <a href="https://g.page/r/CbW3sg1807sqEBM/review">Click here</a></p>
                <p>Your input helps us improve and serve students better.<br/> - Team YSM Info Solution</p>
            `,
        }),
    },

    [MessageTemplate.CERTIFICATE_ISSUED]: {
        build: (params) => ({
            subject: `Certificate Issued - ${params.eventName}`,
            html: `
                <p>Hello ${params.name},</p>
                <p>Your certificate for <strong>${params.eventName}</strong> has been issued.</p>
                <p><a href="${params.link}">Download Certificate</a></p>
                <p>Keep learning & growing!<br/> - YSM Info Solution</p>
            `,
        }),
    },
    [MessageTemplate.REGISTRATION_SUCCESSFUL]: {
        build: (params) => ({
            subject: `Registration Successful - ${params.eventName}`,
            html: `
                <p>Dear ${params.name},</p>
                <p>Thank you for registering for <strong>${params.eventName}</strong> at YSM Info Solution.</p>
                <p>📅 <strong>Date:</strong> ${params.date}</p>
                <p>⏰ <strong>Time:</strong> ${params.time}</p>
                <p>📍 <strong>Location/Link:</strong> <a href="${params.link}">${params.link}</a></p>
                <p>We look forward to your participation. For queries, contact: +91 898 308 3698<br/> - Team YSM Info Solution</p>
            `,
        }),
    },

    [MessageTemplate.WORKSHOP_REMINDER_MESSAGE]: {
        build: (params) => ({
            subject: `Reminder: ${params.eventName} is Coming Up!`,
            html: `
                <p>Dear ${params.name},</p>
                <p>This is a reminder for your registered program: <strong>${params.eventName}</strong></p>
                <p>📅 <strong>Date:</strong> ${params.date}</p>
                <p>⏰ <strong>Time:</strong> ${params.time}</p>
                <p>📍 <strong>Venue/Link:</strong> <a href="${params.link}">${params.link}</a></p>
                <p>Kindly be available 10 minutes before the scheduled time.</p>
                <p>We look forward to your participation.<br/> - Team YSM Info Solution</p>
            `,
        }),
    },

    // ── Admin / system templates ──────────────────────────────────────────────

    [MessageTemplate.EMAIL_VERIFICATION]: {
        build: (params) => ({
            subject: `Verify your email — QuizBuzz`,
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
                    <h2 style="color:#1a1a1a;">Verify your email</h2>
                    <p>Hi ${params.name},</p>
                    <p>Please verify your email address to complete your QuizBuzz registration.</p>
                    <a href="${params.verificationLink}"
                       style="display:inline-block;padding:12px 24px;background:#6d28d9;
                              color:#fff;border-radius:6px;text-decoration:none;font-weight:600;
                              margin:16px 0;">
                        Verify Email
                    </a>
                    <p style="color:#666;font-size:13px;">
                        This link expires in 24 hours. If you didn't create an account, ignore this email.
                    </p>
                    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
                    <p style="color:#999;font-size:12px;">
                        Or copy this link into your browser:<br/>
                        <span style="word-break:break-all;">${params.verificationLink}</span>
                    </p>
                </div>
            `,
        }),
    },

    [MessageTemplate.PASSWORD_RESET]: {
        build: (params) => ({
            subject: `Reset your password — QuizBuzz`,
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
                    <h2 style="color:#1a1a1a;">Reset your password</h2>
                    <p>Hi ${params.name},</p>
                    <p>We received a request to reset your QuizBuzz password.</p>
                    <p>Click the button below. This link expires in <strong>15 minutes</strong>.</p>
                    <a href="${params.resetLink}"
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
                        <span style="word-break:break-all;">${params.resetLink}</span>
                    </p>
                </div>
            `,
        }),
    },

    [MessageTemplate.ORG_INVITE]: {
        build: (params) => ({
            subject: `You've been invited to join ${params.orgName} on QuizBuzz`,
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
                    <h2 style="color:#1a1a1a;">Organization Invitation</h2>
                    <p>Hi ${params.name},</p>
                    <p>You've been invited to join <strong>${params.orgName}</strong> on QuizBuzz.</p>
                    <a href="${params.inviteLink}"
                       style="display:inline-block;padding:12px 24px;background:#6d28d9;
                              color:#fff;border-radius:6px;text-decoration:none;font-weight:600;
                              margin:16px 0;">
                        Accept Invitation
                    </a>
                    <p style="color:#666;font-size:13px;">
                        This invitation expires in 3 days. If you were not expecting this, ignore this email.
                    </p>
                </div>
            `,
        }),
    },
    [MessageTemplate.ADMIN_EMAIL_OTP]: {
        build: (params) => ({
            subject: `${params.otp} is your QuizBuzz verification code`,
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;text-align:center;padding:40px 20px;border:1px solid #eee;border-radius:12px;">
                    <h2 style="color:#1a1a1a;margin-bottom:24px;">Verify your email</h2>
                    <p style="color:#666;font-size:16px;margin-bottom:32px;">Hi ${params.name}, use the following code to verify your QuizBuzz account:</p>
                    <div style="background:#f3f0ff;border-radius:12px;padding:24px;margin-bottom:32px;">
                        <span style="font-size:40px;font-weight:bold;letter-spacing:8px;color:#6d28d9;font-family:monospace;">${params.otp}</span>
                    </div>
                    <p style="color:#999;font-size:14px;margin-bottom:8px;">This code expires in <strong>15 minutes</strong>.</p>
                    <p style="color:#999;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            `,
        }),
    },

    // ── Contest lifecycle templates ────────────────────────────────────────────

    [MessageTemplate.DISQUALIFICATION_NOTICE]: {
        build: (params) => ({
            subject: `Disqualification Notice — ${params.eventName}`,
            html: `
                <p>Dear ${params.name},</p>
                <p>We regret to inform you that you have been disqualified from <strong>${params.eventName}</strong>.</p>
                <p><strong>Reason:</strong> ${params.reason}</p>
                <p>If you believe this was an error, please contact the contest organizer.</p>
                <p>Regards,<br/> - Team QuizBuzz</p>
            `,
        }),
    },

    [MessageTemplate.RESULTS_PUBLISHED]: {
        build: (params) => ({
            subject: `Results are out! — ${params.eventName}`,
            html: `
                <p>Hello ${params.name},</p>
                <p>The results for <strong>${params.eventName}</strong> have been published!</p>
                <p><a href="${params.link}">View Leaderboard & Your Results</a></p>
                <p>Thank you for participating.<br/> - Team QuizBuzz</p>
            `,
        }),
    },
};