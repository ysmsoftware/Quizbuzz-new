# Ambassador Program — Backend Implementation Guide

**Audience: an AI coding agent (Claude Code) building the `Quizbuzz-new/backend` side of this feature in
its own session, in parallel with a separate frontend session.** This document is self-contained — it
restates every decision the backend needs from the design doc (`docs/ambassador-incentive-program-plan.md`)
so this session doesn't need that doc open. If anything here conflicts with that plan doc, the plan doc
is the design source of truth and this doc's job is to translate it into buildable steps; flag the
conflict rather than silently picking one.

**Out of scope for this session:** anything in `frontend/`, and anything in the separate
`quizbuzz-ops-next` repo (the Ambassador Type catalog CRUD screen and its own database tables — that's a
different codebase entirely, not part of this backend). What this session *does* need to produce, on the
main app's side, is the small mirror tables (`PlatformAmbassadorType`,
`OrganizationAmbassadorTypeAccess`) that `quizbuzz-ops-next` writes into — see §3.

**Ground truth this doc is built from** (read these before writing any code, they define every
convention below): `backend/src/modules/contact/*` (the module-shape reference), `backend/src/error/`,
`backend/src/middlewares/authenticated-participant.middleware.ts` and
`authenticated-org.middleware.ts`, `backend/src/providers/s3.provider.ts`, `backend/src/container.ts`,
`backend/src/routes.ts` (flat file, not a `routes/` directory — every module router is mounted here with
`apiRouter.use("/prefix", someRouter)`), `backend/src/modules/dashboard/dashboard.validator.ts` (sort/pagination
query convention), `backend/src/common/feature-flags.ts`, `backend/src/modules/quiz-registration/` (OTP
pattern to reuse for ambassador login).

---

## 1. Conventions this module must follow — non-negotiable

These aren't stylistic suggestions — they're how every existing module in this codebase is already built,
confirmed by reading `modules/contact/*` end to end. New code that doesn't follow this shape will look
foreign next to everything else.

**Layered separation of concerns (SRP).** Five files per module, each with exactly one job:

- `*.routes.ts` — only route → controller-method wiring. No logic, no validation, no `req.body` access.
- `*.controller.ts` — HTTP boundary only: parse+validate input via the Zod schema, pull auth context off
  `req`, call exactly one service method, shape the HTTP response, `next(err)` on failure. No Prisma
  imports, no business rules.
- `*.service.ts` — all business logic lives here. Orchestrates repositories and other services, throws
  the typed `AppError` subclasses, never touches `req`/`res`, never imports Prisma directly.
- `*.repository.ts` — only Prisma queries. No business rules, no throwing domain errors (return `null`
  and let the service decide what that means).
- `*.types.ts` — DTOs (what a controller hands a service), Result/ListItem shapes (what a service hands
  back), and Filter shapes (what a service hands a repository). Three different shapes for three
  different layers, even when they look similar — don't collapse them into one type, that's exactly the
  kind of coupling that makes a module hard to extend later.
- `*.validator.ts` — Zod schemas only, one per request shape, plus the inferred TS types exported
  alongside.

**Dependency injection, manually, via the constructor — no DI framework.** Every service/controller takes
its dependencies as constructor parameters (see `ContactService(contactRepo, messagingService,
certificateService)`), and `container.ts` is the single place anything gets `new`'d up and wired together.
A service never reaches for a singleton or does its own `new XRepository()` — that's what makes it
trivially testable and swappable later (Liskov/DIP in practice, not just in name).

