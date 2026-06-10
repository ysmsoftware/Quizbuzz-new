/**
 * Certificate HTML Template Engine
 *
 * Responsibilities:
 *   - Accept a fully typed `CertificateRenderContext` (derived from CertificateMetadata)
 *   - Produce a self-contained HTML string suitable for Puppeteer → PDF rendering
 *   - Support three template variants: PARTICIPATION | ACHIEVEMENT | MERIT
 *   - Support organisation branding: custom logo URL, org name, primary colour
 *   - Zero external network requests from within the HTML (no CDN fonts/images)
 *     → Logo rendered via <img> tag with the org-supplied URL; if absent, text fallback
 *
 * Output dimensions: A4 landscape (297 mm × 210 mm)
 *
 * Called exclusively by certificate.worker.ts — never imported by HTTP-path code.
 */

import { CertificateMetadata } from "./certificate.types";

// ─── Template Variants ────────────────────────────────────────────────────────

export type TemplateVariant = "PARTICIPATION" | "ACHIEVEMENT" | "MERIT";

/**
 * Fully resolved render context — everything the template needs, nothing more.
 * Derived from CertificateMetadata at call time in the worker.
 */
export interface CertificateRenderContext {
    // Participant
    participantName:   string;
    // Contest
    contestTitle:      string;
    contestDate:       string;   // human-readable, e.g. "14 September 2025"
    // Org branding
    orgName:           string;
    orgLogoUrl:        string | null;  // null → text fallback
    primaryColor:      string;   // hex, e.g. "#1a3a6b"
    // Performance (optional — shown only when present)
    score?:            number;
    percentage?:       number;
    rank?:             number;
    timeTakenSecs?:    number;
    // Presentation
    templateVariant:   TemplateVariant;
    // Issued metadata
    issuedAt:          string;   // e.g. "01 June 2026"
    certificateId:     string;   // shown as verification ID in footer
}

// ─── Context builder ──────────────────────────────────────────────────────────

/**
 * Converts a raw CertificateMetadata (as stored in DB / queue payload)
 * into a fully resolved CertificateRenderContext.
 *
 * Applies defaults for every optional field so the template never has to
 * guard against undefined.
 */
export function buildRenderContext(
    meta:          CertificateMetadata,
    certificateId: string
): CertificateRenderContext {
    const rawDate   = meta.contestDate ?? meta.issuedAt;
    const contestDate = formatDateHuman(rawDate);
    const issuedAt    = formatDateHuman(meta.issuedAt);
    const variant     = resolveVariant(meta);

    return {
        participantName:  meta.participantName,
        contestTitle:     meta.contestTitle,
        contestDate,
        orgName:          meta.orgName      ?? "QuizBuzz",
        orgLogoUrl:       meta.orgLogoUrl   ?? null,
        primaryColor:     meta.primaryColor ?? "#1a3a6b",
        ...(meta.score         !== undefined && { score:         meta.score }),
        ...(meta.percentage    !== undefined && { percentage:    meta.percentage }),
        ...(meta.rank          !== undefined && { rank:          meta.rank }),
        ...(meta.timeTakenSecs !== undefined && { timeTakenSecs: meta.timeTakenSecs }),
        templateVariant:  variant,
        issuedAt,
        certificateId,
    };
}

/**
 * Resolve which visual template to use.
 *
 * Rules:
 *   - Explicit `templateVariant` in metadata wins.
 *   - Otherwise infer from rank / percentage:
 *     rank 1-3 OR percentage >= 90  → MERIT
 *     percentage >= 60              → ACHIEVEMENT
 *     fallback                      → PARTICIPATION
 */
function resolveVariant(meta: CertificateMetadata): TemplateVariant {
    if (meta.templateVariant) return meta.templateVariant as TemplateVariant;

    if (meta.rank !== undefined && meta.rank <= 3) return "MERIT";
    if (meta.percentage !== undefined && meta.percentage >= 90) return "MERIT";
    if (meta.percentage !== undefined && meta.percentage >= 60) return "ACHIEVEMENT";
    return "PARTICIPATION";
}

// ─── Public render entry-point ────────────────────────────────────────────────

/**
 * Main entry-point called by the worker.
 * Returns a complete, self-contained HTML document as a string.
 */
