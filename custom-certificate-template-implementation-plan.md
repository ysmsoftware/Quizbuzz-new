# Custom Certificate Templates — Implementation Plan (for an executing AI agent)

Grounded in the actual code at `Quizbuzz-new/backend` and `Quizbuzz-new/frontend`
(read 2026-08-02). Companion doc: `custom-certificate-template-plan.md` (the discussion
doc with decisions: org-wide template library, `{{variable}}` string substitution only,
system fields only — no admin-defined custom fields, preview required before save).

Follow the repo's own engineering rules while building this (see project custom
instructions): strict `routes → controller → service → repository` module split, Zod
validation on every input, no business logic in controllers/routes/workers, no hardcoded
limits, DB is the source of truth, errors go through the existing `AppError` subclasses —
never throw raw errors.

**YAGNI cuts already applied** (do not add these back in without being asked):
no thumbnail generation, no soft-delete/`isActive` flag, no admin-defined custom fields,
no S3 round-trip to read template HTML back at render time (stored directly in Postgres
as text — it's a few KB, not a binary asset), no pagination on the template list endpoint
(an org will have a handful of templates, not thousands), no new PDF-rendering pass for
preview (preview returns rendered HTML for an iframe, not a PDF — Puppeteer stays confined
to the worker process, it is never invoked from the API process).

---

## Phase 0 — Data model

### 0.1 `backend/prisma/schema.prisma` — modify

Add a new model. Put it directly after the existing `Certificate` model (currently ends
around line 783, right before the `// PROCTORING` section comment):

```prisma
model CertificateTemplate {
  id             String   @id @default(ulid())
  organizationId String
  name           String
  htmlContent    String   // raw HTML containing {{variable}} placeholders — stored inline, no S3 round trip needed to render
  variables      Json     // string[] — placeholder names detected at upload/update time; informational + used for the "unknown placeholder" warning in preview
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, name])
  @@index([organizationId])
  @@map("certificate_templates")
}
```

The `@@unique([organizationId, name])` constraint is intentional — it's what makes the
name the admin gives the template also the thing that safely shows up in the dropdown
without collisions.

Then in the existing `model Organization { ... }` block (~line 208–248), add one relation
line next to the existing `certificates Certificate[]` line (~line 241):

```prisma
  certificateTemplates CertificateTemplate[]
```

### 0.2 Migration

Run (do not hand-write the SQL):

```
cd backend && npx prisma migrate dev --name add_certificate_templates
```

Verify the generated migration only adds the new table + FK + the two indexes/unique
constraint — nothing else should be in the diff.

### 0.3 Verification for this phase

`npx prisma generate` succeeds, `CertificateTemplate` and its relation appear in the
generated Prisma client types, existing `Certificate`/`Organization` queries elsewhere in
the codebase are untouched (no column was removed or renamed on either model).

---

## Phase 1 — Backend: new `certificate-template` module (CRUD + preview, no rendering yet)

New directory: `backend/src/modules/certificate-template/`. Follow the exact same file
split as every other module (`modules/certificate/`, `modules/contest/`, etc.) — six
files, each with one job.

### 1.1 `certificate-template.types.ts` — new file

```ts
export interface CreateCertificateTemplateInput {
    organizationId: string;
    name:           string;
    htmlContent:    string;
    variables:      string[];
}

export interface UpdateCertificateTemplateInput {
    name?:        string;
    htmlContent?: string;
    variables?:   string[];
}

export interface CertificateTemplateResult {
    id:             string;
    organizationId: string;
    name:           string;
    htmlContent:    string;
    variables:      string[];
    createdAt:      Date;
    updatedAt:      Date;
}

/** List view omits htmlContent — keeps the list payload small; full content is fetched via getById when editing. */
export interface CertificateTemplateListItem {
    id:        string;
    name:      string;
    variables: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface TemplatePreviewResult {
    html:               string;
    detectedVariables:  string[];
    unknownPlaceholders: string[];
}
```

### 1.2 `certificate-template.validator.ts` — new file

```ts
import { z } from "zod";

export const createTemplateSchema = z.object({
    name:        z.string().trim().min(1, "Name is required").max(120, "Name must be under 120 characters"),
    htmlContent: z.string().min(1, "HTML content is required").max(200_000, "Template HTML must be under 200KB"),
});

export const updateTemplateSchema = z
    .object({
        name:        z.string().trim().min(1).max(120).optional(),
        htmlContent: z.string().min(1).max(200_000).optional(),
    })
    .refine((d) => d.name !== undefined || d.htmlContent !== undefined, {
        message: "Provide at least one field to update",
    });

export const previewTemplateSchema = z
    .object({
        templateId:  z.string().trim().optional(),
        htmlContent: z.string().min(1).max(200_000).optional(),
    })
    .refine((d) => !!d.templateId || !!d.htmlContent, {
        message: "Provide either templateId (preview a saved template) or htmlContent (preview a draft)",
    });

export type CreateTemplateInput  = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput  = z.infer<typeof updateTemplateSchema>;
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;
```

### 1.3 `certificate-template.repository.ts` — new file

DB access only — no variable-detection or sanitization logic here, that belongs in the
service layer per the module rules.

```ts
import { prisma } from "../../config/db";
import {
    CertificateTemplateResult,
    CreateCertificateTemplateInput,
    UpdateCertificateTemplateInput,
} from "./certificate-template.types";

export class CertificateTemplateRepository {

    async findAllByOrg(organizationId: string): Promise<CertificateTemplateResult[]> {
        const rows = await prisma.certificateTemplate.findMany({
            where: { organizationId },
            orderBy: { name: "asc" },
        });
        return rows.map(this._toResult);
    }

    async findById(id: string, organizationId: string): Promise<CertificateTemplateResult | null> {
        const row = await prisma.certificateTemplate.findFirst({ where: { id, organizationId } });
        return row ? this._toResult(row) : null;
    }

    async create(input: CreateCertificateTemplateInput): Promise<CertificateTemplateResult> {
        const row = await prisma.certificateTemplate.create({
            data: {
                organizationId: input.organizationId,
                name:           input.name,
                htmlContent:    input.htmlContent,
                variables:      input.variables as any,
            },
        });
        return this._toResult(row);
    }

    async update(
        id: string,
        organizationId: string,
        input: UpdateCertificateTemplateInput
    ): Promise<CertificateTemplateResult> {
        const row = await prisma.certificateTemplate.update({
            where: { id },
            data: {
                organizationId,
                ...(input.name        !== undefined && { name: input.name }),
                ...(input.htmlContent !== undefined && { htmlContent: input.htmlContent }),
                ...(input.variables   !== undefined && { variables: input.variables as any }),
                updatedAt: new Date(),
            },
        });
        return this._toResult(row);
    }

    async delete(id: string, organizationId: string): Promise<void> {
        await prisma.certificateTemplate.deleteMany({ where: { id, organizationId } });
    }

    private _toResult(row: any): CertificateTemplateResult {
        return {
            id:             row.id,
            organizationId: row.organizationId,
            name:           row.name,
            htmlContent:    row.htmlContent,
            variables:      (row.variables as string[]) ?? [],
            createdAt:      row.createdAt,
            updatedAt:      row.updatedAt,
        };
    }
}
```

### 1.4 `certificate-template.service.ts` — new file

This is where variable detection, HTML sanitization, and the preview logic live —
business logic belongs in the service, per the module rules.

```ts
import { CertificateTemplateRepository } from "./certificate-template.repository";
import { OrganizationRepository } from "../organization/organization.repository";
import { NotFoundError, ConflictError } from "../../error/http-errors";
import {
    CertificateTemplateResult,
    CertificateTemplateListItem,
    TemplatePreviewResult,
} from "./certificate-template.types";
import { buildRenderContext, renderCustomTemplateHtml } from "../certificate/certificate.template";
import { CertificateMetadata } from "../certificate/certificate.types";

/**
 * The only fields a custom template's {{placeholders}} can resolve to.
 * Mirrors CertificateRenderContext in certificate.template.ts exactly — single
 * source of truth for "what dynamic data does a certificate carry."
 * Deliberately excludes `templateVariant` (meaningless outside the 3 built-in designs).
 */
export const KNOWN_TEMPLATE_VARIABLES = [
    "participantName", "contestTitle", "contestDate",
    "orgName", "orgLogoUrl", "primaryColor",
    "score", "percentage", "rank", "timeTakenSecs",
    "issuedAt", "certificateId",
] as const;

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Strip <script> tags as defense-in-depth. Primary enforcement is disabling JS execution in Puppeteer at render time (see certificate.worker.ts) — this is a belt-and-suspenders text-level pass, not the security boundary itself. */
function sanitizeHtml(html: string): string {
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

function detectVariables(html: string): { known: string[]; unknown: string[] } {
    const found = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = PLACEHOLDER_RE.exec(html)) !== null) found.add(m[1]!);

    const known:   string[] = [];
    const unknown: string[] = [];
    for (const v of found) {
        (KNOWN_TEMPLATE_VARIABLES as readonly string[]).includes(v) ? known.push(v) : unknown.push(v);
    }
    return { known, unknown };
}

export class CertificateTemplateService {
    constructor(
        private readonly repo: CertificateTemplateRepository,
        private readonly organizationRepo: OrganizationRepository,
    ) { }

    async listTemplates(organizationId: string): Promise<CertificateTemplateListItem[]> {
        const rows = await this.repo.findAllByOrg(organizationId);
        return rows.map(({ htmlContent, ...rest }) => rest);
    }

    async getTemplate(id: string, organizationId: string): Promise<CertificateTemplateResult> {
        const row = await this.repo.findById(id, organizationId);
        if (!row) throw new NotFoundError("Certificate template not found");
        return row;
    }

    async createTemplate(
        organizationId: string,
        name: string,
        htmlContent: string
    ): Promise<{ template: CertificateTemplateResult; unknownPlaceholders: string[] }> {
        const clean = sanitizeHtml(htmlContent);
        const { known, unknown } = detectVariables(clean);

        try {
            const template = await this.repo.create({ organizationId, name, htmlContent: clean, variables: known });
            return { template, unknownPlaceholders: unknown };
        } catch (err: any) {
            if (err.code === "P2002") throw new ConflictError(`A template named "${name}" already exists`);
            throw err;
        }
    }

    async updateTemplate(
        id: string,
        organizationId: string,
        input: { name?: string; htmlContent?: string }
    ): Promise<{ template: CertificateTemplateResult; unknownPlaceholders: string[] }> {
        await this.getTemplate(id, organizationId); // 404 if missing/not owned by this org

        const clean = input.htmlContent !== undefined ? sanitizeHtml(input.htmlContent) : undefined;
        const detected = clean !== undefined ? detectVariables(clean) : undefined;

        try {
            const template = await this.repo.update(id, organizationId, {
                ...(input.name !== undefined && { name: input.name }),
                ...(clean      !== undefined && { htmlContent: clean, variables: detected!.known }),
            });
            return { template, unknownPlaceholders: detected?.unknown ?? [] };
        } catch (err: any) {
            if (err.code === "P2002") throw new ConflictError(`A template named "${input.name}" already exists`);
            throw err;
        }
    }

    async deleteTemplate(id: string, organizationId: string): Promise<void> {
        await this.getTemplate(id, organizationId); // 404 if missing
        await this.repo.delete(id, organizationId);
    }

    /**
     * Renders a template — saved (by id) or a draft (raw htmlContent not yet saved) —
     * against realistic dummy data, entirely server-side, no Puppeteer/PDF involved.
     * Returns HTML for the frontend to drop into an <iframe srcDoc>.
     */
    async previewTemplate(
        organizationId: string,
        input: { templateId?: string; htmlContent?: string }
    ): Promise<TemplatePreviewResult> {
        let html: string;
        if (input.templateId) {
            html = (await this.getTemplate(input.templateId, organizationId)).htmlContent;
        } else {
            html = sanitizeHtml(input.htmlContent!);
        }

        const org = await this.organizationRepo.findById(organizationId);
        const dummyMetadata: CertificateMetadata = {
            participantName: "Jordan Sample",
            contestTitle:    "Sample Contest 2026",
            contestDate:     new Date().toISOString(),
            issuedAt:        new Date().toISOString(),
            score:           87,
            percentage:      87.5,
            rank:            2,
            timeTakenSecs:   1725,
            orgName:         org?.name ?? undefined,
            orgLogoUrl:      org?.logoUrl ?? undefined,
        };

        const rendered = renderCustomTemplateHtml(html, dummyMetadata, "PREVIEW-0000001");
        const { known, unknown } = detectVariables(html);
        return { html: rendered, detectedVariables: known, unknownPlaceholders: unknown };
    }
}
```

Note: `organizationRepo.findById` — check the exact method name on
`OrganizationRepository` before wiring this (grep `organization.repository.ts`); use
whatever the existing single-org lookup method is actually called if it differs.

### 1.5 `certificate-template.controller.ts` — new file

Mirrors `certificate.controller.ts` exactly — parse with Zod, call the service, format
the response, `next(err)` on failure. No business logic here.

```ts
import { Request, Response, NextFunction } from "express";
import { CertificateTemplateService } from "./certificate-template.service";
import { createTemplateSchema, updateTemplateSchema, previewTemplateSchema } from "./certificate-template.validator";

export class CertificateTemplateController {
    constructor(private readonly service: CertificateTemplateService) { }

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.service.listTemplates(req.user!.organizationId as string);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    };

    getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.service.getTemplate(req.params.id as string, req.user!.organizationId as string);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    };

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = createTemplateSchema.parse(req.body);
            const result = await this.service.createTemplate(req.user!.organizationId as string, dto.name, dto.htmlContent);
            res.status(201).json({ success: true, data: result.template, unknownPlaceholders: result.unknownPlaceholders });
        } catch (err) { next(err); }
    };

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = updateTemplateSchema.parse(req.body);
            const result = await this.service.updateTemplate(req.params.id as string, req.user!.organizationId as string, dto);
            res.status(200).json({ success: true, data: result.template, unknownPlaceholders: result.unknownPlaceholders });
        } catch (err) { next(err); }
    };

    remove = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.service.deleteTemplate(req.params.id as string, req.user!.organizationId as string);
            res.status(200).json({ success: true, message: "Certificate template deleted" });
        } catch (err) { next(err); }
    };

    preview = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = previewTemplateSchema.parse(req.body);
            const data = await this.service.previewTemplate(req.user!.organizationId as string, dto);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    };
}
```

### 1.6 `certificate-template.routes.ts` — new file

Same lazy-controller-resolution pattern as `certificate.router.ts` (avoids circular
import with `container.ts`). Static route (`/preview`) before parameterised (`/:id`),
same convention as the certificate router.

```ts
import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

function ctrl() { return require("../../container").certificateTemplateController; }

const certificateTemplateRouter = Router();

certificateTemplateRouter.use(authenticatedOrgMiddleware);

certificateTemplateRouter.post("/preview", (req, res, next) => ctrl().preview(req, res, next));
certificateTemplateRouter.post("/",        (req, res, next) => ctrl().create(req, res, next));
certificateTemplateRouter.get("/",         (req, res, next) => ctrl().list(req, res, next));
certificateTemplateRouter.get("/:id",      (req, res, next) => ctrl().getById(req, res, next));
certificateTemplateRouter.patch("/:id",    (req, res, next) => ctrl().update(req, res, next));
certificateTemplateRouter.delete("/:id",   (req, res, next) => ctrl().remove(req, res, next));

export { certificateTemplateRouter };
```

### 1.7 `backend/src/routes.ts` — modify

Add the import near the other module route imports (next to the `certificateRouter`
import, ~line 11):

```ts
import { certificateTemplateRouter } from "./modules/certificate-template/certificate-template.routes";
```

Add the mount next to the certificates mount (~line 38):

```ts
apiRouter.use("/certificate-templates", certificateTemplateRouter);
```

### 1.8 `backend/src/container.ts` — modify

Add imports next to the existing certificate imports (~line 21-23):

```ts
import { CertificateTemplateRepository } from './modules/certificate-template/certificate-template.repository.js';
import { CertificateTemplateService } from './modules/certificate-template/certificate-template.service.js';
import { CertificateTemplateController } from './modules/certificate-template/certificate-template.controller.js';
```

Add the repository export next to `certificateRepository` (~line 74):

```ts
export const certificateTemplateRepository = new CertificateTemplateRepository();
```

Add the service export **before** `certificateService` is constructed, since
`certificateService` will now depend on it (see Phase 3.2) — place it right above the
existing certificate service line (~line 86), and change that line to inject the new repo:

```ts
export const certificateTemplateService = new CertificateTemplateService(certificateTemplateRepository, organizationRepository);
export const certificateService = new CertificateService(certificateRepository, participantRepository, certificateTemplateRepository);
```

Add the controller export next to `certificateController` (~line 131):

```ts
export const certificateTemplateController = new CertificateTemplateController(certificateTemplateService);
```

### 1.9 Verification for this phase

Backend builds (`npm run build` in `backend/`). `POST /api/certificate-templates` with a
tiny HTML body containing one known placeholder (e.g. `<h1>{{participantName}}</h1>`)
returns 201 with the created row and an empty `unknownPlaceholders` array. Uploading a
second template with the same `name` for the same org returns a 409 via `ConflictError`.
`POST /api/certificate-templates/preview` with `{ htmlContent: "<h1>{{participantName}}</h1><p>{{typo}}</p>" }`
returns rendered HTML with "Jordan Sample" substituted in and `unknownPlaceholders: ["typo"]`.

At this point the module is fully functional for CRUD + preview, but **issuing a
certificate with a custom template does not work yet** — that's Phase 2 and 3.

---

## Phase 2 — Rendering engine: teach `certificate.template.ts` to render arbitrary HTML

### 2.1 `backend/src/modules/certificate/certificate.template.ts` — modify

Do not touch `buildHtml()`, `variantCopy()`, or any of the three built-in
PARTICIPATION/ACHIEVEMENT/MERIT rendering code — that stays exactly as-is and remains the
default for any organization that never uploads a custom template. `buildRenderContext()`
is already exported and already does exactly the field-resolution work needed (defaults
for `orgName`/`primaryColor`, human-readable date formatting, etc.) — reuse it verbatim,
don't duplicate it.

Add one new exported function at the bottom of the file:

```ts
// ─── Custom template rendering (admin-uploaded HTML) ──────────────────────────

/**
 * Renders an admin-uploaded HTML template by substituting {{variable}} placeholders
 * with values from the same CertificateRenderContext used by the built-in templates —
 * this is what guarantees a custom template gets exactly the same dynamic fields
 * (score, rank, percentage, issuedAt, contestDate, orgName/logo/color, certificateId,
 * timeTakenSecs, participantName, contestTitle) resolved the exact same way.
 *
 * Any {{placeholder}} that doesn't match a known context key is left blank rather than
 * leaking the raw "{{...}}" text into the rendered certificate — the admin should have
 * already caught this via the preview step before saving the template.
 */
export function renderCustomTemplateHtml(
    htmlTemplate:  string,
    meta:          CertificateMetadata,
    certificateId: string
): string {
    const ctx = buildRenderContext(meta, certificateId);

    let out = htmlTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
        const value = (ctx as Record<string, unknown>)[key];
        return value === undefined || value === null ? "" : String(value);
    });

    return out;
}
```

This single regex-replace pass already handles the "leave unknown placeholders blank"
requirement — any key not present on `ctx` (e.g. a typo, or a placeholder name the admin
made up) resolves to `undefined` inside the callback and is replaced with `""`. No second
cleanup pass needed.

### 2.2 Verification for this phase

Unit-level check (can be a quick throwaway script or the optional Jest test in Phase 6):
`renderCustomTemplateHtml("<p>{{participantName}} scored {{percentage}}%</p>", { participantName: "Test", contestTitle: "X", issuedAt: new Date().toISOString(), percentage: 92 }, "cert_123")`
produces `<p>Test scored 92%</p>` with no literal `{{` left anywhere in the output.

---

## Phase 3 — Wire custom templates into the issue flow and the worker

This is the part that needed cross-verifying against the worker, so it's laid out in
strict order: DTO → service → worker, because each step depends on the field the
previous step adds.

### 3.1 `backend/src/modules/certificate/certificate.types.ts` — modify

`CertificateMetadata.templateId` already exists (line 92) as an unused "legacy" field.
Repurpose it — update its doc comment, do not rename the field (avoids touching every
other reference to `CertificateMetadata`):

```ts
    /**
     * ID of an admin-uploaded CertificateTemplate (see modules/certificate-template).
     * When set, certificate.worker.ts renders this custom HTML template via
     * {{variable}} substitution instead of the three built-in PARTICIPATION /
     * ACHIEVEMENT / MERIT variants. Left undefined → built-in rendering (unchanged
     * default behaviour for every org that hasn't uploaded a custom template).
     */
    templateId?:      string | undefined;
```

Delete the old comment above it ("Legacy field — kept for backward compatibility...").
Leave `templateVariant` and everything else in this file untouched.

Add `templateId` to both DTOs in the same file:

```ts
export interface IssueCertificateDTO {
    participantId?: string | undefined;
    contactId?:     string | undefined;
    contestId?:     string | undefined;
    templateId?:    string | undefined;   // NEW — optional CertificateTemplate id
}

export interface BulkIssueCertificateDTO {
    contestId:   string;
    templateId?: string | undefined;      // NEW
}
```

### 3.2 `backend/src/modules/certificate/certificate.validator.ts` — modify

Add `templateId` to both schemas:

```ts
export const issueCertificateSchema = z
    .object({
        participantId: z.string().trim().optional(),
        contactId:     z.string().trim().optional(),
        contestId:     z.string().trim().optional(),
        templateId:    z.string().trim().optional(),   // NEW
    })
    .refine(
        (d) => !!d.participantId || (!!d.contactId && !!d.contestId),
        { message: "Provide either participantId, or both contactId and contestId" }
    );

export const bulkIssueCertificateSchema = z.object({
    contestId:  z.string().trim().min(1, "contestId is required"),
    templateId: z.string().trim().optional(),   // NEW
});
```

### 3.3 `backend/src/modules/certificate/certificate.service.ts` — modify

Constructor gains the new repository dependency (read-only use — just an existence +
ownership check, same pattern as the existing `ParticipantRepository` dependency):

```ts
import { CertificateTemplateRepository } from "../certificate-template/certificate-template.repository";
// ...
export class CertificateService {
    constructor(
        private readonly certificateRepo: CertificateRepository,
        private readonly participantRepo: ParticipantRepository,
        private readonly certificateTemplateRepo: CertificateTemplateRepository,   // NEW
    ) { }
```

In `issueCertificate()`, after building the `metadata` object (step 5, currently ends
around line 196) and before `certificateRepo.create()` (step 6), add:

```ts
        // 5b. If a custom template was requested, validate it belongs to this org and attach it
        if (dto.templateId) {
            const template = await this.certificateTemplateRepo.findById(dto.templateId, organizationId);
            if (!template) throw new NotFoundError("Certificate template not found");
            metadata.templateId = template.id;
        }
```

In `bulkIssueCertificates(contestId, organizationId, templateId?)` — add the third
parameter, validate it once up front (not once per participant), and stamp it onto every
`createInputs[i].metadata`:

```ts
    async bulkIssueCertificates(
        contestId: string,
        organizationId: string,
        templateId?: string,                                    // NEW param
    ): Promise<{ queued: number; skipped: number }> {
        if (templateId) {
            const template = await this.certificateTemplateRepo.findById(templateId, organizationId);
            if (!template) throw new NotFoundError("Certificate template not found");
        }

        // ... existing eligible-participant lookup unchanged ...

        const createInputs = eligible.map((p) => ({
            organizationId,
            contestId,
            participantId: p.id,
            metadata: {
                participantName: `${p.contact.firstName} ${p.contact.lastName ?? ""}`.trim(),
                contestTitle,
                contestDate: (p as any).contest?.startTime?.toISOString() ?? new Date().toISOString(),
                score: p.submission?.score ? Number(p.submission.score) : undefined,
                percentage: p.submission?.percentage ? Number(p.submission.percentage) : undefined,
                rank: p.leaderboard?.rank ?? undefined,
                timeTakenSecs: p.submission?.timeTakenSecs ?? undefined,
                issuedAt: new Date().toISOString(),
                ...(templateId && { templateId }),               // NEW — stamp onto every participant's metadata
            } as any,
        }));
```

(The rest of `bulkIssueCertificates` — bulk create, re-fetching `QUEUED` rows, bulk
enqueue — is unchanged; `metadata` already flows through to the queue payload exactly as
today, it just now sometimes carries a `templateId`.)

**Do not change** `retryCertificate()` or `retryFailedCertificates()` — they re-enqueue
using the certificate's *existing* `metadata` column value, which already carries
whatever `templateId` was stamped at original issue time. Retries of a custom-templated
certificate automatically keep using the same custom template with zero code changes
there.

### 3.4 `backend/src/modules/certificate/certificate.controller.ts` — modify

`bulkIssueCertificates` currently destructures only `contestId` from the parsed body
(~line 103) — update it to pass `templateId` through:

```ts
    bulkIssueCertificates = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { contestId, templateId } = bulkIssueCertificateSchema.parse(req.body);
            const result = await this.certificateService.bulkIssueCertificates(
                contestId,
                req.user!.organizationId as string,
                templateId,
            );
            // ... rest unchanged ...
```

`issueCertificate` already does `const dto = issueCertificateSchema.parse(req.body)` and
passes the whole `dto` through to the service — no change needed there, `dto.templateId`
just flows through automatically once 3.2 adds it to the schema.

### 3.5 `backend/src/container.ts` — modify

Already covered in Phase 1.8 — `certificateService` is constructed with the third
argument (`certificateTemplateRepository`) there. Confirm no other file constructs
`new CertificateService(...)` (grep confirms `container.ts` is the only call site).

### 3.6 `backend/src/workers/certificate.worker.ts` — modify (the actual cross-verification point)

This is exactly where the worker "reads the template name and picks the dynamic fields to
populate" — spelled out precisely:

Add imports at the top, next to the existing `certificateService` import:

```ts
import { certificateTemplateService } from "../container";
import { renderCertificateHtml, renderCustomTemplateHtml } from "../modules/certificate/certificate.template";
```

(`renderCertificateHtml` is already imported today — just add `renderCustomTemplateHtml`
to the same import line.)

Modify `generatePdf()` to optionally disable JS execution — this only matters for
admin-uploaded HTML, the built-in templates never needed it:

```ts
async function generatePdf(html: string, disableScripts: boolean): Promise<Buffer> {
    const b    = await getBrowser();
    const page = await b.newPage();

    try {
        if (disableScripts) await page.setJavaScriptEnabled(false);
        await page.setContent(html, { waitUntil: "load" });

        const pdf = await page.pdf({
            format:          "A4",
            landscape:       true,
            printBackground: true,
            margin:          { top: "0", right: "0", bottom: "0", left: "0" },
        });

        return Buffer.from(pdf);
    } finally {
        await page.close();
    }
}
```

In `processCertificate()`, replace Step 3 ("Render HTML", currently just
`const html = renderCertificateHtml(metadata, certificateId);`) with:

```ts
    // ── Step 3: Render HTML ───────────────────────────────────────────────────
    // If metadata.templateId is set, this certificate uses an admin-uploaded custom
    // template — fetch it by id (scoped to this organization) and substitute the same
    // dynamic fields (participantName, contestTitle, score, percentage, rank,
    // timeTakenSecs, issuedAt, contestDate, orgName/logo/color, certificateId) that the
    // built-in renderer already resolves via buildRenderContext(). Otherwise, fall back
    // to the three built-in PARTICIPATION/ACHIEVEMENT/MERIT variants — unchanged default.

    let html: string;
    let usesCustomTemplate = false;

    if (metadata.templateId) {
        const template = await certificateTemplateService.getTemplate(metadata.templateId, organizationId);
        // getTemplate throws NotFoundError if missing/not owned by this org — caught below, marks job FAILED (retryable)
        html = renderCustomTemplateHtml(template.htmlContent, metadata, certificateId);
        usesCustomTemplate = true;
    } else {
        html = renderCertificateHtml(metadata, certificateId);
    }
```

And update the `generatePdf` call site (Step 4) to pass the flag through:

```ts
    let pdfBuffer: Buffer;
    try {
        pdfBuffer = await generatePdf(html, usesCustomTemplate);
    } catch (err: any) {
        throw new Error(`[certificate-worker] PDF generation failed for cert ${certificateId}: ${err.message}`);
    }
```

`NotFoundError` thrown by `certificateTemplateService.getTemplate()` (e.g. the template
was deleted after being referenced) will propagate out of `processCertificate`, get
caught by BullMQ, and land in the existing `worker.on("failed", ...)` handler exactly like
any other worker error today — it marks the certificate row `FAILED` with the error
message as the reason, visible in the existing certificate dashboard, retryable the same
way as any other failure. No new error-handling path needs to be built.

### 3.7 Verification for this phase

1. Create a certificate template via the Phase 1 API with body
   `<h1>{{participantName}}</h1><p>Scored {{percentage}}% — Rank {{rank}}</p>`.
2. Call `POST /certificates/issue` with `{ participantId, templateId: "<the template id>" }`
   for an eligible (SUBMITTED + EVALUATED) participant.
3. Confirm the `Certificate` row's `metadata` column now contains `templateId`.
4. Let the worker process the job (or trigger it manually in a dev environment) and
   confirm the generated PDF shows the participant's real name/percentage/rank
   substituted into the custom HTML — not the built-in PARTICIPATION/ACHIEVEMENT/MERIT
   design.
5. Issue a certificate **without** `templateId` for a different participant and confirm
   it still renders one of the three built-in variants exactly as before — this proves
   the change is additive and non-breaking for every existing org.
6. Delete the template, then hit `/certificates/:id/retry` on a certificate that
   referenced it — confirm the job fails cleanly and the certificate row shows `FAILED`
   with a clear reason (not a worker crash).

---

## Phase 4 — Frontend: template management UI + picker in the issue flow

### 4.1 `frontend/lib/api/certificate-templates.api.ts` — new file

```ts
import { get, post, patch, del } from './apiClient';

export interface CertificateTemplateListItem {
    id:        string;
    name:      string;
    variables: string[];
    createdAt: string;
    updatedAt: string;
}

export interface CertificateTemplateDetail extends CertificateTemplateListItem {
    htmlContent: string;
}

export interface TemplatePreviewResult {
    html:                string;
    detectedVariables:   string[];
    unknownPlaceholders: string[];
}

export const certificateTemplatesApi = {
    list:   () => get<CertificateTemplateListItem[]>('/certificate-templates'),
    getById: (id: string) => get<CertificateTemplateDetail>(`/certificate-templates/${id}`),
    create: (body: { name: string; htmlContent: string }) =>
        post<CertificateTemplateDetail>('/certificate-templates', body),
    update: (id: string, body: { name?: string; htmlContent?: string }) =>
        patch<CertificateTemplateDetail>(`/certificate-templates/${id}`, body),
    remove: (id: string) => del<{ message: string }>(`/certificate-templates/${id}`),
    preview: (body: { templateId?: string; htmlContent?: string }) =>
        post<TemplatePreviewResult>('/certificate-templates/preview', body),
};
```

### 4.2 `frontend/lib/hooks/useCertificateTemplates.ts` — new file

Standard react-query wiring, same shape as `useParticipantCertificate.ts`:

```ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificateTemplatesApi } from '@/lib/api/certificate-templates.api';
import { toast } from 'sonner';

export function useCertificateTemplates() {
    return useQuery({
        queryKey: ['certificate-templates'],
        queryFn: () => certificateTemplatesApi.list(),
    });
}

export function useCertificateTemplate(id: string | null) {
    return useQuery({
        queryKey: ['certificate-template', id],
        queryFn: () => certificateTemplatesApi.getById(id as string),
        enabled: !!id,
    });
}

export function useCreateCertificateTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: { name: string; htmlContent: string }) => certificateTemplatesApi.create(body),
        onSuccess: () => {
            toast.success('Certificate template saved');
            queryClient.invalidateQueries({ queryKey: ['certificate-templates'] });
        },
        onError: (err: any) => toast.error(err.message || 'Failed to save template'),
    });
}

export function useUpdateCertificateTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: { name?: string; htmlContent?: string } }) =>
            certificateTemplatesApi.update(id, body),
        onSuccess: () => {
            toast.success('Certificate template updated');
            queryClient.invalidateQueries({ queryKey: ['certificate-templates'] });
        },
        onError: (err: any) => toast.error(err.message || 'Failed to update template'),
    });
}

export function useDeleteCertificateTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => certificateTemplatesApi.remove(id),
        onSuccess: () => {
            toast.success('Certificate template deleted');
            queryClient.invalidateQueries({ queryKey: ['certificate-templates'] });
        },
        onError: (err: any) => toast.error(err.message || 'Failed to delete template'),
    });
}

export function usePreviewCertificateTemplate() {
    return useMutation({
        mutationFn: (body: { templateId?: string; htmlContent?: string }) => certificateTemplatesApi.preview(body),
        onError: (err: any) => toast.error(err.message || 'Failed to preview template'),
    });
}
```

### 4.3 `frontend/app/org/certificates/templates/page.tsx` — new file

New page — org-wide template library. Build using existing primitives already in
`components/ui/`: `Card`, `Table`, `Dialog`, `Input`, `Textarea`, `Button`, `Badge`,
`AlertDialog` (for delete confirmation). Do **not** reuse `FileUpload.tsx` — it assumes
image previews (`<img src={preview}>`) and base64 data-URL encoding, neither of which fits
a text/HTML file. Read an uploaded `.html` file with plain `FileReader.readAsText(file)`,
not `readAsDataURL` — the backend accepts raw HTML text in JSON, no base64 decoding step
needed anywhere in this feature.

Required behaviour:

- List saved templates in a table (name, variables used, last updated, edit/delete
  actions) via `useCertificateTemplates()`.
- "New template" button opens a `Dialog` with: a `name` `Input`, and a `Textarea` for
  pasting HTML **or** a plain `<input type="file" accept=".html,text/html">` that reads
  the file as text and fills the same textarea (both paths populate one state variable —
  don't build two separate code paths for paste-vs-upload).
- A "Preview" button inside the dialog calls `usePreviewCertificateTemplate()` with the
  current textarea content (`{ htmlContent }`) and renders the result in
  `<iframe srcDoc={result.html} className="w-full aspect-[297/210] border rounded" />`
  (A4 landscape aspect ratio, matching the certificate's actual page dimensions from
  `certificate.template.ts`). Show `detectedVariables` as green badges and
  `unknownPlaceholders` as amber "not recognized — will render blank" badges directly
  under the preview.
- "Save" button is disabled until at least one preview has been run against the current
  textarea content (enforces the "preview before save" decision at the UI level, not just
  server-side) — track this with a simple `hasPreviewed` boolean that resets to `false`
  whenever the textarea content changes.
- Editing an existing template: clicking a row opens the same dialog prefilled via
  `useCertificateTemplate(id)`, save calls `useUpdateCertificateTemplate()` instead of
  create.
- Delete: `AlertDialog` confirmation, then `useDeleteCertificateTemplate()`.

Static cheat-sheet to display in the dialog (no new endpoint needed for this — the
known-variable list rarely changes, hardcode it in this page as plain copy):

```
Available variables: {{participantName}} {{contestTitle}} {{contestDate}} {{score}}
{{percentage}} {{rank}} {{timeTakenSecs}} {{issuedAt}} {{orgName}} {{orgLogoUrl}}
{{primaryColor}} {{certificateId}}
```

### 4.4 `frontend/app/org/certificates/page.tsx` — modify

Add one button next to the existing "Contest Dashboard" button (~line 44-48) linking to
the new template library page:

```tsx
<Button variant="outline" asChild className="rounded-xl h-11">
    <Link href="/org/certificates/templates">
        <Award className="mr-2 h-4 w-4" /> Manage Templates
    </Link>
</Button>
```

No nav.tsx / `app/org/layout.tsx` changes — the existing single "Certificates" nav entry
already routes here; a nested top-level nav item isn't needed for one sub-page (YAGNI).

### 4.5 `frontend/lib/api/results-certs.api.ts` — modify

Add `templateId` to both issue functions so a chosen template flows through to the
backend:

```ts
    issueCertificate: (contestId: string, body: { participantId: string; templateId?: string }) =>
        post<any>(`/certificates/issue`, { ...body, contestId }),

    bulkIssueCertificates: (contestId: string, body?: { templateId?: string }) =>
        post<any>(`/certificates/bulk-issue`, { ...body, contestId }),
```

(Drop the old unused `templateData?: any` param on `issueCertificate` and the unused
`cutoffPercentage?: number` param on `bulkIssueCertificates` while touching these lines —
neither is read anywhere on the backend today; grep confirms `cutoffPercentage` has no
consumer in `certificate.service.ts`.)

### 4.6 `frontend/lib/hooks/useParticipantCertificate.ts` — modify

`useParticipants()` mutations need to accept and forward a `templateId`:

```ts
  const bulkIssueMutation = useMutation({
    mutationFn: (templateId?: string) => certificatesApi.bulkIssueCertificates(contestId, { templateId }),
    // ... onSuccess/onError unchanged ...
  });

  const singleIssueMutation = useMutation({
    mutationFn: ({ participantId, templateId }: { participantId: string; templateId?: string }) =>
        certificatesApi.issueCertificate(contestId, { participantId, templateId }),
    // ... onSuccess/onError unchanged ...
  });
```

Any call site of `singleIssueMutation.mutate(participantId)` elsewhere needs updating to
`singleIssueMutation.mutate({ participantId, templateId: selectedTemplateId })` — this
touches Phase 4.7 below, which is the only call site (`certificates/page.tsx` under
`contests/[id]`).

### 4.7 `frontend/app/org/contests/[id]/certificates/page.tsx` — modify

Add a template picker. This page already imports `Select`/`SelectContent`/`SelectItem`/
`SelectTrigger`/`SelectValue` (lines 42-48) — reuse them, don't add a new dropdown
primitive.

- Add `const { data: templatesRes } = useCertificateTemplates();` and
  `const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);`
- Render a `Select` near the existing bulk-issue / single-issue controls: options are
  `"Default (built-in design)"` (value `undefined`/empty string) plus one `SelectItem`
  per template from `templatesRes?.data`.
- Update `handleBulkIssue` to call `bulkIssueMutation.mutate(selectedTemplateId)`.
- Update `handleSingleIssueSubmit` to call
  `singleIssueMutation.mutate({ participantId: issueParticipantId, templateId: selectedTemplateId })`.

### 4.8 Verification for this phase

Build the frontend (`npm run build` in `frontend/`). Manually walk through: open
`/org/certificates/templates`, paste a small HTML snippet with 2-3 known placeholders and
one typo'd one, hit Preview, confirm the iframe renders with real-looking sample data and
the typo shows up as an "unrecognized" badge, save it, confirm it appears in the table.
Go to a contest's certificates page, pick the new template from the dropdown, issue one
certificate, and confirm (once the worker processes it) the generated PDF matches what
the preview showed.

---

## Phase 5 — Security hardening review (should already be satisfied by Phases 2-3, verify explicitly)

- [ ] `sanitizeHtml()` in `certificate-template.service.ts` strips `<script>` tags on
      every create/update — confirm by saving a template containing
      `<script>alert(1)</script>` and checking the stored `htmlContent` has it removed.
- [ ] `generatePdf(html, disableScripts)` in the worker calls
      `page.setJavaScriptEnabled(false)` whenever `metadata.templateId` is set — this is
      the actual enforcement boundary (the sanitize step is defense-in-depth, not the
      only line of defense). Confirm the built-in-template path (`disableScripts = false`)
      is completely unaffected — no behavior change for existing orgs.
- [ ] `htmlContent` is capped at 200KB in the Zod schemas (Phase 1.2) — confirm a
      request with a larger payload is rejected with a 400 before it ever reaches the
      service layer.
- [ ] No new external network calls were introduced anywhere in the render path — the
      only place a custom template's HTML can reference an external resource is via
      `{{orgLogoUrl}}` inside an `<img>` tag, which is exactly the same trust boundary the
      built-in templates already have today (org's own logo URL, admin-controlled).

---

## Phase 6 — Optional: one lightweight test

The repo has thin Jest coverage today (`payment-registration.test.ts`,
`payout.service.test.ts` are the only two files) — matching that level, not over-building:
add `backend/src/modules/certificate/certificate-template.render.test.ts` with 2-3 cases
for `renderCustomTemplateHtml()`: known-variable substitution, unknown-placeholder
blanking, and a template with zero placeholders (returned unchanged). This is optional —
skip it if the agent following this plan is time-constrained; it does not block shipping
the feature, it's a nice-to-have safety net for the one genuinely new piece of logic
(`renderCustomTemplateHtml`'s regex substitution).

---

## Full file manifest

**New files (11):**
- `backend/src/modules/certificate-template/certificate-template.types.ts`
- `backend/src/modules/certificate-template/certificate-template.validator.ts`
- `backend/src/modules/certificate-template/certificate-template.repository.ts`
- `backend/src/modules/certificate-template/certificate-template.service.ts`
- `backend/src/modules/certificate-template/certificate-template.controller.ts`
- `backend/src/modules/certificate-template/certificate-template.routes.ts`
- `frontend/lib/api/certificate-templates.api.ts`
- `frontend/lib/hooks/useCertificateTemplates.ts`
- `frontend/app/org/certificates/templates/page.tsx`
- `backend/prisma/migrations/<timestamp>_add_certificate_templates/migration.sql` (generated, not hand-written)
- `backend/src/modules/certificate/certificate-template.render.test.ts` (optional, Phase 6)

**Modified files (11):**
- `backend/prisma/schema.prisma` (new model + one relation line on `Organization`)
- `backend/src/routes.ts` (import + mount)
- `backend/src/container.ts` (3 new exports, 1 existing export's constructor args changed)
- `backend/src/modules/certificate/certificate.types.ts` (repurpose `templateId` comment, add field to 2 DTOs)
- `backend/src/modules/certificate/certificate.validator.ts` (add `templateId` to 2 schemas)
- `backend/src/modules/certificate/certificate.service.ts` (new constructor param, template validation in `issueCertificate` + `bulkIssueCertificates`)
- `backend/src/modules/certificate/certificate.controller.ts` (`bulkIssueCertificates` passes `templateId` through)
- `backend/src/modules/certificate/certificate.template.ts` (one new exported function, nothing else touched)
- `backend/src/workers/certificate.worker.ts` (2 new imports, `generatePdf` signature, Step 3 branch)
- `frontend/app/org/certificates/page.tsx` (one new button)
- `frontend/lib/api/results-certs.api.ts` (`templateId` param on 2 functions, drop 2 dead params)
- `frontend/lib/hooks/useParticipantCertificate.ts` (mutation signatures)
- `frontend/app/org/contests/[id]/certificates/page.tsx` (template picker `Select` + updated mutation calls)

**Explicitly do NOT touch:**
- `certificate.repository.ts` — no changes needed anywhere in it.
- The three built-in template variants inside `certificate.template.ts`
  (`buildHtml`, `variantCopy`, `buildStatsBlock`, all the CSS) — stay byte-for-byte
  identical; this feature is additive only.
- `queues/index.ts` / `certificateQueue` definition — job payload shape
  (`CertificateJobPayload`) is unchanged; `metadata` already carried arbitrary extra
  fields via its `[key: string]: any` index signature, so no payload-shape migration is
  needed for existing queued/in-flight jobs.
- `retryCertificate` / `retryFailedCertificates` in `certificate.service.ts` — confirmed
  in Phase 3.3, they work unmodified because they replay the certificate's stored
  `metadata` as-is.
- `storage.service.ts` — not used by this feature at all (HTML is stored as Postgres
  text, not as an S3/local object) — confirm no accidental S3 upload call gets added for
  template HTML.