**Interfaces where more than one implementation is plausible, concrete classes where it isn't.**
`FileStorageProvider` is an interface with an `S3StorageProvider` implementation because storage backend
is a real axis of variation in this codebase. A repository talking to exactly one Postgres schema doesn't
need an interface — `ContactRepository` is a concrete class, not `IContactRepository` + implementation,
because there's only ever going to be one. Follow that same judgment here: no interface ceremony for
`AmbassadorRepository`/`AmbassadorCampaignRepository` (Postgres via Prisma, always will be); the reward
calculation, however, gets a small strategy shape (§6.4) because "how a tier reward is computed" is
exactly the kind of thing this plan doc already says must stay config-driven, not hardcoded — treat that
as the Open/Closed axis: new reward *shapes* should be addable without editing the tier-walking loop.

**RESTful routes, explicit query params for every list endpoint, always paginated, sorting supported the
same way `dashboard.validator.ts` already does it** — `page`/`limit` with sane bounded defaults,
`sortBy`/`sortOrder` as a closed `z.enum(...)`, coerced with `z.coerce.number()`, never trusting a raw
`req.query` value into a Prisma call. Every list response returns `{ data, total, page, limit,
totalPages }`, exactly `PaginatedContactsResult`'s shape — reuse the name/shape convention for every new
list endpoint's return type instead of inventing a fresh envelope per endpoint.

**Response envelope**, exactly as `ContactController` does it: `res.status(...).json({ success: true,
data, message?, requestId: req.id })` on success; on failure, don't build a response at all — call
`next(err)` and let the existing global error middleware turn an `AppError` subclass into the right
status/body. Never invent a new error-shaping path.

**Errors are typed, from `error/http-errors.ts`, not raw `throw new Error(...)`.** `NotFoundError`,
`ConflictError`, `BadRequestError`, `ForbiddenError`, `UnauthorizedError`, `UnprocessableEntityError` cover
nearly everything this module needs. Add new subclasses only when an error needs to carry structured data
a generic 4xx can't (the way `PlanLimitExceededError`/`FeatureUnavailableError` do) — see §7 for the one
or two this module actually needs.

---

## 2. Module layout to create

```
backend/src/modules/ambassador/
  ambassador.routes.ts
  ambassador.controller.ts
  ambassador.service.ts
  ambassador.repository.ts
  ambassador.types.ts
  ambassador.validator.ts

backend/src/modules/ambassador-campaign/
  ambassador-campaign.routes.ts
  ambassador-campaign.controller.ts
  ambassador-campaign.service.ts
  ambassador-campaign.repository.ts
  ambassador-campaign.types.ts
  ambassador-campaign.validator.ts

backend/src/middlewares/
  authenticated-ambassador.middleware.ts

backend/src/common/
  ambassador-types.ts          # read-side SDK for the ops-mirrored type catalog, see §3
```

Two modules, not one, matching the plan doc's reasoning exactly: `ambassador/` is everything the
ambassador identity itself needs (apply, OTP login, own dashboard reads, campaign self-join).
`ambassador-campaign/` is the org-admin surface (applications review queue, campaign CRUD, reward config,
reporting/leaderboards). Same underlying tables, two audiences, two trust boundaries — don't merge them
into one module just because the schema is shared; `contact` vs. `contact`-read-through-`messaging`
already demonstrates this codebase's comfort with that split.

---

## 3. Prisma schema — additive migration, main app's database

Add to `backend/prisma/schema.prisma`. Nothing here touches an existing model except the additive
`Participant.referredByEnrollmentId` field at the bottom.

