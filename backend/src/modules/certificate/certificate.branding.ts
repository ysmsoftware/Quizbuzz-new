/**
 * Certificate branding for custom (admin-authored) HTML templates.
 *
 * Two logos are injected by the server, so every certificate carries them
 * regardless of what the template's own HTML contains:
 *   - the QuizBuzz app logo (PlatformAppSettings.appLogoUrl) — always, top-left
 *   - the org logo — at the position the template's author picked
 * Page size can also be forced from a preset instead of hand-written `@page` CSS.
 */

export const ORG_LOGO_POSITIONS = [
    "none",
    "top-left", "top-center", "top-right",
    "bottom-left", "bottom-center", "bottom-right",
] as const;
export type OrgLogoPosition = (typeof ORG_LOGO_POSITIONS)[number];

/** `null` pageSize = "auto": the template's own `@page` rule wins, else A4 landscape. */
export const PAGE_SIZE_PRESETS = {
    "a4-landscape":     { css: "A4 landscape",     widthMm: 297, heightMm: 210 },
    "a4-portrait":      { css: "A4 portrait",      widthMm: 210, heightMm: 297 },
    "letter-landscape": { css: "letter landscape", widthMm: 279, heightMm: 216 },
    "letter-portrait":  { css: "letter portrait",  widthMm: 216, heightMm: 279 },
} as const;
export type PageSizePreset = keyof typeof PAGE_SIZE_PRESETS;
export const PAGE_SIZE_KEYS = Object.keys(PAGE_SIZE_PRESETS) as [PageSizePreset, ...PageSizePreset[]];

export interface BrandingOptions {
    appLogoUrl:      string | null;
    orgLogoUrl:      string | null;
    orgName:         string | null;
    orgLogoPosition: OrgLogoPosition;
    pageSize:        PageSizePreset | null;
}

/**
 * Distance from each page edge to the logo boxes. Keep in sync with the exact positions
 * quoted in buildCertificateAiPrompt (frontend/lib/utils/ai-prompts.ts) — templates are
 * told to keep borders inside the outer 15mm so logos at 20mm sit inside any frame.
 */
const INSET = "20mm";
const CSS_POSITION: Record<Exclude<OrgLogoPosition, "none">, string> = {
    "top-left":      `top:${INSET};left:${INSET};`,
    "top-center":    `top:${INSET};left:50%;transform:translateX(-50%);`,
    "top-right":     `top:${INSET};right:${INSET};`,
    "bottom-left":   `bottom:${INSET};left:${INSET};`,
    "bottom-center": `bottom:${INSET};left:50%;transform:translateX(-50%);`,
    "bottom-right":  `bottom:${INSET};right:${INSET};`,
};

export function escAttr(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Only absolute http(s) URLs may be fetched by the renderer — no data:/file:/javascript:. */
export function safeHttpUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const u = new URL(url);
        return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
    } catch {
        return null;
    }
}

/**
 * Text-level defense-in-depth. The real boundary is the request allowlist in
 * certificate.worker.ts — this removes the constructs that let a template embed
 * other pages/plugins or run code.
 */
export function sanitizeTemplateHtml(html: string): string {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<(iframe|frame|frameset|object|embed|applet)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, "")
        .replace(/<\/?(?:script|iframe|frame|frameset|object|embed|applet|base)\b[^>]*>/gi, "")
        .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, "")
        .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/(href|src|xlink:href)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi, "$1=$2$2");
}

/**
 * Injects the page-size override and both logos just before </body>. `position: fixed`
 * is laid out relative to the page box in Chromium's PDF output, so this works for any
 * template layout without the template needing a positioned wrapper.
 */
export function injectBranding(html: string, b: BrandingOptions): string {
    const parts: string[] = [];
    const size = b.pageSize ? PAGE_SIZE_PRESETS[b.pageSize] : null;

    let css = "";
    if (size) {
        css += `@page{size:${size.css};margin:0}html,body{width:${size.widthMm}mm;height:${size.heightMm}mm}`;
    }
    css += ".qb-logo{position:fixed;z-index:2147483647;max-height:14mm;max-width:42mm;object-fit:contain}";
    for (const [pos, rule] of Object.entries(CSS_POSITION)) css += `.qb-${pos}{${rule}}`;
    parts.push(`<style>${css}</style>`);

    // QuizBuzz mark sits top-left; if the org claims that corner, it moves to top-right.
    const appLogo = safeHttpUrl(b.appLogoUrl);
    const orgLogo = safeHttpUrl(b.orgLogoUrl);
    const orgPos = b.orgLogoPosition;
    const appPos = orgPos === "top-left" && orgLogo ? "top-right" : "top-left";

    if (appLogo) parts.push(`<img class="qb-logo qb-${appPos}" src="${escAttr(appLogo)}" alt="QuizBuzz" />`);
    if (orgLogo && orgPos !== "none") {
        parts.push(`<img class="qb-logo qb-${orgPos}" src="${escAttr(orgLogo)}" alt="${escAttr(b.orgName ?? "Organization")} logo" />`);
    }

    const block = parts.join("");
    return /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${block}</body>`) : html + block;
}
