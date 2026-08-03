# Custom Certificate Templates — Discussion Plan

Plan only. No code changed yet. Grounded in the actual code at `Quizbuzz-new/backend`
(read 2026-08-02): `modules/certificate/*`, `workers/certificate.worker.ts`,
`queues/index.ts`, `container.ts`, `services/storage.service.ts`, `prisma/schema.prisma`,
plus the org-facing frontend (`app/org/certificates/page.tsx`,
`app/org/contests/[id]/certificates/page.tsx`, `app/org/layout.tsx`).

## 1. Current implementation — how certificates work today

**Everything is queue-only, confirmed.** There is no synchronous/direct generation path.

1. `POST /certificates/issue` or `/bulk-issue` (`certificate.controller.ts`) → `CertificateService.issueCertificate` / `bulkIssueCertificates`.
2. The service builds a `CertificateMetadata` object (participant name, contest title, score, rank, percentage, time taken, org name/logo/color) and writes a `Certificate` row (`certificate.repository.ts`) with `status: QUEUED`.
3. It pushes a job onto `certificateQueue` (BullMQ, `queues/index.ts`), keyed by `jobId: certificate.id` for dedup — so even a "direct" issue call never generates inline, it always round-trips through Redis/BullMQ.
4. `certificate.worker.ts` (standalone process, own Puppeteer browser instance, lower concurrency than other workers) picks the job up: marks `GENERATING` → calls `renderCertificateHtml()` → prints to PDF via headless Chromium → uploads the PDF via `StorageService` (S3 or local) → marks `GENERATED` with `fileUrl`/`fileKey`. Failures mark `FAILED` with a reason, retryable via `/retry` or `/retry-failed`.
5. `Certificate.metadata` (Json column) is the only place template inputs live today — there's no separate template table.

**Templates today are hardcoded, not admin-managed.** `certificate.template.ts` is a single TypeScript file containing three inline HTML/CSS variants — `PARTICIPATION`, `ACHIEVEMENT`, `MERIT` — selected automatically by rank/percentage (or overridden via `metadata.templateVariant`). There is no upload UI, no HTML storage, no variable-mapping concept, and no `CertificateTemplate` Prisma model. The nav already has a top-level **Certificates** entry (`/org/certificates` → pick a contest → `/org/contests/[id]/certificates`), but that page is purely an issue/status/retry dashboard, not a template manager.

Org branding exists only as ad-hoc per-certificate metadata fields (`orgName`, `orgLogoUrl`, `primaryColor`) with code-level defaults — `Organization` in Prisma has `logoUrl` but no color/theme field, so branding isn't even pulled from the org record automatically today.

## 2. What "custom certificate templates" requires, architecturally

This is a genuinely new module, not an extension of an existing one — it needs its own `modules/certificate-template/` following the same route → controller → service → repository → validator → types split the repo already enforces everywhere else. Rough shape:

### 2.1 New Prisma model

```
model CertificateTemplate {
  id              String   @id @default(ulid())
  organizationId  String
  name            String            // shown in the dropdown, e.g. "Gold Merit 2026"
  htmlKey         String            // storage key — the HTML file itself lives in S3/local via StorageService, not inline in Postgres
  variables       Json              // declared placeholder list, e.g. ["participantName","contestTitle","score","rank","issuedAt"]
  thumbnailUrl    String?           // optional preview image, generated on upload
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@map("certificate_templates")
}
```