```prisma
enum AmbassadorStatus {
  PENDING
  APPROVED
  REJECTED
  SUSPENDED
}

enum AmbassadorCampaignStatus {
  ACTIVE
  ARCHIVED
}

model Ambassador {
  id                String            @id @default(cuid())
  organizationId    String
  email             String
  phone             String?
  firstName         String
  lastName          String?
  ambassadorType    String            // PlatformAmbassadorType.key — validated at application time, not a DB FK (see below)
  applicationData   Json              @default("{}")   // type-specific answers, keyed by that type's applicationFields[].key
  status            AmbassadorStatus  @default(PENDING)
  proofStorageKey   String
  proofUrl          String
  appliedAt         DateTime          @default(now())
  reviewedAt        DateTime?
  reviewedById      String?
  rejectionReason   String?
  isActive          Boolean           @default(true)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  organization      Organization                    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  enrollments        AmbassadorCampaignEnrollment[]

  @@unique([organizationId, email])
  @@index([organizationId, status])
  @@map("ambassadors")
}

model AmbassadorCampaign {
  id                      String                    @id @default(cuid())
  organizationId          String
  contestId               String
  name                    String
  ambassadorTypesAllowed  String[]
  rewardConfig            Json                       // see ambassador-campaign.types.ts RewardConfig — §6.4
  shareTemplates          Json      @default("{}")   // { whatsappText, instagramText, posterImageUrl } — see frontend doc §6
  sourceCampaignId        String?
  status                  AmbassadorCampaignStatus  @default(ACTIVE)
  createdById             String
  createdAt               DateTime                  @default(now())
  updatedAt               DateTime                  @updatedAt

  organization            Organization              @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  contest                 Contest                   @relation(fields: [contestId], references: [id], onDelete: Cascade)
  enrollments              AmbassadorCampaignEnrollment[]

  @@unique([contestId])
  @@index([organizationId, status])
  @@map("ambassador_campaigns")
}

model AmbassadorCampaignEnrollment {
  id              String     @id @default(cuid())
  campaignId      String
  ambassadorId    String
  referralCode    String     @unique
  createdAt       DateTime   @default(now())

  campaign        AmbassadorCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  ambassador      Ambassador         @relation(fields: [ambassadorId], references: [id], onDelete: Cascade)
  referrals       Participant[]      @relation("ReferredBy")

  @@unique([campaignId, ambassadorId])
  @@index([referralCode])
  @@map("ambassador_campaign_enrollments")
}

// Read-only mirror of quizbuzz-ops-next's AmbassadorType catalog — quizbuzz-ops-next writes these two
// tables via a fire-and-forget raw-SQL write-through on every type create/edit/toggle (same mechanism as
// platform_feature_flags — see backend/src/common/feature-flags.ts for the pattern to copy). This
// session does NOT need to build the writer side, only these two tables + the reader (§3.1).
model PlatformAmbassadorType {
  key               String   @id
  label             String
  proofFieldLabel   String
  applicationFields Json     // array of { key, label, type, required, options? } — see §6.2
  isActive          Boolean  @default(true)
  updatedAt         DateTime @updatedAt
  @@map("platform_ambassador_types")
}

model OrganizationAmbassadorTypeAccess {
  organizationId String
  typeKey        String
  isEnabled      Boolean  @default(false)
  updatedAt      DateTime @updatedAt
  @@id([organizationId, typeKey])
  @@map("organization_ambassador_type_access")
}
```

Add to the existing `Participant` model — additive only:

```prisma
model Participant {
  // ...existing fields, unchanged...
  referredByEnrollmentId String?
  referredByEnrollment   AmbassadorCampaignEnrollment? @relation("ReferredBy", fields: [referredByEnrollmentId], references: [id])

  @@index([referredByEnrollmentId])
}
```

Run `npx prisma migrate dev --name add_ambassador_program` and confirm the migration is additive-only in
the generated SQL (no `ALTER TABLE ... DROP`, no changes to any existing column) before committing it.

### 3.1 `common/ambassador-types.ts` — reading the mirrored catalog

Structurally identical to `common/feature-flags.ts`: local Prisma read against
`PlatformAmbassadorType`/`OrganizationAmbassadorTypeAccess`, small in-memory TTL cache (60s is fine, this
data changes rarely), fails closed to an empty array on any error — an org that can't be read simply has
no ambassador types available, never crashes a request.