export function renderCertificateHtml(
    meta:          CertificateMetadata,
    certificateId: string
): string {
    const ctx = buildRenderContext(meta, certificateId);
    return buildHtml(ctx);
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHtml(ctx: CertificateRenderContext): string {
    const {
        participantName,
        contestTitle,
        contestDate,
        orgName,
        orgLogoUrl,
        primaryColor,
        score,
        percentage,
        rank,
        timeTakenSecs,
        templateVariant,
        issuedAt,
        certificateId,
    } = ctx;

    const accentLight = hexToRgba(primaryColor, 0.07);
    const accentMid   = hexToRgba(primaryColor, 0.10);
    const accentBorder = hexToRgba(primaryColor, 0.30);

    const { titleLine, subTitle, bodyLine } = variantCopy(templateVariant, contestTitle, contestDate);

    const logoBlock = orgLogoUrl
        ? `<img class="org-logo" src="${escHtml(orgLogoUrl)}" alt="${escHtml(orgName)} logo" />`
        : `<p class="org-name-text">${escHtml(orgName)}</p>`;

    const statsBlock = buildStatsBlock(score, percentage, rank, timeTakenSecs, primaryColor);

    const medalBlock = (templateVariant === "MERIT" && rank !== undefined && rank <= 3)
        ? `<div class="medal">${medalEmoji(rank)}</div>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escHtml(titleLine)} — ${escHtml(participantName)}</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    @page { size: A4 landscape; margin: 0; }

    html, body {
      width:    297mm;
      height:   210mm;
      overflow: hidden;
      background: #ffffff;
    }

    body {
      font-family: "Georgia", "Times New Roman", serif;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ── Outer page wrapper ── */
    .page {
      width:    297mm;
      height:   210mm;
      position: relative;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ── Decorative corner ornaments ── */
    .corner {
      position: absolute;
      width:  52px;
      height: 52px;
      border-color: ${primaryColor};
      border-style: solid;
      opacity: 0.30;
    }
    .corner-tl { top: 16px; left: 16px;  border-width: 3px 0 0 3px; }
    .corner-tr { top: 16px; right: 16px; border-width: 3px 3px 0 0; }
    .corner-bl { bottom: 16px; left: 16px;  border-width: 0 0 3px 3px; }
    .corner-br { bottom: 16px; right: 16px; border-width: 0 3px 3px 0; }

    /* ── Certificate card ── */
    .cert {
      width:    258mm;
      height:   188mm;
      border:   1.5px solid ${primaryColor};
      border-radius: 3px;
      background: linear-gradient(155deg, #ffffff 0%, ${accentLight} 100%);
      display:  flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 20px 52px 32px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    /* ── Top colour bar ── */
    .cert::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 5px;
      background: ${primaryColor};
    }

    /* ── Org logo / name ── */
    .org-logo {
      max-height: 42px;
      max-width:  150px;
      object-fit: contain;
      margin-bottom: 1px;
    }
    .org-name-text {
      font-size: 10px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: ${primaryColor};
      font-family: Arial, sans-serif;
    }

    /* ── Medal ── */
    .medal { font-size: 32px; line-height: 1; margin: -2px 0; }

    /* ── Title ── */
    .cert-title {
      font-size: 24px;
      font-weight: bold;
      color: ${primaryColor};
      letter-spacing: 0.5px;
      line-height: 1.1;
    }

    /* ── Subtitle ── */
    .cert-subtitle {
      font-size: 10.5px;
      color: #888;
      letter-spacing: 2px;
      text-transform: uppercase;
      font-family: Arial, sans-serif;
    }

    /* ── Participant name ── */
    .participant-name {
      font-size: 28px;
      font-weight: bold;
      color: #1a1a1a;
      border-bottom: 1.5px solid ${primaryColor};
      padding-bottom: 6px;
      min-width: 180px;
      max-width: 420px;
      line-height: 1.2;
      margin: 3px 0 3px;
    }

    /* ── Body copy ── */
    .body-text {
      font-size: 12.5px;
      color: #555;
      max-width: 390px;
      line-height: 1.65;
      font-family: Arial, sans-serif;
    }

    /* ── Contest name ── */
    .contest-name {
      font-size: 15px;
      font-weight: bold;
      color: ${primaryColor};
      max-width: 400px;
      line-height: 1.3;
    }

    /* ── Contest date ── */
    .contest-date {
      font-size: 11px;
      color: #777;
      font-family: Arial, sans-serif;
    }

    /* ── Stats pills ── */
    .stats {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: center;
      margin: 3px 0;
      flex-wrap: wrap;
    }
    .stat-pill {
      background: ${accentMid};
      border: 1px solid ${accentBorder};
      border-radius: 20px;
      padding: 3px 13px;
      font-size: 11.5px;
      font-family: Arial, sans-serif;
      color: #333;
    }
    .stat-pill strong { color: ${primaryColor}; }

    /* ── Footer ── */
    .footer {
      position: absolute;
      bottom: 12px;
      left: 0; right: 0;
      display: flex;
      justify-content: space-between;
      padding: 0 20px;
      font-size: 8.5px;
      color: #bbb;
      font-family: Arial, sans-serif;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="corner corner-tl"></div>
    <div class="corner corner-tr"></div>
    <div class="corner corner-bl"></div>
    <div class="corner corner-br"></div>

    <div class="cert">
      ${logoBlock}
      ${medalBlock}

      <h1 class="cert-title">${escHtml(titleLine)}</h1>
      <p class="cert-subtitle">${escHtml(subTitle)}</p>

      <p class="participant-name">${escHtml(participantName)}</p>

      <p class="body-text">${bodyLine}</p>
      <p class="contest-name">${escHtml(contestTitle)}</p>
      <p class="contest-date">${escHtml(contestDate)}</p>

      ${statsBlock}

      <div class="footer">
        <span>Issued: ${escHtml(issuedAt)}</span>
        <span>Cert ID: ${escHtml(certificateId)}</span>
        <span>${escHtml(orgName)}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Variant copy factory ─────────────────────────────────────────────────────

interface VariantCopy {
    titleLine: string;
    subTitle:  string;
    bodyLine:  string;
}

function variantCopy(
    variant:      TemplateVariant,
    _contestTitle: string,
    _contestDate:  string
): VariantCopy {
    switch (variant) {
        case "MERIT":
            return {
                titleLine: "Certificate of Merit",
                subTitle:  "Excellence & Outstanding Performance",
                bodyLine:  "This is to certify that the following individual has demonstrated <strong>exceptional performance</strong> in",
            };
        case "ACHIEVEMENT":
            return {
                titleLine: "Certificate of Achievement",
                subTitle:  "Successful Completion",
                bodyLine:  "This is to certify that the following individual has <strong>successfully completed</strong>",
            };
        case "PARTICIPATION":
        default:
            return {
                titleLine: "Certificate of Participation",
                subTitle:  "Acknowledgement of Participation",
                bodyLine:  "This is to certify that the following individual has <strong>participated</strong> in",
            };
    }
}

// ─── Stats block builder ──────────────────────────────────────────────────────

function buildStatsBlock(
    score?:         number,
    percentage?:    number,
    rank?:          number,
    timeTakenSecs?: number,
    primaryColor:   string = "#1a3a6b"
): string {
    const pills: string[] = [];

    if (percentage !== undefined) {
        pills.push(`<span class="stat-pill">Score: <strong>${percentage.toFixed(1)}%</strong></span>`);
    } else if (score !== undefined) {
        pills.push(`<span class="stat-pill">Score: <strong>${score}</strong></span>`);
    }

    if (rank !== undefined) {
        pills.push(`<span class="stat-pill">Rank: <strong>#${rank}</strong></span>`);
    }

    if (timeTakenSecs !== undefined) {
        pills.push(`<span class="stat-pill">Time: <strong>${formatDuration(timeTakenSecs)}</strong></span>`);
    }

    if (pills.length === 0) return "";

    return `<div class="stats">${pills.join("\n      ")}</div>`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** HTML-escape user-supplied strings before insertion into the template. */
function escHtml(str: string): string {
    return str
        .replace(/&/g,  "&amp;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;")
        .replace(/"/g,  "&quot;")
        .replace(/'/g,  "&#39;");
}

/** Convert a 6-digit hex colour + alpha to rgba(). */
function hexToRgba(hex: string, alpha: number): string {
    const cleaned = hex.replace("#", "");
    if (cleaned.length !== 6) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

/** Format seconds as "Xm Ys". */
function formatDuration(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m}m`;
    return `${m}m ${s}s`;
}

/** Format an ISO date string → "DD Month YYYY". */
function formatDateHuman(raw: string | Date): string {
    try {
        const d = typeof raw === "string" ? new Date(raw) : raw;
        return d.toLocaleDateString("en-IN", {
            day:   "2-digit",
            month: "long",
            year:  "numeric",
        });
    } catch {
        return String(raw);
    }
}

/** Medal emoji for top-3 ranks. */
function medalEmoji(rank: number): string {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return "";
}
