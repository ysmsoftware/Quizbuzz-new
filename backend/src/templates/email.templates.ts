import { MessageTemplate } from "../types/message-template.enum";
import { TemplateParamsMap } from "../types/message-template";
import {
    renderEmailLayout,
    emailButton,
    otpBox,
    linkFallback,
    signOff,
    infoTable,
    ledgerTable,
    calloutBox,
    pill,
    P,
    SMALL,
    LINK_STYLE,
    COLORS,
} from "./email-layout";

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
            subject: `Your OTP for QuizBuzz`,
            html: renderEmailLayout({
                brandName: "YSM Info Solution",
                preheader: `Your verification code is ${params.otp}`,
                heading: "Your verification code",
                bodyHtml: `
                    <p style="${P}">Hi ${params.name},</p>
                    <p style="${P}">Use the code below to complete your verification. It's valid for the next <strong>10 minutes</strong>.</p>
                    ${otpBox(params.otp)}
                    <p style="${SMALL}">Please don't share this code with anyone. If you didn't request this, you can safely ignore this email.</p>
                    ${signOff("YSM Info Solution")}
                `,
            }),
        }),
    },
    [MessageTemplate.BIRTHDAY_WISHES_YSM]: {
        build: (params) => ({
            subject: `Happy Birthday from QuizBuzz! 🎂`,
            html: renderEmailLayout({
                brandName: "YSM Info Solution",
                preheader: `Wishing you a very happy birthday, ${params.name}!`,
                heading: `Happy Birthday, ${params.name}! 🎂`,
                bodyHtml: `
                    ${pill("🎉 Wishing you a wonderful day")}
                    <p style="${P}">Team <strong>QuizBuzz</strong> wishes you a very <strong>Happy Birthday!</strong></p>
                    <p style="${P}">May this year bring you success, growth and new opportunities.</p>
                    <p style="${P}">Keep shining and keep learning!</p>
                    ${signOff("YSM Info Solution")}
                `,
            }),
        }),
    },

    [MessageTemplate.FEEDBACK_COLLECTION_MESSAGE]: {
        build: (params) => ({
            subject: `We Value Your Feedback - ${params.name}`,
            html: renderEmailLayout({
                brandName: "YSM Info Solution",
                preheader: `Tell us how ${params.eventName} went`,
                heading: "We'd love your feedback",
                bodyHtml: `
                    <p style="${P}">Dear ${params.name},</p>
                    <p style="${P}">Thank you for being part of <strong>${params.eventName}</strong>.</p>
                    <p style="${P}">Your input helps us improve and serve students better — it only takes a minute.</p>
                    ${emailButton("Share your feedback", "https://g.page/r/CbW3sg1807sqEBM/review")}
                    ${signOff("YSM Info Solution")}
                `,
            }),
        }),
    },

    [MessageTemplate.CERTIFICATE_ISSUED]: {
        build: (params) => ({
            subject: `Certificate Issued - ${params.eventName}`,
            html: renderEmailLayout({
                brandName: "YSM Info Solution",
                preheader: `Your certificate for ${params.eventName} is ready`,
                heading: "Your certificate is ready 🎓",
                bodyHtml: `
                    <p style="${P}">Hello ${params.name},</p>
                    <p style="${P}">Your certificate for <strong>${params.eventName}</strong> has been issued.</p>
                    ${emailButton("Download Certificate", params.link)}
                    <p style="${P}">Keep learning &amp; growing!</p>
                    ${signOff("YSM Info Solution")}
                `,
            }),
        }),
    },
    [MessageTemplate.REGISTRATION_SUCCESSFUL]: {
        build: (params) => ({
            subject: `Registration Successful - ${params.eventName}`,
            html: renderEmailLayout({
                brandName: "YSM Info Solution",
                preheader: `You're registered for ${params.eventName}`,
                heading: "You're registered! ✅",
                bodyHtml: `
                    <p style="${P}">Dear ${params.name},</p>
                    <p style="${P}">Thank you for registering for <strong>${params.eventName}</strong> on QuizBuzz.</p>
                    ${infoTable([
                    { label: "Date", value: params.date },
                    { label: "Time", value: params.time },
                    { label: "Join Code", value: params.joinCode, strong: true, valueColor: COLORS.primaryDark },
                    { label: "Location / Link", value: `<a href="${params.link}" style="${LINK_STYLE}">${params.link}</a>` },
                ])}
                    <p style="${P}">We look forward to your participation. For queries, contact: <strong>+91 898 308 3698</strong></p>
                    ${signOff("YSM Info Solution")}
                `,
            }),
        }),
    },

    [MessageTemplate.WORKSHOP_REMINDER_MESSAGE]: {
        build: (params) => ({
            subject: `Reminder: ${params.eventName} is Coming Up!`,
            html: renderEmailLayout({
                brandName: "YSM Info Solution",
                preheader: `${params.eventName} starts soon`,
                heading: "Reminder: your session is coming up",
                bodyHtml: `
                    <p style="${P}">Dear ${params.name},</p>
                    <p style="${P}">This is a reminder for your registered program: <strong>${params.eventName}</strong></p>
                    ${infoTable([
                    { label: "Date", value: params.date },
                    { label: "Time", value: params.time },
                    ...(params.joinCode ? [{ label: "Join Code", value: params.joinCode, strong: true, valueColor: COLORS.primaryDark }] : []),
                    { label: "Join Link", value: `<a href="${params.link}" style="${LINK_STYLE}">${params.link}</a>` },
                ])}
                    <p style="${P}">Kindly be available 10 minutes before the scheduled time.</p>
                    <p style="${P}">We look forward to your participation.</p>
                    ${signOff("YSM Info Solution")}
                `,
            }),
        }),
    },

    [MessageTemplate.PAYMENT_CONFIRMATION_MESSAGE]: {
        build: (params) => ({
            subject: `Payment Confirmed - ${params.eventName}`,
            html: renderEmailLayout({
                brandName: "YSM Info Solution",
                preheader: `Your payment of ${params.amount} was successful`,
                heading: "Payment Confirmed! 🎉",
                bodyHtml: `
                    <p style="${P}">Dear ${params.name},</p>
                    <p style="${P}">Your payment has been successfully processed. Thank you for your registration.</p>
                    ${infoTable([
                        { label: "Event / Contest", value: params.eventName },
                        { label: "Amount Paid", value: params.amount, strong: true, valueColor: COLORS.primaryDark },
                    ])}
                    <p style="${P}">Your registration details will be sent to you shortly.</p>
                    ${signOff("YSM Info Solution")}
                `,
            }),
        }),
    },

    [MessageTemplate.PAYOUT_TRANSFER_CONFIRMATION]: {
        build: (params) => ({
            subject: `Payout transferred — ${params.transferAmount} credited to your account`,
            html: renderEmailLayout({
                preheader: `${params.transferAmount} has been transferred to your payout account`,
                heading: "Payout transferred 💸",
                bodyHtml: `
                    <p style="${P}">Hi ${params.name},</p>
                    <p style="${P}">A payment has been received and your share has been transferred to your linked payout account. Here's the full breakdown:</p>
                    ${ledgerTable([
                    { label: "Gross payment received", value: params.grossAmount },
                    { label: `Platform commission (${params.commissionPercent})`, value: `− ${params.commissionAmount}`, tone: "negative" },
                    { label: `Payment gateway fee (${params.gatewayFeePercent})`, value: `− ${params.gatewayFeeAmount}`, tone: "negative" },
                    { label: `GST on gateway fee (${params.gstPercent})`, value: `− ${params.gstAmount}`, tone: "negative" },
                    { label: "Total deducted", value: `− ${params.totalDeducted}`, tone: "negative", divider: true },
                    { label: "Amount transferred to you", value: params.transferAmount, tone: "positive", strong: true, divider: true },
                ])}
                    <p style="${SMALL}">The payment gateway fee and GST are charges levied by Razorpay on every transaction and are passed through as-is — QuizBuzz does not profit from this portion.</p>
                    <p style="${SMALL}">Transfer reference: ${params.transferId}</p>
                `,
            }),
        }),
    },

    // ── Admin / system templates ──────────────────────────────────────────────

    [MessageTemplate.EMAIL_VERIFICATION]: {
        build: (params) => ({
            subject: `Verify your email — QuizBuzz`,
            html: renderEmailLayout({
                preheader: "Verify your email to finish setting up QuizBuzz",
                heading: "Verify your email",
                bodyHtml: `
                    <p style="${P}">Hi ${params.name},</p>
                    <p style="${P}">Please verify your email address to complete your QuizBuzz registration.</p>
                    ${emailButton("Verify Email", params.verificationLink)}
                    <p style="${SMALL}">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
                    ${linkFallback(params.verificationLink)}
                `,
            }),
        }),
    },

    [MessageTemplate.PASSWORD_RESET]: {
        build: (params) => ({
            subject: `Reset your password — QuizBuzz`,
            html: renderEmailLayout({
                preheader: "Reset your QuizBuzz password",
                heading: "Reset your password",
                bodyHtml: `
                    <p style="${P}">Hi ${params.name},</p>
                    <p style="${P}">We received a request to reset your QuizBuzz password. Click the button below — this link expires in <strong>15 minutes</strong>.</p>
                    ${emailButton("Reset Password", params.resetLink)}
                    <p style="${SMALL}">If you didn't request this, you can safely ignore this email. Your password will not change.</p>
                    ${linkFallback(params.resetLink)}
                `,
            }),
        }),
    },

    [MessageTemplate.ORG_INVITE]: {
        build: (params) => ({
            subject: `You've been invited to join ${params.orgName} on QuizBuzz`,
            html: renderEmailLayout({
                preheader: `You've been invited to join ${params.orgName}`,
                heading: "Organization invitation",
                bodyHtml: `
                    <p style="${P}">Hi ${params.name},</p>
                    <p style="${P}">${params.inviterName ? `<strong>${params.inviterName}</strong> has invited you` : `You've been invited`} to join <strong>${params.orgName}</strong> on QuizBuzz${params.role ? ` as a <strong>${params.role}</strong>` : ""}.</p>
                    ${emailButton("Accept Invitation", params.inviteLink)}
                    <p style="${SMALL}">This invitation expires in 3 days. If you weren't expecting this, you can ignore this email.</p>
                `,
            }),
        }),
    },
    [MessageTemplate.ADMIN_EMAIL_OTP]: {
        build: (params) => ({
            subject: `${params.otp} is your QuizBuzz verification code`,
            html: renderEmailLayout({
                preheader: `Your QuizBuzz verification code is ${params.otp}`,
                heading: "Verify your email",
                bodyHtml: `
                    <p style="${P}">Hi ${params.name}, use the following code to verify your QuizBuzz account:</p>
                    ${otpBox(params.otp)}
                    <p style="${SMALL}">This code expires in <strong>15 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
                `,
            }),
        }),
    },

    // ── Contest lifecycle templates ────────────────────────────────────────────

    [MessageTemplate.DISQUALIFICATION_NOTICE]: {
        build: (params) => ({
            subject: `Disqualification Notice — ${params.eventName}`,
            html: renderEmailLayout({
                preheader: `You have been disqualified from ${params.eventName}`,
                heading: "Disqualification notice",
                bodyHtml: `
                    <p style="${P}">Dear ${params.name},</p>
                    <p style="${P}">We regret to inform you that you have been disqualified from <strong>${params.eventName}</strong>.</p>
                    ${calloutBox(`<strong>Reason:</strong> ${params.reason}`, "danger")}
                    <p style="${P}">If you believe this was an error, please contact the contest organizer.</p>
                    ${signOff("QuizBuzz", "Regards")}
                `,
            }),
        }),
    },

    [MessageTemplate.RESULTS_PUBLISHED]: {
        build: (params) => ({
            subject: `Results are out! — ${params.eventName}`,
            html: renderEmailLayout({
                preheader: `Results for ${params.eventName} have been published`,
                heading: "Results are out! 🏆",
                bodyHtml: `
                    <p style="${P}">Hello ${params.name},</p>
                    <p style="${P}">The results for <strong>${params.eventName}</strong> have been published!</p>
                    ${emailButton("View Leaderboard & Your Results", params.link)}
                    <p style="${P}">Thank you for participating.</p>
                    ${signOff("QuizBuzz")}
                `,
            }),
        }),
    },
    [MessageTemplate.CONTEST_RESCHEDULED]: {
        build: (params) => ({
            subject: `Rescheduled: ${params.eventName} is now on ${params.date}`,
            html: renderEmailLayout({
                preheader: `${params.eventName} has a new date: ${params.date} at ${params.time}`,
                heading: "Contest rescheduled",
                bodyHtml: `
                    <p style="${P}">Hello ${params.name},</p>
                    <p style="${P}"><strong>${params.eventName}</strong> has been rescheduled.</p>
                    ${infoTable([
                    { label: "Previously", value: `<s style="color:${COLORS.textFaint};">${params.previousDate}</s>` },
                    { label: "New date & time", value: `${params.date} at ${params.time}`, strong: true, valueColor: COLORS.primaryDark },
                ])}
                    ${params.reason ? calloutBox(`<strong>Reason:</strong> ${params.reason}`, "warning") : ""}
                    <p style="${P}">Your registration remains valid — no action is needed.</p>
                    ${emailButton("View Contest Details", params.link)}
                    ${signOff("QuizBuzz")}
                `,
            }),
        }),
    },
    [MessageTemplate.CONTEST_CANCELLED]: {
        build: (params) => ({
            subject: `Cancelled: ${params.eventName}`,
            html: renderEmailLayout({
                preheader: `${params.eventName} has been cancelled`,
                heading: "Contest cancelled",
                bodyHtml: `
                    <p style="${P}">Hello ${params.name},</p>
                    <p style="${P}">We're sorry to let you know that <strong>${params.eventName}</strong>, scheduled for ${params.date} at ${params.time}, has been cancelled.</p>
                    ${calloutBox(`<strong>Reason:</strong> ${params.reason}`, "danger")}
                    <p style="${P}">You do not need to do anything. If you have any questions, please reply to the organisers.</p>
                    ${signOff("QuizBuzz")}
                `,
            }),
        }),
    },
    [MessageTemplate.AMBASSADOR_APPLICATION_RECEIVED]: {
        build: (params) => ({
            subject: `We've received your ambassador application — ${params.orgName}`,
            html: renderEmailLayout({
                preheader: `Your application to become an ambassador for ${params.orgName} is under review`,
                heading: "Application received",
                bodyHtml: `
                    <p style="${P}">Hi ${params.name},</p>
                    <p style="${P}">Thanks for applying to be an ambassador for <strong>${params.orgName}</strong>. Our team is reviewing your application and will notify you by email once a decision is made.</p>
                    ${signOff("QuizBuzz")}
                `,
            }),
        }),
    },
    [MessageTemplate.AMBASSADOR_APPLICATION_APPROVED]: {
        build: (params) => ({
            subject: `You're approved as an ambassador — ${params.orgName}`,
            html: renderEmailLayout({
                preheader: `Your ambassador application for ${params.orgName} has been approved`,
                heading: "Application approved",
                bodyHtml: `
                    <p style="${P}">Hi ${params.name},</p>
                    <p style="${P}">Great news — your ambassador application for <strong>${params.orgName}</strong> has been approved!</p>
                    ${emailButton("Go to your dashboard", params.link)}
                    ${linkFallback(params.link)}
                    ${signOff("QuizBuzz")}
                `,
            }),
        }),
    },
    [MessageTemplate.AMBASSADOR_APPLICATION_REJECTED]: {
        build: (params) => ({
            subject: `Update on your ambassador application — ${params.orgName}`,
            html: renderEmailLayout({
                preheader: `Your ambassador application for ${params.orgName} was not approved`,
                heading: "Application not approved",
                bodyHtml: `
                    <p style="${P}">Hi ${params.name},</p>
                    <p style="${P}">Thanks for your interest in becoming an ambassador for <strong>${params.orgName}</strong>. After review, we're not able to approve your application at this time.</p>
                    ${calloutBox(`<strong>Reason:</strong> ${params.reason}`, "info")}
                    ${signOff("QuizBuzz")}
                `,
            }),
        }),
    },
    [MessageTemplate.CUSTOM]: {
        build: (params) => ({
            subject: params.subject || `Notification from QuizBuzz`,
            html: renderEmailLayout({
                brandName: "YSM Info Solution",
                preheader: params.subject || "Announcement",
                heading: params.subject || "Announcement",
                bodyHtml: `
                    <p style="${P}white-space:pre-wrap;">${params.body || ""}</p>
                `,
                footerNote: "This email was sent by QuizBuzz (powered by YSM Info Solution). Please do not reply directly to this email.",
            }),
        }),
    },
};