```ts
export interface AmbassadorTypeDefinition {
  key: string;
  label: string;
  proofFieldLabel: string;
  applicationFields: ApplicationFieldDef[]; // §6.2
}

export async function getEnabledAmbassadorTypes(organizationId: string): Promise<AmbassadorTypeDefinition[]>;
export async function getAmbassadorTypeByKey(key: string, organizationId: string): Promise<AmbassadorTypeDefinition | null>;
// ^ returns null if the type doesn't exist, is inactive, or isn't enabled for this org — one call site
//   for "is this type actually usable by this org right now", used by both the application-submit
//   validation and the applications-queue rendering.
```

---

## 4. Auth — `authenticated-ambassador.middleware.ts` + OTP login

Structurally identical to `authenticated-participant.middleware.ts`: token from `req.cookies.ambassadorToken`
→ `Authorization: Bearer` header → `x-ambassador-token` header fallback, `jwt.verify` against
`config.auth.jwt.accessSecret`, attaches `req.ambassador = { id, organizationId }`, `next(new
UnauthorizedError(...))` on any failure. Add the `ambassador` property to the Express `Request` type
augmentation file the same place `participant`/`user` already live.

OTP issuance/verification reuses the exact machinery `quiz-registration.service.ts` already has (Redis-backed
OTP storage + rate limiting + `EmailProvider.send` direct call, not queued — see the plan doc's §0.6 for
why direct-send, not `MessagingService.enqueueMessage`, is correct here). Two endpoints, both public:

- `POST /api/v1/public/ambassador/auth/request-otp` — `{ email, organizationId }`. 404s (via `NotFoundError`,
  not a leaking "no such ambassador" message) if no `Ambassador` row exists for that email+org — don't
  reveal whether an email has applied before to an unauthenticated caller.
- `POST /api/v1/public/ambassador/auth/verify-otp` — `{ email, organizationId, otp }`. On success, issues
  `ambassadorToken` (JWT, same secret/expiry pattern as `contactToken`), sets it as an httpOnly cookie, and
  returns the ambassador's current `status` in the body so the frontend can route straight to §waiting /
  §rejected / §dashboard without a second round trip.

---

## 5. REST API surface

Every list endpoint below returns the paginated envelope from §1. Every route under `/api/v1/public/*` is
unauthenticated but org-scoped by an explicit `organizationId` query/body param; every route under
`/api/v1/ambassador/*` requires `authenticatedAmbassadorMiddleware`; every route under
`/api/v1/org/ambassadors*` requires `authenticatedOrgMiddleware` (existing) and additionally must resolve
`isFeatureEnabled("ambassador_program_enabled", { organizationId: req.user.organizationId })` before doing
anything else — a `false` result returns a plain 404 (`NotFoundError`, generic message), never a 403, per
the plan doc's "no signal the feature exists" requirement. Build this check as router-level middleware
(`requireAmbassadorProgramEnabled`) mounted once per router, not repeated per handler.

### 5.1 Public (unauthenticated) — `ambassador.routes.ts`, mounted at `/api/v1/public/ambassador`

| Method | Path | Query/Body | Notes |
|---|---|---|---|
| GET | `/types` | `?organizationId=` | Returns `AmbassadorTypeDefinition[]` from §3.1 — full shape, not just keys. |
| POST | `/apply` | body: `{organizationId, firstName, lastName?, email, phone?, ambassadorType, applicationData, proofStorageKey, proofUrl}` | Creates `Ambassador`, `status: PENDING`. See §6.1 for validation rules. |
| POST | `/upload-proof` | multipart or presigned-URL request, `{organizationId, filename, mimeType}` | Returns `{storageKey, url}` via `FileStorageProvider.getPresignedPutUrl` (or a direct multipart upload endpoint if this codebase's existing proctoring upload flow does it that way — check `proctoring.controller.ts` for the exact pattern already in use and mirror it, don't invent a second upload convention). |
| POST | `/auth/request-otp` | `{email, organizationId}` | §4 |
| POST | `/auth/verify-otp` | `{email, organizationId, otp}` | §4 |

