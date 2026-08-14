# Campaign Engine Decoupling — Backend Implementation Guide

**Audience: an AI coding agent (Claude Code) building the `Quizbuzz-new/backend` side of this refactor in its
own session, in parallel with a separate frontend session** (`campaign-engine-frontend-implementation-guide.md`).
This document is self-contained — it restates every decision this session needs from
`docs/ambassador-campaign-decoupling-audit.md` (what's wrong, with file:line evidence) and
`docs/ambassador-campaign-decoupling-plan.md` (the shape of the fix) so neither needs to stay open. If anything
here conflicts with those two docs, treat this doc as the buildable, final version — it supersedes the plan doc's
phase numbering with the build order in §9.

**Scope — read this twice before starting.** This pass touches **only the campaign engine**: `AmbassadorCampaign`,
`AmbassadorCampaignTemplate`, `AmbassadorGroup`, and the reward/leaderboard config that lives inside them. It does
**not** touch `Ambassador` identity, application, OTP auth, or the ambassador's own dashboard endpoints — those are
already built, already working, and are explicitly the *next* iteration. Concretely: everything in
`backend/src/modules/ambassador-campaign/` is in scope; `backend/src/modules/ambassador/` is out of scope except
for the one read-only contract noted in §8 (the ambassador-facing "available/mine" campaign lists must keep
working against the new leaderboard scope shape — verify, don't rebuild).

**Why this matters, restated in one paragraph:** an Ambassador is a generic promoter — student, staff, or general
— and a Campaign is a generic promotional effort an ambassador can join. The entity split between them is already
correct. What isn't correct yet is that the *reward/leaderboard engine inside a campaign* still assumes every
campaign is college-and-department shaped, because it was built by translating one client's pilot brief directly
into enum literals and a hardcoded template instead of keeping it as campaign-owned config. This pass finishes the
job the entity split started: a campaign fully describes its own reward structure, its own leaderboard grouping,
and its own ambassador-type eligibility, with nothing about a second organization's differently-shaped program
requiring a code change.

---

## 1. Non-negotiable conventions — same rules as every existing module

Confirmed by reading `ambassador-campaign.{routes,controller,service,repository,types,validator}.ts` end to end —
this pass follows the exact same shape, no exceptions:

- **Layered separation of concerns (SRP).** `*.routes.ts` wires routes to controller methods only.
  `*.controller.ts` parses/validates via Zod, pulls `req.user`, calls exactly one service method, shapes the
  response, `next(err)` on failure — no Prisma, no business rules. `*.service.ts` holds all business logic,
  throws typed `AppError` subclasses, never touches `req`/`res`. `*.repository.ts` holds only Prisma queries, never
  throws domain errors (`null` on not-found, let the service decide). `*.types.ts` keeps DTO/Result/Filter shapes
  separate even when they look similar.
- **Manual constructor DI, no framework.** `container.ts` is the only place anything gets `new`'d up. A service
  takes its dependencies as constructor params; never a singleton import, never a service reaching for its own
  `new XRepository()`.
- **Open/Closed where the axis of variation is real.** `reward-calculator.ts` already does this correctly (walks
  `milestoneTiers`/`leaderboardPrizes` generically, no special-cased count or scope). This pass extends the same
  discipline to the leaderboard *grouping* logic (§3), which today is the one place that still special-cases
  values instead of walking config.
- **RESTful list endpoints: always paginated, filterable, sortable via explicit query params**, exactly the
  `dashboard.validator.ts` convention already used everywhere else — `page`/`limit` with `z.coerce.number()` and
  bounded defaults, `sortBy` as a closed `z.enum(...)`, `sortOrder` as `"asc"|"desc"`, comma-separated multi-value
  filters where useful (`ListApplicationsQuerySchema`'s `status` param is the precedent — accepts
  `?status=PENDING` or `?status=PENDING,SUSPENDED`). Every list response returns exactly
  `{ data, total, page, limit, totalPages }` — never invent a new envelope shape.
- **Response envelope**: `res.status(...).json({ success: true, data, message?, requestId: req.id })` on success;
  `next(err)` on failure, no response built by hand in a catch block.
- **Typed errors only**, from `error/http-errors.ts` (`NotFoundError`, `ConflictError`, `BadRequestError`,
  `ForbiddenError`, `UnprocessableEntityError`). Add a new subclass only when it needs to carry structured data a
  generic 4xx can't (see `InvalidApplicationDataError` for the precedent) — none of this pass's changes need one.
- **Database migrations: schema-first, always, no exceptions.** Every schema change in this doc is expressed as a
  `schema.prisma` diff. **Never hand-write or hand-edit a `.sql` migration file.** After editing `schema.prisma`,
  run `npx prisma migrate dev --name <descriptive_snake_case_name>` from `backend/`, let Prisma generate the SQL,
  open the generated file under `backend/prisma/migrations/<timestamp>_<name>/migration.sql` to confirm it's
  additive-only and matches intent, and commit the schema change and the generated migration folder together as
  one unit. If a generated migration looks wrong, fix `schema.prisma` and regenerate — don't patch the SQL by
  hand. Data-migration scripts (rewriting existing JSON column contents, §3.5) are separate one-off TypeScript
  files run via `ts-node`, not Prisma migrations — Prisma migrations only ever change structure, never data, in
  this codebase's convention.

---

## 2. Fix #1 — delete the hardcoded pilot template (do this first, ships independently)

**File:** `backend/src/modules/ambassador-campaign/ambassador-campaign.service.ts`.

The `systemTemplate` object literal inside `listTemplates` (currently reproducing the exact YSM pilot brief's
₹1500/₹1800/₹2000 tiers, "Bluetooth Earbuds," "Free Premium Internship," and the 50-department/17-college group
counts) and every branch checking the literal string `"quizbuzz-5k-pilot-template"` (in `listTemplates`,
`deleteTemplate`, `instantiateTemplate`) get deleted outright. After this change:

- `listTemplates(organizationId, query)` becomes exactly `this.campaignRepo.findAllTemplates({ organizationId, ...query })` wrapped in the paginated envelope — no prepended object, for any organization.
- `deleteTemplate`/`instantiateTemplate` drop their `if (id === "quizbuzz-5k-pilot-template")` special case entirely; every template ID is treated identically, a real row looked up via `campaignRepo.findTemplateById`.

**Seed script**, new file `backend/prisma/seeds/seed-ysm-pilot-template.ts`: a standalone script (not part of any
request path) that inserts the exact same `rewardConfig`/`groups`/`ambassadorTypesAllowed` JSON as a normal row in
`AmbassadorCampaignTemplate`, scoped to YSM's real `organizationId` — that table already has an `organizationId`
column, so this needs zero schema change. Take `organizationId` as a CLI arg (`ts-node prisma/seeds/seed-ysm-pilot-template.ts --orgId=<id>`) rather than hardcoding it in the script, so the script itself isn't yet another place a
specific tenant's ID is baked into committed code. Run it once against production after this deploy lands, then
its job is done — it's operational tooling, not runtime code.

**Verification:** call `GET /org/ambassadors/campaign-templates` as a *different* organization than YSM and confirm
the pilot template never appears. Call it as YSM and confirm the seeded row appears, is editable via `PATCH`-style
template flows if any exist, and deletable like any other template (no more "System default templates cannot be
deleted" special case).

---

## 3. Fix #2 — leaderboard scope becomes campaign-defined (the core fix)

This replaces the closed 4-literal `LeaderboardScope` union with a shape that reads *which `Ambassador.applicationData`
field key(s) to group by*, sourced from the campaign's own `ambassadorTypesAllowed` types' `applicationFields`
(already a real, per-org, per-type schema — see `common/ambassador-types.ts`) instead of a fixed vocabulary of
`DEPARTMENT`/`COLLEGE`. This is the fix that stops a second organization's differently-shaped ambassador structure
(e.g. `team`/`region` instead of `college`/`department`) from silently bucketing into "Unknown."

### 3.1 New types — `ambassador-campaign.types.ts`

```ts
// Replaces: export type LeaderboardScope = "INDIVIDUAL_AMBASSADOR" | "DEPARTMENT" | "INTER_COLLEGE_DEPARTMENT" | "COLLEGE";

export type LeaderboardScopeKind = "INDIVIDUAL_AMBASSADOR" | "APPLICATION_FIELD_GROUP";

export interface LeaderboardScope {
    kind: LeaderboardScopeKind;
    /** Present only when kind === "APPLICATION_FIELD_GROUP". Ordered list of
     *  Ambassador.applicationData field keys to group by — length 1 for a simple cut
     *  (e.g. ["college"]), length 2-3 for a combined/nested cut (e.g. ["college","department"],
     *  generalizing the old "inter-college department" scope to N levels instead of exactly
     *  two). Every key must belong to at least one applicationFields definition across the
     *  campaign's ambassadorTypesAllowed types — enforced in the service layer, §3.3, not in
     *  the Zod schema (a pure schema has no access to the org's live type catalog). */
    groupByFieldKeys?: string[] | undefined;
}

export interface LeaderboardCut {
    scope: LeaderboardScope;
    label: string; // fully admin-authored now — no scope→label lookup table anywhere
    rankedBy?: "REGISTRATION_RATE_PERCENT" | undefined;
    winnerCount?: number | undefined;
    ranks: {
        rank?: number | undefined;
        rankRange?: [number, number] | undefined;
        cashAmount?: number | undefined;
        goodie?: { label: string; cashEquivalent?: number | undefined } | undefined;
        label?: string | undefined;
    }[];
    consolation?: { label: string; cashAmount: number } | undefined;
}
```

Every other type in this file that references `LeaderboardScope` (`CampaignStats.leaderboardRanks`,
`LeaderboardQueryDTO.scope`, `LeaderboardEntryResult`) keeps its field name and position — only the underlying
type of `LeaderboardScope` itself changes, from a string union to this object shape. This keeps the diff
mechanical everywhere except the two files below that actually branch on scope's *content*.

### 3.2 `campaign-stats.ts` — generalize `groupKeyAndLabel`

Replace the hardcoded `college`/`department` switch with a small, injectable resolver — this is the Open/Closed
point for this file, matching how `reward-calculator.ts` already treats reward math as the OCP axis for that
module:

```ts
/** Strategy interface: how a leaderboard scope resolves to a group key + label for one
 *  ambassador. INDIVIDUAL_AMBASSADOR needs no config; APPLICATION_FIELD_GROUP reads whatever
 *  field keys the scope specifies — this function has no baked-in vocabulary of what those
 *  keys might be. Adding a third LeaderboardScopeKind later (if one is ever needed) means
 *  adding one more case here, not touching any caller. */
function groupKeyAndLabel(scope: LeaderboardScope, ambassador: Ambassador): { key: string; label: string } {
    if (scope.kind === "INDIVIDUAL_AMBASSADOR") {
        return { key: ambassador.id, label: `${ambassador.firstName} ${ambassador.lastName ?? ""}`.trim() };
    }

    const data = (ambassador.applicationData ?? {}) as Record<string, unknown>;
    const keys = scope.groupByFieldKeys ?? [];
    const values = keys.map((k) => String(data[k] ?? "Unknown"));

    return { key: values.join("::"), label: values.join(" / ") };
}
```

Nothing else in `computeLeaderboardGroups`/`findPrizeForRank` needs to change — both already treat `scope` as an
opaque value passed straight through to `groupKeyAndLabel`.

### 3.3 Validator changes — `ambassador-campaign.validator.ts`

```ts
// Replaces every occurrence of: scope: z.enum(["INDIVIDUAL_AMBASSADOR", "DEPARTMENT", "INTER_COLLEGE_DEPARTMENT", "COLLEGE"])
const leaderboardScopeSchema = z.object({
    kind: z.enum(["INDIVIDUAL_AMBASSADOR", "APPLICATION_FIELD_GROUP"]),
    groupByFieldKeys: z.array(z.string().min(1)).min(1).max(3).optional(),
}).superRefine((data, ctx) => {
    if (data.kind === "APPLICATION_FIELD_GROUP" && (!data.groupByFieldKeys || data.groupByFieldKeys.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select at least one field to group by.", path: ["groupByFieldKeys"] });
    }
    if (data.kind === "INDIVIDUAL_AMBASSADOR" && data.groupByFieldKeys) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "groupByFieldKeys must be omitted for INDIVIDUAL_AMBASSADOR.", path: ["groupByFieldKeys"] });
    }
});
```

Both `leaderboardCutSchema.scope` occurrences (inside `rewardConfigSchema`/`draftRewardConfigSchema`, and
`LeaderboardQuerySchema`) reference `leaderboardScopeSchema` instead of the old inline enum. `LeaderboardQuerySchema`
needs its `scope` param to accept the new object shape via JSON-in-query — since query strings can't carry nested
objects cleanly, encode it as `?scope=APPLICATION_FIELD_GROUP&groupByFieldKeys=college,department` (comma-split,
same convention as the existing `status` multi-value param) or `?scope=INDIVIDUAL_AMBASSADOR` for the baseline —
pick whichever reads more naturally as a URL and document it in the route table (§7), but do not silently accept a
raw JSON string in a query param — that breaks the "explicit query params" convention this codebase already
follows everywhere else.

**Cross-check against the live type catalog — service layer, not the validator.** A pure Zod schema can't see the
org's `PlatformAmbassadorType`/`OrganizationAmbassadorTypeAccess` mirror, so add this check in
`ambassador-campaign.service.ts`, run at both `updateCampaign` (when `rewardConfig` changes) and `publishCampaign`:
for every `leaderboardPrizes[].scope` with `kind: "APPLICATION_FIELD_GROUP"`, every entry in `groupByFieldKeys`
must appear in at least one `applicationFields[].key` across the union of the campaign's `ambassadorTypesAllowed`
types (fetch via `getAmbassadorTypeByKey`, already imported in this module for the applicant-side validation —
reuse it, don't duplicate the lookup). Throw `BadRequestError` naming the offending key(s) if not, mirroring
`_validateApplicationData`'s "collect every violation before throwing" posture in `ambassador.service.ts`.

### 3.4 Frontend contract note

The frontend session (parallel guide) needs the *union of `applicationFields` across the campaign's selected
`ambassadorTypesAllowed`* to build the "group by" picker UI. This already exists as a per-type read via
`GET /public/ambassador-types` — no new endpoint needed for this pass; just confirm that endpoint's response
(`AmbassadorTypeDefinition[]`, each with `applicationFields: ApplicationFieldDef[]`) is reachable from the
org-admin session too (check whether the org-admin campaign wizard currently calls the public endpoint or an
org-scoped equivalent — `PromotionStep.tsx` already calls `useAmbassadorTypes(activeOrg.id)`, so the plumbing is
there; just confirm `applicationFields` is actually included in that response today, not stripped down to
`key`/`label` only).

### 3.5 Data migration for existing rows

`rewardConfig` and `shareTemplates` are JSON columns — this is a one-off data-rewrite script, not a Prisma schema
migration:

```ts
// backend/prisma/seeds/migrate-leaderboard-scope-shape.ts (or scripts/, match wherever
// seed-ysm-pilot-template.ts from §2 lands)
const SCOPE_MAP: Record<string, LeaderboardScope> = {
    INDIVIDUAL_AMBASSADOR: { kind: "INDIVIDUAL_AMBASSADOR" },
    DEPARTMENT: { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["department"] },
    COLLEGE: { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["college"] },
    INTER_COLLEGE_DEPARTMENT: { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["college", "department"] },
};
```

Walk every `AmbassadorCampaign` and `AmbassadorCampaignTemplate` row, rewrite each `leaderboardPrizes[].scope`
through `SCOPE_MAP`, write back via `prisma.ambassadorCampaign.update`/`prisma.ambassadorCampaignTemplate.update`.
Run this **before** deploying the new validator (old-shape scope values would fail it), log a count of rows
touched, and spot-check one campaign's `rewardConfig` before/after in a non-prod database first.

**Verification:** create a test campaign whose ambassador type's `applicationFields` use `team`/`region` instead of
`college`/`department`, add an `APPLICATION_FIELD_GROUP` cut keyed on `team`, confirm `getCampaignLeaderboard`
groups correctly instead of returning every ambassador under `"Unknown"`.

---

## 4. Fix #3 — relax `AmbassadorGroupType` to a free string

**Files:** `ambassador-campaign.validator.ts` (`ambassadorGroupSchema`), `ambassador-campaign.types.ts`
(`AmbassadorGroupType`). No Prisma change — `AmbassadorGroup.groupType` is already a plain `String` column in
`schema.prisma`; only the Zod boundary was artificially narrower than the schema comment claimed.

```ts
// ambassador-campaign.validator.ts — was: groupType: z.enum(["DEPARTMENT", "COLLEGE", "CUSTOM"])
groupType: z.string().trim().min(1, "Group type is required").max(50, "Keep it under 50 characters"),
```

```ts
// ambassador-campaign.types.ts — was: export type AmbassadorGroupType = "DEPARTMENT" | "COLLEGE" | "CUSTOM";
export type AmbassadorGroupType = string;
```

No service-layer change needed beyond this — `replaceGroups`/`getGroups`/`calculateCampaignCapacity` in
`campaign-capacity.ts` already treat `groupType` as an opaque string.

**Verification:** `PUT /campaigns/:id/groups` with a row where `groupType: "Region"` saves and returns without a
400.

---

## 5. Fix #4 — a seam around the Contest coupling, not a rebuild

Per the audit's closing note and the plan doc's Phase 4: don't generalize "what a campaign promotes" into a full
pluggable target system this pass — there's no second organization's actual requirements yet to design that
abstraction against, and guessing at one now risks building the *next* piece of accidental coupling. What ships
this pass is cheap, internal, and reversible:

```ts
// ambassador-campaign.types.ts — new, used only inside the service layer, no schema/API change
export type CampaignTarget = { type: "CONTEST"; contestId: string };
// Only variant today. A second variant is additive to this union whenever a concrete second
// case exists — nothing upstream of this type has to change shape to add one.
```

Introduce a small `resolveTarget(campaign: CampaignResult): CampaignTarget` helper in
`ambassador-campaign.service.ts` and route the handful of places that currently reason about "the campaign's
contest" as a bare `contestId` string through it, wherever that reads more clearly (this is an internal
organization change, not a behavior change — `PublishCampaignSchema` still requires `contestId`, referral capture
still only resolves against `Contest`, no API response shape changes). Do not touch `AvailableCampaignItem`/
`MyCampaignItem`/`CampaignStatsDetail` in the `ambassador/` module for this — those stay exactly as they are; this
fix is scoped to internal service-layer naming, nothing user-facing.

---

## 6. Fix #5 — campaign timeline phases become overridable (lowest priority, do last)

**Files:** `campaign-timeline.ts`, `schema.prisma` (additive), `ambassador-campaign.validator.ts`,
`ambassador-campaign.service.ts`.

```prisma
// schema.prisma — additive only, run npx prisma migrate dev after this edit
model AmbassadorCampaign {
  // ...existing fields...
  phaseTemplate  Json?   // CampaignPhaseTemplateEntry[] override; null = use the built-in default
}
```

```ts
// campaign-timeline.ts
export interface CampaignPhaseTemplateEntry { key: string; label: string; fraction: number }

const DEFAULT_PHASE_TEMPLATE: CampaignPhaseTemplateEntry[] = [ /* today's 6 entries, byte-for-byte unchanged — now just the default, not the only option */ ];

export function generateCampaignPhases(
    startDate: Date,
    endDate: Date,
    template: CampaignPhaseTemplateEntry[] = DEFAULT_PHASE_TEMPLATE,
): CampaignPhase[] { /* identical body, reads `template` param instead of the module-level constant */ }
```

Add a `phaseTemplateSchema` (array of `{key, label, fraction}`, `.refine` that fractions sum to ~1 within floating
point tolerance) to the validator, accepted optionally on `PATCH /campaigns/:id` and `PublishCampaignSchema`.
`ambassador-campaign.service.ts`'s existing phase-generation call site passes `campaign.phaseTemplate ??
undefined` through to `generateCampaignPhases` so an org that never customizes it gets today's exact 6 phases,
fully backward compatible.

---

## 7. REST surface changes — filtering, sorting, and type-visibility on the campaign list

Current `GET /org/ambassadors/campaigns` (`ListCampaignsQuerySchema`) only filters by a single `status` value and
sorts by `createdAt|name`. Now that a campaign visibly targets one or more ambassador types (already modeled via
`ambassadorTypesAllowed`, already selectable in the wizard — no change needed there), an org running several
concurrent campaigns across student/staff/general audiences needs to filter/search the list by more than status.
Extend it, following the exact `dashboard.validator.ts`/`ListApplicationsQuerySchema` conventions already
established:

```ts
// ambassador-campaign.validator.ts — ListCampaignsQuerySchema, extended
export const ListCampaignsQuerySchema = z.object({
    status: statusListSchema,                          // was single-value z.nativeEnum — reuse the existing
                                                         // comma-separated statusListSchema helper (already
                                                         // defined in this file for applications) so
                                                         // ?status=PUBLISHED,LIVE works the same way
                                                         // ?status=PENDING,SUSPENDED already does for applications
    ambassadorType: z.string().optional(),               // filter: campaigns whose ambassadorTypesAllowed includes this key
    q: z.string().trim().max(200).optional(),             // filter: case-insensitive substring match on name
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["createdAt", "name", "startDate", "status"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
```

`ambassador-campaign.repository.ts`'s `findAll`/`FindCampaignsFilter` gets the matching additions:

```ts
export interface FindCampaignsFilter {
    organizationId: string;
    statuses?: AmbassadorCampaignStatus[] | undefined;   // was a single optional status
    ambassadorType?: string | undefined;
    q?: string | undefined;
    skip: number;
    take: number;
    sortBy: "createdAt" | "name" | "startDate" | "status";
    sortOrder: "asc" | "desc";
}
```

```ts
const where: Prisma.AmbassadorCampaignWhereInput = {
    organizationId: filter.organizationId,
    ...(filter.statuses?.length ? { status: { in: filter.statuses } } : {}),
    ...(filter.ambassadorType ? { ambassadorTypesAllowed: { has: filter.ambassadorType } } : {}),
    ...(filter.q ? { name: { contains: filter.q, mode: "insensitive" } } : {}),
};
```

`CampaignListItem` (the result shape) already doesn't carry `ambassadorTypesAllowed` — add it, so the frontend can
render type badges in the list without a second request per row:

```ts
export interface CampaignListItem {
    id: string;
    name: string;
    contestId: string | null;
    contestTitle: string | null;
    status: AmbassadorCampaignStatus;
    ambassadorTypesAllowed: string[];   // already selected/stored — just wasn't projected into this result shape before
    enrollmentCount: number;
    createdAt: Date;
}
```

No other endpoint in §7 of the old route table changes shape — this section only touches the list query and its
result projection.

---

## 8. Backward-compatibility checkpoint with the ambassador module (read-only, do not modify)

`ambassador.service.ts`'s `getCampaignStats`/`getCampaignLeaderboard` (the ambassador-facing versions) call the
same `computeLeaderboardGroups`/`findPrizeForRank` functions this pass changes the internals of. Their own
signatures don't change (`scope: LeaderboardScope` is still the parameter type, just a different shape now), so
these call sites should keep compiling and working once §3's type change lands — but run the ambassador module's
existing tests (if any) or manually retrace `GET /ambassador/campaigns/:campaignId/stats` and
`GET /ambassador/campaigns/:campaignId/leaderboard` against a campaign migrated by §3.5's script, and confirm the
response shapes the frontend already consumes there are unchanged. Do not add new ambassador-module functionality
in this pass — this is a compatibility check only.

---

## 9. Build order

1. **Fix #1** (§2) — smallest, ships alone, zero schema change. Delete the hardcoded template, run the seed script
   in a follow-up deploy step.
2. **Fix #2** (§3) — the core fix. Land types + validator + `campaign-stats.ts` + the service-layer cross-check
   together (they're one coherent change), run the data migration script (§3.5) against a non-prod copy first,
   then in the same release window as the code deploy (old-shape data would fail the new validator on the next
   `updateCampaign` call otherwise).
3. **Fix #3** (§4) — independent, no ordering dependency, can land any time.
4. **Fix #7** (list filtering) — natural to land alongside Fix #2 since both touch `ambassador-campaign.validator.ts`
   and the frontend needs `ambassadorTypesAllowed` on the list response to build the type-badge UI from §3.4's
   contract note.
5. **Fix #4** (§5) — independent, purely internal, land whenever convenient.
6. **Fix #5** (§6) — independent, lowest priority, land last or defer entirely if time-boxed.

## 10. Verification checklist before handing off

- `npx prisma migrate dev` was used for every schema change in this doc — no hand-edited `.sql` file anywhere in
  `backend/prisma/migrations/`.
- `tsc --noEmit` clean.
- §3.5's data migration script run against a non-prod database copy first, row-count-touched logged, one
  before/after row spot-checked.
- A campaign created with a non-academic ambassador type (`team`/`region` fields) produces correct, non-"Unknown"
  leaderboard groupings end to end.
- `GET /org/ambassadors/campaign-templates` no longer returns the YSM pilot template for a different organization.
- `GET /org/ambassadors/campaigns?status=PUBLISHED,LIVE&ambassadorType=student&q=quiz` returns correctly filtered,
  sorted, paginated results with the standard `{data, total, page, limit, totalPages}` envelope.
- Every `ambassador/` module endpoint touching campaign stats/leaderboards still returns 200s with the expected
  shape against a migrated campaign (§8).
- No `Ambassador` identity/application/auth code was touched.
