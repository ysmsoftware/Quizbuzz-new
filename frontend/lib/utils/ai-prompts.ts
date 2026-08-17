// ============================================================================
// Single source of truth for every "Copy AI Prompt" button's text across the
// app (certificate templates, question bulk-upload, and any future one).
// Change the wording here once — every place that copies a prompt picks it
// up automatically. Nothing outside this file should hardcode prompt text.
// ============================================================================

// ─── Certificate template prompt ────────────────────────────────────────────

export const CERTIFICATE_AVAILABLE_PLACEHOLDERS = [
  'participantName',
  'contestTitle',
  'contestDate',
  'score',
  'percentage',
  'rank',
  'timeTakenSecs',
  'issuedAt',
  'orgName',
  'orgLogoUrl',
  'primaryColor',
  'certificateId',
];

const CERTIFICATE_PLACEHOLDER_EXAMPLES: Record<string, string> = {
  participantName: '"Aditi Sharma" — plain text',
  contestTitle: '"Winter Coding Sprint 2026" — plain text',
  contestDate: '"14 September 2026" — already formatted, human-readable',
  score: '42 — a plain number',
  percentage: '87.5 — a plain number, no % sign included',
  rank: '2 — a plain number',
  timeTakenSecs: '1725 — seconds, as a plain number',
  issuedAt: '"01 June 2026" — already formatted, human-readable',
  orgName: 'the organization\'s display name',
  orgLogoUrl: 'a URL — only usable inside <img src="{{orgLogoUrl}}">',
  primaryColor: '"#1a3a6b" — a hex color, only usable inside CSS like color: {{primaryColor}};',
  certificateId: 'a unique certificate identifier string',
};

/**
 * Grounded in the exact backend implementation — every rule here is enforced by the
 * actual code, not aspirational. Deliberately written to work for BOTH use cases:
 * generating a brand-new template from a description, or reviewing/fixing an existing
 * one the admin already has — so this is the one prompt to copy for either job.
 */
export function buildCertificateAiPrompt(): string {
  const placeholderLines = CERTIFICATE_AVAILABLE_PLACEHOLDERS
    .map((v) => `   - {{${v}}} — ${CERTIFICATE_PLACEHOLDER_EXAMPLES[v]}`)
    .join('\n');

  return `I'm working with a custom HTML certificate template system for an online contest/exam platform. It accepts a single, self-contained HTML file (inline CSS only inside a <style> tag, no external stylesheets or fonts, no JavaScript/<script> tags — any <script> tags get silently stripped before saving) that gets pasted directly into the platform's certificate template upload box.

This prompt covers two different jobs — read both option blocks near the bottom, fill in ONLY the one that matches what I'm doing right now, and ignore the other:
- OPTION A — CREATE A NEW TEMPLATE: I'll describe the design I want; generate a brand-new HTML file that follows every rule below.
- OPTION B — FIX / VALIDATE AN EXISTING TEMPLATE: I'll paste my existing HTML below; check it against every rule below, list every violation you find, then return the corrected HTML — keep my original design, layout, and wording intact, only fix what's actually broken against the rules.

Technical rules the HTML MUST follow (these apply the same whether you're creating new or fixing existing — when fixing, treat each one as a checklist item to verify):

1. Use ONLY these exact placeholder tokens for dynamic data — written literally as {{tokenName}} (double curly braces, letters/numbers/underscore only, no spaces inside the braces):
${placeholderLines}

2. No placeholder names outside this exact list are allowed — things like a custom award title or a signature line have no matching token. Anything outside this list silently renders as BLANK text on the real certificate, not an error. If fixing an existing file, flag any placeholder not on this list as a bug and either remove it or tell me it needs to become static text instead.

3. No conditional logic or loops are supported — it's a literal find-and-replace of each {{token}}, so never write or keep things like {{#if rank}}...{{/if}}. If fixing an existing file, flag any such syntax as a bug and replace it with the plain token or static text.

4. Default page size is A4 landscape (297mm × 210mm). If a different size is wanted, it must be declared explicitly with a CSS rule like:
   @page { size: 279mm 216mm; margin: 0; }
   html, body { width: 279mm; height: 216mm; }
   Otherwise leave @page out entirely and it defaults to A4 landscape automatically. If fixing an existing file, check that any declared @page size has matching html/body width/height — a mismatch here is a common bug.

5. Any images (logo, decorative graphics) must be referenced via a public https:// URL in an <img src="..."> tag — no local file paths, no base64 unless already inlined. Flag any non-https or local-path image reference as a bug if fixing an existing file.

6. Keep the whole file under 200KB. Flag it if an existing file is over this.

7. <script> tags get stripped automatically before saving, so any JavaScript in the file is dead weight at best — don't add any if creating new, and flag/remove any found if fixing an existing file.

--- FILL IN ONLY ONE OF THE TWO SECTIONS BELOW ---

OPTION A — Creating a new template from scratch:
[Describe the design here — the occasion, tone/formality, color scheme, logo placement, layout style, exact wording you want, portrait vs landscape, etc. Leave blank if using Option B instead.]

OPTION B — Fixing/validating an existing template:
[Paste the full contents of your existing HTML file here. Leave blank if using Option A instead.]

Give me back the complete HTML file only, ready to paste in as-is. If you were fixing an existing file, also include a short bullet list of exactly what was wrong and what you changed.`;
}