### 5.2 Ambassador-authenticated — `ambassador.routes.ts`, mounted at `/api/v1/ambassador`

| Method | Path | Query/Body | Notes |
|---|---|---|---|
| GET | `/me` | — | Current `Ambassador` row (minus internal fields) + `status`. Drives the waiting/rejected/dashboard routing client-side. |
| GET | `/campaigns/available` | `?page=&limit=` | Active campaigns for this ambassador's org + type, not yet joined. Paginated even though volume is small at pilot scale — consistency with every other list endpoint, and it's free. |
| GET | `/campaigns/mine` | `?page=&limit=` | Every campaign this ambassador has joined, each row including live stats (§6.3) inline — this is the dashboard's primary data source. |
| POST | `/campaigns/:campaignId/join` | — | Creates `AmbassadorCampaignEnrollment`, generates `referralCode`. `ConflictError` if already enrolled (idempotent-safe: returns the existing enrollment instead of erroring, so a double-click doesn't surface an error to the user — decide and document which; recommend "return existing" since nothing is lost by allowing it). |
| GET | `/campaigns/:campaignId/stats` | — | Single-campaign live detail: registration count, current milestone tier + progress to next, speed-bonus status, leaderboard rank per enabled cut, reward summary. Powers the per-campaign card's "expand" state so `/campaigns/mine` doesn't have to return this much detail for every row. |
| GET | `/campaigns/:campaignId/leaderboard` | `?scope=&page=&limit=` | `scope` one of the `LeaderboardScope` values from the campaign's `rewardConfig.leaderboardPrizes` (§6.4) — paginated ranked list for that cut. |

### 5.3 Org-admin — `ambassador-campaign.routes.ts`, mounted at `/api/v1/org/ambassadors`

| Method | Path | Query/Body | Notes |
|---|---|---|---|
| GET | `/applications` | `?status=&page=&limit=&sortBy=appliedAt\|firstName&sortOrder=` | `status` defaults to `PENDING`; accept the comma-separated multi-value pattern `dashboard.validator.ts` uses for `status` if the review screen ever wants "PENDING,SUSPENDED" in one call. |
| GET | `/applications/:id` | — | Single `Ambassador` with proof presigned GET URL attached at read time (never store a presigned URL, generate on demand, same as `getPresignedGetUrl` is used elsewhere). |
| POST | `/applications/:id/approve` | — | `status → APPROVED`. Fires the approval email (§7 notes the direct-send pattern). |
| POST | `/applications/:id/reject` | `{reason}` | `reason` required, `BadRequestError` if missing. `status → REJECTED`. |
| GET | `/campaigns` | `?status=&page=&limit=&sortBy=createdAt\|name&sortOrder=` | Org's own campaigns. |
| POST | `/campaigns` | `{contestId, name, ambassadorTypesAllowed, rewardConfig, shareTemplates}` | `ConflictError` if `contestId` already has an active campaign (`@@unique([contestId])`). |
| GET | `/campaigns/:id` | — | Full campaign detail. |
| PATCH | `/campaigns/:id` | partial body | Reward config / share templates / allowed-types edits. |
| POST | `/campaigns/:id/duplicate` | `{contestId}` | Creates a new campaign, `sourceCampaignId` pointing back, copies `rewardConfig`/`ambassadorTypesAllowed`/`shareTemplates`. |
| GET | `/campaigns/:id/report` | `?page=&limit=&sortBy=registrationCount\|createdAt&sortOrder=` | Per-ambassador rows: live count, tier, accrued reward. |
| GET | `/campaigns/:id/report/export` | — | CSV/XLSX "amount owed" export, feeding the manual-disbursement process — same shape decision as whatever the payout rollback work already exports, check `payout` module for the existing export convention and mirror it rather than inventing a new one. |
| GET | `/campaigns/:id/leaderboard` | `?scope=&page=&limit=` | Same query shape as the ambassador-facing version (§5.2), org-admin authorization instead. |

Every `POST`/`PATCH` body above gets its own Zod schema in `ambassador.validator.ts` /
`ambassador-campaign.validator.ts` — do not share one loose schema across multiple endpoints even when
two request bodies happen to overlap; `CreateContactSchema` vs. `UpdateContactSchema` staying separate
despite the overlap is the precedent.

---

## 6. Business-logic details the service layer must get right

### 6.1 Application validation (`ambassador.service.ts#apply`)

1. Resolve the type via `getAmbassadorTypeByKey(ambassadorType, organizationId)` (§3.1) — `BadRequestError`
   if `null` (type doesn't exist / isn't enabled for this org). Never trust the client's claim that a type
   is valid.
2. Validate `applicationData` against that type's `applicationFields`: every `required: true` field must
   be present and non-empty; every `SELECT` field's value must be one of its `options`. Collect *all*
   violations before throwing (one `BadRequestError` listing every missing/invalid field, not a
   fail-on-first-error loop — better UX on the form side, and matches how Zod's own `.refine` reporting
   works elsewhere in this codebase).
3. Check `@@unique([organizationId, email])` proactively (`findByEmail` first) and throw `ConflictError`
   with a clear "you've already applied" message — don't let the Prisma unique-constraint error bubble up
   raw, same posture `ContactService.create` already takes for its own unique check.
4. Create the row, `status: PENDING`, then call `EmailProvider.send` directly (not queued) for the
   confirmation email.

### 6.2 `applicationFields` shape (shared type, used by both modules' validators)

```ts
export type ApplicationFieldType = "TEXT" | "EMAIL" | "PHONE" | "NUMBER" | "SELECT" | "DATE";

export interface ApplicationFieldDef {
  key: string;
  label: string;
  type: ApplicationFieldType;
  required: boolean;
  options?: string[]; // only meaningful when type === "SELECT"
}
```

This type is owned by this backend (put it in `common/ambassador-types.ts` or a small shared
`modules/ambassador/ambassador.types.ts` export) since both the public apply endpoint and the org-admin
applications-review endpoint need it, and the frontend session will import the *shape* (not the file) by
matching this contract exactly — hand this type definition to the frontend session verbatim so both sides
agree on it byte-for-byte.

### 6.3 Live stats — computed, not stored

Every number on an ambassador's dashboard or the org-admin report — registration count, milestone tier,
speed-bonus status, leaderboard rank, accrued reward — is computed at read time from `COUNT(Participant
WHERE referredByEnrollmentId = enrollment.id)` joined against `AmbassadorCampaign.rewardConfig`. No
ledger/reward table, on purpose (plan doc §0.4) — at pilot scale this is a handful of cheap aggregate
queries per request, not something to prematurely optimize. Put this computation in
`ambassador-campaign.service.ts` as a private method (`_computeStats(enrollment, campaign,
registrationCount)`) shared by both the ambassador-facing endpoint and the org-admin report endpoint —
one implementation, two callers, exactly the DRY concern the plan doc already flagged.

### 6.4 Reward config shape — the Open/Closed point in this module

```ts
export interface RewardConfig {
  currency: string;
  amountsInPaise: true;
  milestoneTiers: MilestoneTier[];
  speedBonus?: SpeedBonusConfig;
  leaderboardPrizes: LeaderboardCut[];
}

export interface MilestoneTier {
  minRegistrations: number;
  maxRegistrations: number | null; // null = uncapped top tier
  rewardType: "PER_REGISTRATION" | "FLAT_PLUS_PER_REG";
  amountPerRegistration: number;
  goodie?: { label: string; cashEquivalent?: number };
}

export interface SpeedBonusConfig {
  enabled: boolean;
  campaignStartAt: string; // ISO
  milestoneThreshold: number;
  tiers: { withinDays: number; bonusAmount: number; label: string }[];
}

export type LeaderboardScope = "INDIVIDUAL_AMBASSADOR" | "DEPARTMENT" | "INTER_COLLEGE_DEPARTMENT" | "COLLEGE";

export interface LeaderboardCut {
  scope: LeaderboardScope;
  label: string;
  rankedBy?: "REGISTRATION_RATE_PERCENT";
  winnerCount?: number;
  ranks: { rank?: number; rankRange?: [number, number]; cashAmount?: number; goodie?: { label: string; cashEquivalent?: number }; label?: string }[];
  consolation?: { label: string; cashAmount: number };
}
```

Walk `milestoneTiers` and `leaderboardPrizes` generically — the service must never special-case a
specific tier count, a specific `scope` value beyond the four listed, or a specific reward number. A
`RewardCalculator` class (or a couple of pure functions if a class feels like ceremony for this — use
judgment, but keep it in one place either way) that takes `(rewardConfig, registrationCount)` and returns
the computed tier/bonus/accrued-amount is the right shape: it's the one piece of this module where a
future "new reward mechanism the pilot brief didn't have" should be addable by extending this function,
not by touching the controller/route/repository layers at all.

### 6.5 Referral capture — the one integration point into existing code

`ContestService.registerParticipant` (`contest.service.ts:446`) gets exactly one additive change: after
its existing logic resolves/creates the `Participant` row, look up an optional `ref` field (passed through
from the registration request body — coordinate the exact field name with the frontend session, recommend
`referralCode`) against `AmbassadorCampaignEnrollment.referralCode` scoped to that contest's one active
campaign (`@@unique([contestId])` makes this a single lookup, not an ambiguous one), and if it resolves,
set `referredByEnrollmentId` on the `Participant` row being created/reused. Missing/unrecognized code →
proceed exactly as today, silently unattributed. This must not add a new required parameter, must not
change any existing return shape, and must not run an extra query when `ref` is absent (short-circuit
before touching the DB). Write a regression test asserting the existing resume-or-fresh flow's behavior
is byte-for-byte unchanged when no `ref` is present, before touching this function.

---

## 7. New error types

Two are worth adding to `error/http-errors.ts`, both thin `ConflictError`/`BadRequestError` subclasses
carrying structured data, following the `FeatureUnavailableError` precedent exactly:

```ts
export class AmbassadorApplicationExistsError extends ConflictError {
  constructor(public readonly email: string) {
    super(`An ambassador application for "${email}" already exists for this organization.`);
  }
}

export class InvalidApplicationDataError extends BadRequestError {
  constructor(public readonly violations: { field: string; issue: string }[]) {
    super("One or more required fields are missing or invalid.");
  }
}
```

Everything else (`NotFoundError` for a missing campaign/application, `ForbiddenError` if ever needed,
`ConflictError` for "already enrolled" / "contest already has an active campaign") reuses the existing
generic classes — don't add a subclass unless it's carrying structured data a consumer actually needs to
branch on.

---

## 8. Wiring: `container.ts` and `routes/index.ts`

`container.ts` — same manual-instantiation pattern as every existing module, added in dependency order:

```ts
export const ambassadorRepository = new AmbassadorRepository();
export const ambassadorCampaignRepository = new AmbassadorCampaignRepository();
export const ambassadorService = new AmbassadorService(ambassadorRepository, /* EmailProvider, FileStorageProvider, ... */);
export const ambassadorCampaignService = new AmbassadorCampaignService(ambassadorCampaignRepository, ambassadorRepository /* for cross-reads */);
export const ambassadorController = new AmbassadorController(ambassadorService);
export const ambassadorCampaignController = new AmbassadorCampaignController(ambassadorCampaignService);
```

`backend/src/routes.ts` — mount both routers the same way every other module router is mounted
(`apiRouter.use("/contacts", contactRouter)` is the exact precedent, line 34 of that file):

```ts
apiRouter.use("/public/ambassador", ambassadorPublicRouter);
apiRouter.use("/ambassador", ambassadorRouter);
apiRouter.use("/org/ambassadors", ambassadorCampaignRouter);
```

(Public vs. authenticated ambassador routes can live in one `ambassador.routes.ts` file with two exported
routers, or two files — match whatever split feels least awkward once the route table above is actually
written; either is consistent with the rest of the codebase, which doesn't have a single fixed rule about
this.)

---

## 9. File upload — extending `validateFolder`

`s3.provider.ts`'s `validateFolder` currently only accepts `proctoring/{contestSlug}/{participantSlug}`.
Extend it (don't bypass it) to also accept `ambassador-proof/{organizationSlug}/{ambassadorId}` — same
three-segment shape, same validation strictness:

```ts
function validateFolder(folder: string) {
    const parts = folder.split("/");
    const validPrefixes = ["proctoring", "ambassador-proof"];
    if (parts.length !== 3 || !validPrefixes.includes(parts[0] as string) || !parts[1] || !parts[2]) {
        throw new Error("Access Denied: Invalid folder structure.");
    }
}
```

Confirm which of the two existing upload conventions this codebase actually uses end-to-end (direct
multipart to an Express endpoint that then calls `.upload()`, vs. a presigned-PUT-URL round trip via
`.getPresignedPutUrl()`) by reading how `proctoring` evidence uploads work today, and copy that exact
flow — don't introduce a third upload pattern for one new module.

---

## 10. Build order

1. Prisma migration (§3) — additive only, run and inspect the generated SQL before committing.
2. `common/ambassador-types.ts` (§3.1) — can be built and unit-tested against seeded rows in the two
   mirror tables before anything else exists (insert test rows manually via `psql`/Prisma Studio until
   the ops-side writer exists — that's a different repo's session).
3. `authenticated-ambassador.middleware.ts` + the two OTP endpoints (§4) — testable in isolation with curl/
   Postman once an `Ambassador` row can be created manually.
4. `ambassador` module: apply/upload-proof endpoints (§5.1, §6.1) — no auth dependency yet, testable
   immediately after step 1.
5. `ambassador-campaign` module: applications review + campaign CRUD (§5.3) — no ambassador-facing surface
   needed to build/test this against seeded applications.
6. `ambassador` module: authenticated endpoints — `/me`, `/campaigns/available`, `/campaigns/:id/join`
   (§5.2) — depends on step 3 + step 5 having at least one seeded campaign to join.
7. Live stats (§6.3, §6.4) + leaderboard endpoints — depends on step 6 having real enrollments to compute
   against; write these against seeded `Participant.referredByEnrollmentId` rows before wiring §6.5's real
   integration point.
8. §6.5 referral capture in `registerParticipant` — do this last, and only after writing the regression
   test for "no `ref` present → unchanged behavior" first (red-green: test should pass before this change
   even lands, then stay green after).
9. Report export (§5.3's `/report/export`) — depends on step 7.

## 11. Verification checklist before handing off

- `tsc --noEmit` clean.
- Every list endpoint actually accepts and honors `page`/`limit`/`sortBy`/`sortOrder` and returns the
  `{data, total, page, limit, totalPages}` envelope — spot check at least three of them.
- `POST /apply` rejects a request with a missing required type-specific field, and rejects an unknown
  `ambassadorType`, with clear 400s.
- A second application from the same email+org returns `ConflictError`, not a raw Prisma constraint
  error.
- `isFeatureEnabled("ambassador_program_enabled", ...)` resolving `false` makes every `/api/v1/org/ambassadors*`
  route 404, not 403 — verify the exact status code and that the body doesn't leak the feature's existence.
- The referral-capture regression test from step 8 above passes.
- Nothing in `payment/`, `contest/registerParticipant`'s existing behavior, or the resume-or-fresh flow
  changed — rerun that flow's existing tests if any exist, or manually retrace the three scenarios from
  the payment-registration verification pass earlier in this project.