DB is the source of truth for the template metadata (per the repo's own rule: "DB = final truth, Redis = runtime truth" — config-agnostic, no hardcoding). The actual HTML file goes through `StorageService.upload()` exactly like generated PDFs do today (`storageKey` pattern already exists: `certificates/{orgId}/{contestId}/{certId}.pdf` → same idea, `certificate-templates/{orgId}/{templateId}.html`).

### 2.2 Upload flow (admin side)

- New page under the existing Certificates nav — something like `/org/certificates/templates` — with an upload form: template **name**, HTML file (or pasted HTML), and either an auto-detected or admin-declared list of variables.
- On upload, the backend scans the HTML for a placeholder pattern (e.g. `{{participantName}}`) and returns the detected variable list back to the admin for confirmation/editing before saving — this is what populates the `variables` Json column and drives the dropdown/preview UI later.
- Saved templates show up in a dropdown wherever a template is picked (per-contest certificate settings, or directly in the issue/bulk-issue flow).

### 2.3 Rendering engine change — this is the biggest real change

Today, rendering is three functions of TypeScript building fixed HTML strings (`buildHtml()` in `certificate.template.ts`) — there's no generic "take arbitrary HTML + substitute variables" engine anywhere in the codebase. For admin-uploaded HTML, `certificate.worker.ts` needs a **second rendering path**:

- If `metadata.templateId` (already a legacy field in `CertificateMetadata`!) points to a `CertificateTemplate`, fetch the stored HTML (from `StorageService`, cached appropriately) and run it through a variable-substitution step instead of `renderCertificateHtml()`.
- Needs a real templating approach — even a simple `{{var}}` regex-replace works for straight substitution, but conditionals (e.g. show a medal only for rank ≤ 3) would want something like Handlebars. Worth deciding up front since it changes the placeholder syntax admins are told to use.
- The three built-in variants stay as the system default / fallback for orgs that never upload a custom template — this is additive, not a replacement.

### 2.4 Security angle (new — doesn't exist today)

The current templates are code-authored and trusted by construction. Admin-uploaded HTML, rendered inside the same Puppeteer/Chromium process used for every other org, introduces a few new risks worth flagging even though the org's own admin is the one uploading it (multi-tenant SaaS, so one org's upload shouldn't be able to affect another org or the host):

- Strip or disable `<script>` execution (Puppeteer page can be set to block JS entirely for template renders, unlike today where JS was never a concern since templates were code-authored).
- Restrict remote resource fetches from inside the rendered HTML (today's template already avoids any external network calls by design — worth keeping that constraint explicit for uploads too, to avoid SSRF against internal infra from an `<img src>`).
- Cap upload size and validate it's well-formed HTML before accepting.

### 2.5 Where template selection plugs into the existing issue flow

`CertificateMetadata.templateId` already exists as a "legacy" field with no real consumer today — that's the natural hook. Two open questions on scope (see below) are whether template choice is per-contest (set once when configuring a contest's certificate settings) or per-issue-call (admin picks it every time they hit issue/bulk-issue).

## 3. Decisions (locked in 2026-08-02)

- **Scope**: org-wide template library. Any contest can select any saved template — matches the existing nav (`/org/certificates` is org-level, contest certs nest under it). No `contestId` on `CertificateTemplate`; contest → template link lives wherever "default template" gets picked per contest (contest settings, or at issue time).
- **Placeholder syntax**: plain `{{variable}}` string substitution. No Handlebars/Mustache dependency — no conditionals (e.g. no "only show medal if rank ≤ 3" inside custom HTML). Keeps the admin-facing authoring surface simple and keeps the render step a straight regex/string-replace, not a template-engine integration.
- **Variables**: system-provided fields only, for v1 — the same set already flowing through `CertificateMetadata` today (`participantName`, `contestTitle`, `contestDate`, `score`, `percentage`, `rank`, `timeTakenSecs`, `issuedAt`, `orgName`, `orgLogoUrl`, `primaryColor`). No admin-defined custom one-off fields yet — nothing to fill in manually at issue time, so bulk-issue stays fully automatic. `CertificateTemplate.variables` becomes an informational/validation list (which of the known fields this template actually uses) rather than an open schema.
- **Preview before save**: required. Upload flow renders the template against dummy sample data (fake name, score 87%, rank 2, etc.) server-side and returns a preview (image or rendered HTML) before the admin commits — catches a mistyped `{{particpantName}}` or broken layout before it's used across an entire contest roster.
- **Editing an existing template**: does not affect already-generated certificates (PDFs are immutable once generated) — only future issues pick up an edit. Worth an explicit "last edited" timestamp on the model so admins can tell if a template changed since a batch was issued.

## 4. Next step

With scope, syntax, field set, and preview settled, this is ready to break into a module-by-module implementation plan (schema migration, storage key layout, `certificate-template` module scaffold, worker's second render path, validator schemas, frontend upload + template-picker UI). Still no code until you say go — let me know when you want that breakdown, or if you want to adjust any of the decisions above first.