// ─── Question bulk-upload prompt ────────────────────────────────────────────

/**
 * Grounded in the real bulk-upload contract: question-parser.ts's primary column
 * detection (questionText/difficulty/category/option1-6/correctOption) and the
 * actual template at /templates/questions_template.csv — not aspirational.
 * Works for both generating new questions from a topic and fixing an existing
 * file already in the wrong format (e.g. isCorrect boolean columns). Shared by
 * every bulk-upload entry point (question bank and per-contest import) — one
 * prompt, so they can never drift the way the two CSV templates once did.
 */
export function buildQuestionsAiPrompt(): string {
  return `I'm building a multiple-choice question bank for an online contest/quiz platform. Questions are uploaded as a CSV/Excel file with this exact header row and column order:

questionText,difficulty,category,option1,option2,option3,option4,correctOption

- questionText: the question itself, 5-2000 characters.
- difficulty: exactly one of EASY, MEDIUM, or HARD (case-insensitive).
- category: a single topic/tag for the question (e.g. "React", "SQL", "General Knowledge").
- option1..option4: the four answer choices, 1-500 characters each. You can add up to two more columns (option5, option6) if a question needs 5 or 6 choices — 2 is the minimum, 6 is the maximum.
- correctOption: the 1-based index of the correct answer among the options you provided for that row (e.g. 2 means option2 is correct). One number, not a boolean, and never more than one correct answer per question.

Two optional extra columns are also supported if wanted: hint (max 500 characters) and explanation (max 2000 characters) — add them as extra columns after correctOption, with those exact header names.

This prompt covers two different jobs — read both option blocks near the bottom, fill in ONLY the one that matches what I'm doing right now, and ignore the other:
- OPTION A — GENERATE NEW QUESTIONS FROM A TOPIC: I'll give you a topic and how many questions I want; write brand-new multiple-choice questions in the exact CSV format above.
- OPTION B — FIX AN EXISTING FILE: I'll paste my existing CSV/spreadsheet data below, in whatever format it's currently in; convert it to the exact CSV format above, correcting anything that doesn't match — wrong header names, separate per-option "isCorrect" boolean columns instead of a single correctOption index, wrong difficulty casing, etc. Keep the original question wording and answers intact, only fix the structure/format.

Rules that apply either way:
1. Output plain CSV text only — the header row exactly as shown, then one row per question, comma-separated, with any field containing a comma or quote wrapped in double quotes.
2. Every row needs exactly one correct answer marked via the correctOption index — never zero, never more than one.
3. Don't invent extra columns beyond questionText, difficulty, category, option1-6, correctOption, hint, explanation — anything else is ignored by the system.

--- FILL IN ONLY ONE OF THE TWO SECTIONS BELOW ---

OPTION A — Generate new questions:
[Topic, number of questions, difficulty mix, and any other requirements. Leave blank if using Option B instead.]

OPTION B — Fix an existing file:
[Paste your existing CSV/spreadsheet content here, including its header row. Leave blank if using Option A instead.]

Give me back the complete CSV file content only, ready to save as a .csv and upload as-is. If you were fixing an existing file, also include a short bullet list of exactly what was wrong and what you changed.`;
}
