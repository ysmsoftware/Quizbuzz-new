/**
 * Shared branded email layout.
 *
 * Every transactional email in the app should be built by composing these
 * helpers instead of hand-rolling HTML per template. This keeps typography,
 * spacing and brand color uniform across the whole messaging system, and
 * means the brand look only needs to change in one place.
 *
 * Brand: emerald green + white, matching the app's primary/success palette.
 * Markup is table-based with inline styles so it renders consistently
 * across Gmail, Outlook and mobile mail clients.
 */

export const FONT = "Arial, Helvetica, sans-serif";

export const COLORS = {
    primary: "#059669", // emerald-600
    primaryDark: "#047857", // emerald-700
    primaryLight: "#ecfdf5", // emerald-50
    primaryBorder: "#a7f3d0", // emerald-200
    text: "#0f172a", // slate-900 — headings / emphasis
    textBody: "#334155", // slate-700 — paragraph copy
    textMuted: "#64748b", // slate-500 — labels
    textFaint: "#94a3b8", // slate-400 — fine print / footer
    border: "#e2e8f0", // slate-200
    bg: "#f1f5f4", // page background behind the card
    card: "#ffffff",
    danger: "#dc2626",
    dangerBg: "#fef2f2",
    dangerBorder: "#fecaca",
    dangerText: "#991b1b",
    warningBg: "#fffbeb",
    warningBorder: "#fde68a",
    warningText: "#92400e",
};

export interface EmailLayoutOptions {
    /** Sender identity shown in the header. Defaults to "QuizBuzz". */
    brandName?: string;
    /** Hidden preview text shown in inbox lists. */
    preheader?: string;
    /** Main heading rendered at the top of the card body. */
    heading?: string;
    /** Pre-built inner HTML (paragraphs, buttons, tables, etc.) */
    bodyHtml: string;
    /** Overrides the default footer disclaimer line. */
    footerNote?: string;
}

/** The platform's own brand — always leads the email header. */
export const PLATFORM_BRAND = "QuizBuzz";

/** Wraps template body content in the shared branded shell. */
export function renderEmailLayout(opts: EmailLayoutOptions): string {
    // The org/tenant sending the email (e.g. "YSM Info Solution"), if any.
    // The header always leads with the QuizBuzz platform wordmark; when a
    // distinct sending org is set, it appears underneath as "by <org>".
    const brand = opts.brandName ?? PLATFORM_BRAND;
    const hasSubBrand = brand !== PLATFORM_BRAND;
    const preheader = opts.preheader ?? "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${brand}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};">
    <span style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:${COLORS.bg};">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.bg};padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:${COLORS.card};border-radius:16px;overflow:hidden;border:1px solid ${COLORS.border};">
                    <tr>
                        <td style="background-color:${COLORS.primary};background-image:linear-gradient(135deg,${COLORS.primary},${COLORS.primaryDark});padding:24px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td style="font-family:${FONT};font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.3px;line-height:1.2;">
                                        ${PLATFORM_BRAND}
                                    </td>
                                </tr>
                                ${hasSubBrand ? `
                                <tr>
                                    <td style="font-family:${FONT};font-size:12px;font-weight:500;color:rgba(255,255,255,0.85);letter-spacing:0.2px;padding-top:3px;">
                                        by ${brand}
                                    </td>
                                </tr>` : ""}
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:36px 32px 8px 32px;font-family:${FONT};color:${COLORS.textBody};">
                            ${opts.heading ? `<h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:20px;line-height:1.3;color:${COLORS.text};font-weight:700;">${opts.heading}</h1>` : ""}
                            ${opts.bodyHtml}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 32px 32px;">
                            <hr style="border:none;border-top:1px solid ${COLORS.border};margin:0 0 20px 0;" />
                            <p style="margin:0;font-family:${FONT};font-size:12px;color:${COLORS.textFaint};line-height:1.6;">
                                ${opts.footerNote ?? `This is an automated message from ${brand}. Please do not reply directly to this email.`}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

/** Standard paragraph style — use via: `<p style="${P}">...</p>` */
export const P = `margin:0 0 14px 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${COLORS.textBody};`;

/** Smaller, muted paragraph style for secondary notes / expiry text. */
export const SMALL = `margin:0 0 10px 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${COLORS.textFaint};`;

/** Inline link style for use inside paragraphs. */
export const LINK_STYLE = `color:${COLORS.primaryDark};font-weight:600;text-decoration:underline;`;

/** Bulletproof CTA button (table-wrapped anchor) in brand emerald. */
export function emailButton(label: string, href: string): string {
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
        <tr>
            <td align="center" style="border-radius:8px;background-color:${COLORS.primary};">
                <a href="${href}" target="_blank"
                   style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${COLORS.primary};">
                    ${label}
                </a>
            </td>
        </tr>
    </table>`;
}

/** Large emphasized code display, used for OTPs. */
export function otpBox(code: string): string {
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 26px 0;">
        <tr>
            <td align="center" style="background-color:${COLORS.primaryLight};border:1px solid ${COLORS.primaryBorder};border-radius:12px;padding:22px;">
                <span style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:800;letter-spacing:9px;color:${COLORS.primaryDark};">${code}</span>
            </td>
        </tr>
    </table>`;
}

/** Fallback "copy this link" block shown under CTA buttons. */
export function linkFallback(url: string): string {
    return `
    <p style="margin:18px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLORS.textFaint};">
        Or copy and paste this link into your browser:<br/>
        <span style="word-break:break-all;color:${COLORS.textMuted};">${url}</span>
    </p>`;
}

/** Closing signature line, e.g. "Thanks, — Team QuizBuzz". */
export function signOff(brand: string, closing: string = "Thanks"): string {
    return `<p style="margin:22px 0 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${COLORS.textBody};">${closing},<br/><strong style="color:${COLORS.text};">Team ${brand}</strong></p>`;
}

/** Two-column label/value rows, e.g. contest date, time, join code. */
export function infoTable(
    rows: Array<{ label: string; value: string; strong?: boolean; valueColor?: string }>
): string {
    const body = rows
        .map(
            (r) => `
        <tr>
            <td style="padding:11px 0;border-bottom:1px solid ${COLORS.border};font-family:${FONT};font-size:13px;color:${COLORS.textMuted};white-space:nowrap;">${r.label}</td>
            <td style="padding:11px 0 11px 16px;border-bottom:1px solid ${COLORS.border};font-family:${FONT};font-size:14px;color:${r.valueColor ?? COLORS.text};font-weight:${r.strong ? 700 : 600};text-align:right;">${r.value}</td>
        </tr>`
        )
        .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-collapse:collapse;">${body}</table>`;
}

/** Financial breakdown rows with tone-based coloring — used for payout receipts. */
export function ledgerTable(
    rows: Array<{
        label: string;
        value: string;
        tone?: "neutral" | "negative" | "positive";
        strong?: boolean;
        divider?: boolean;
    }>
): string {
    const toneColor: Record<string, string> = {
        neutral: COLORS.textMuted,
        negative: COLORS.danger,
        positive: COLORS.primaryDark,
    };
    const body = rows
        .map(
            (r) => `
        <tr>
            <td style="padding:9px 0;${r.divider ? `border-top:1px solid ${COLORS.border};` : ""}font-family:${FONT};font-size:13px;color:${COLORS.textMuted};">${r.label}</td>
            <td style="padding:9px 0;${r.divider ? `border-top:1px solid ${COLORS.border};` : ""}font-family:${FONT};font-size:14px;font-weight:${r.strong ? 700 : 600};color:${toneColor[r.tone ?? "neutral"]};text-align:right;">${r.value}</td>
        </tr>`
        )
        .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;border-collapse:collapse;">${body}</table>`;
}

/** Highlighted note box — used for cancellation/disqualification reasons, warnings, etc. */
export function calloutBox(text: string, variant: "info" | "warning" | "danger" = "info"): string {
    const palette = {
        info: { bg: COLORS.primaryLight, border: COLORS.primaryBorder, text: COLORS.primaryDark },
        warning: { bg: COLORS.warningBg, border: COLORS.warningBorder, text: COLORS.warningText },
        danger: { bg: COLORS.dangerBg, border: COLORS.dangerBorder, text: COLORS.dangerText },
    }[variant];
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
        <tr>
            <td style="background-color:${palette.bg};border:1px solid ${palette.border};border-radius:10px;padding:14px 16px;font-family:${FONT};font-size:14px;line-height:1.55;color:${palette.text};">
                ${text}
            </td>
        </tr>
    </table>`;
}

/** Small rounded pill, e.g. a celebratory "🎉 Happy Birthday!" badge. */
export function pill(text: string): string {
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px 0;">
        <tr>
            <td style="background-color:${COLORS.primaryLight};border:1px solid ${COLORS.primaryBorder};border-radius:999px;padding:8px 18px;font-family:${FONT};font-size:13px;font-weight:700;color:${COLORS.primaryDark};">
                ${text}
            </td>
        </tr>
    </table>`;
}
