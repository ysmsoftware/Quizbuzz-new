# Ambassador ↔ Campaign Decoupling — Implementation Plan

Plan only, no code changed yet. Follow-up to `docs/ambassador-campaign-decoupling-audit.md` — that doc names five
concrete coupling points with file:line references; this doc turns each into a buildable change, in priority
order. Written against the same conventions every other module in this codebase already uses (layered
service/repository/validator split, config-driven business logic, additive-only migrations) — nothing here
introduces a new pattern the codebase doesn't already have elsewhere.

**Guiding constraint carried over from the audit's §5:** don't build further than the evidence supports. Issue #3
(campaign → Contest coupling) gets a seam, not a full generalized "target" system, because there's no second
organization's actual requirements yet to design that abstraction against — building it on a guess would just be a
different flavor of the same mistake (see Phase 4).

---

## Priority order and why

| Phase | Issue (audit §) | Schema change? | Risk if left alone | Effort |
|---|---|---|---|---|
| 1 | Hardcoded pilot template (§2.5) | None | Every new org sees YSM's exact numbers as a "system" template | Small |
| 2 | Leaderboard scope closed enum + hardcoded field lookup (§2.1–2.2) | None (JSON columns) | A second org's leaderboard cuts silently bucket into "Unknown" | Medium |
| 3 | `AmbassadorGroupType` locked to 3 literals (§2.2) | None | Capacity-planning UI can't model a non-academic org structure | Small |
| 4 | Campaign hard-wired to one Contest (§2.3) | Additive only | Blocks any non-quiz campaign type; currently undersized risk since no such client exists yet | Small (seam only) |
| 5 | Fixed 6-phase timeline template (§2.4) | Additive only | Cosmetic — wrong phase names for a non-academic calendar | Small |

Build in this order. Each phase is independently shippable and independently revertable — none blocks the others.

---

## Phase 1 — Delete the hardcoded pilot template

**Files:** `backend/src/modules/ambassador-campaign/ambassador-campaign.service.ts` (`listTemplates`,
`deleteTemplate`, `instantiateTemplate`), a new one-off seed script.

1. Delete the `systemTemplate` object literal and the `if (templateId === "quizbuzz-5k-pilot-template")` branches in
   `deleteTemplate` and `instantiateTemplate`. `listTemplates` goes back to returning exactly
   `this.campaignRepo.findAllTemplates(...)`, nothing prepended.
2. Write `backend/prisma/seeds/seed-ysm-pilot-template.ts` — a one-time script that inserts the exact same
   `rewardConfig`/`groups`/`ambassadorTypesAllowed` JSON, but as a normal row in the existing
   `AmbassadorCampaignTemplate` table, scoped to YSM's real `organizationId` (already a column on that table —
   no schema change). Run once against production, then the script's job is done; it isn't part of the app's
   runtime path.
3. Confirm YSM's copy now behaves exactly like every other org's custom template — editable, deletable, not
   special-cased anywhere in the service layer.

**Verification:** query `AmbassadorCampaignTemplate` for any other `organizationId` and confirm the pilot template
never appears in that org's `listTemplates` response.

---

## Phase 2 — Leaderboard scope becomes campaign-defined, not platform-defined

This is the one that actually fixes the "Unknown" bucket failure mode — the highest-value fix in the set.

### 2.1 New shape

Replace the closed `LeaderboardScope` union with a discriminated shape that reads *which `applicationData` field(s)
to group by* instead of a fixed vocabulary of scope names. This reuses a concept the codebase already has —
`AmbassadorType.applicationFields[].key` — so "group by college" becomes "group by the field whose key is
`college`," which works identically for any org's own field taxonomy, academic or not.

```ts
// ambassador-campaign.types.ts — replaces the old `LeaderboardScope` string union
export type LeaderboardScopeKind = "INDIVIDUAL_AMBASSADOR" | "APPLICATION_FIELD_GROUP";

export interface LeaderboardScope {
    kind: LeaderboardScopeKind;
    /** Present only when kind === "APPLICATION_FIELD_GROUP". Ordered list of
     *  Ambassador.applicationData field keys to group by — length 1 for a simple cut
     *  ("college"), length 2+ for a combined/nested cut (["college","department"], the
     *  old "inter-college department" scope generalized to N levels instead of exactly
     *  two). Every key must belong to at least one of the campaign's ambassadorTypesAllowed
     *  applicationFields — validated at campaign save time, see §2.3. */
    groupByFieldKeys?: string[] | undefined;
}

export interface LeaderboardCut {
    scope: LeaderboardScope;
    label: string;              // now fully admin-authored — no more scope→label lookup table
    rankedBy?: "REGISTRATION_RATE_PERCENT" | undefined;
    winnerCount?: number | undefined;
    ranks: { /* unchanged */ }[];
    consolation?: { label: string; cashAmount: number } | undefined;
}
```

### 2.2 `campaign-stats.ts` — generalize `groupKeyAndLabel`

```ts
// replaces the hardcoded college/department switch
function groupKeyAndLabel(scope: LeaderboardScope, ambassador: Ambassador): { key: string; label: string } {
    if (scope.kind === "INDIVIDUAL_AMBASSADOR") {
        return { key: ambassador.id, label: `${ambassador.firstName} ${ambassador.lastName ?? ""}`.trim() };
    }

    const data = (ambassador.applicationData ?? {}) as Record<string, unknown>;
    const keys = scope.groupByFieldKeys ?? [];
    const values = keys.map((k) => String(data[k] ?? "Unknown"));

    return {
        key: values.join("::"),
        label: values.join(" / "),
    };
}
```

Nothing else in `computeLeaderboardGroups`/`findPrizeForRank` changes — they already treat `scope` as an opaque
value passed through to `groupKeyAndLabel`.

### 2.3 Validator changes

```ts
// ambassador-campaign.validator.ts — replaces the 4-literal z.enum
const leaderboardScopeSchema = z.object({
    kind: z.enum(["INDIVIDUAL_AMBASSADOR", "APPLICATION_FIELD_GROUP"]),
    groupByFieldKeys: z.array(z.string().min(1)).min(1).max(3).optional(),
}).superRefine((data, ctx) => {
    if (data.kind === "APPLICATION_FIELD_GROUP" && (!data.groupByFieldKeys || data.groupByFieldKeys.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select at least one field to group by.", path: ["groupByFieldKeys"] });
    }
});
```

`leaderboardCutSchema.scope` becomes `leaderboardScopeSchema` (both occurrences — reward-config schema and the
leaderboard-query schema). At publish time (`ambassador-campaign.service.ts`'s publish path, not the validator
itself — this needs the org's live type catalog, which a pure Zod schema can't look up), cross-check every
`groupByFieldKeys` entry against the union of `applicationFields[].key` across the campaign's
`ambassadorTypesAllowed` types (via `getAmbassadorTypeByKey`, already imported in this module) — reject publish
with a clear message if an admin picked a field key that doesn't exist on any allowed type. Same posture as the
existing `_validateApplicationData` check in `ambassador.service.ts`.

### 2.4 Data migration for existing rows

`rewardConfig`/`shareTemplates` are JSON columns, so this is a data-only migration script, not a Prisma schema
migration:

```ts
// backend/prisma/migrations-data/migrate-leaderboard-scope-shape.ts
const SCOPE_MAP: Record<string, LeaderboardScope> = {
    INDIVIDUAL_AMBASSADOR: { kind: "INDIVIDUAL_AMBASSADOR" },
    DEPARTMENT: { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["department"] },
    COLLEGE: { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["college"] },
    INTER_COLLEGE_DEPARTMENT: { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["college", "department"] },
};
```

Walk every `AmbassadorCampaign` and `AmbassadorCampaignTemplate` row, rewrite each `leaderboardPrizes[].scope`
through `SCOPE_MAP`, write back. Run once, in a maintenance window; verify row counts touched match the count of
rows with a non-empty `leaderboardPrizes` array before running.

### 2.5 Frontend

- `frontend/lib/types/ambassador.ts` — `LeaderboardScope`/`LEADERBOARD_SCOPES` change from the fixed 4-item const
  array to the new discriminated shape; `LEADERBOARD_SCOPES` (the fixed render list) goes away.
- `LeaderboardPrizesEditor.tsx` — instead of mapping over a fixed `LEADERBOARD_SCOPES` array with a hardcoded
  `SCOPE_LABEL` lookup, render one always-on "Individual Ambassador" card plus an "Add a group leaderboard" action
  that lets the admin pick 1–2 field keys from the union of the campaign's selected ambassador types'
  `applicationFields` (already fetched for the applicant-facing form elsewhere — reuse that hook) and type a label
  for the cut themselves.
- `LeaderboardTable.tsx` — drop the hardcoded `SCOPE_LABEL` map; the cut's own admin-authored `label` (already
  returned by the API) is what renders, exactly like every other campaign-authored string in this UI already
  works.

**Verification:** create a test campaign whose ambassador type's `applicationFields` use `team`/`region` instead of
`college`/`department`, add an `APPLICATION_FIELD_GROUP` cut keyed on `team`, confirm the leaderboard groups
correctly instead of falling into "Unknown."

---

## Phase 3 — Relax `AmbassadorGroupType` to a free string

**Files:** `ambassador-campaign.validator.ts` (`ambassadorGroupSchema`), `ambassador-campaign.types.ts`
(`AmbassadorGroupType`).

```ts
// was: groupType: z.enum(["DEPARTMENT", "COLLEGE", "CUSTOM"])
groupType: z.string().trim().min(1).max(50),
```

```ts
// ambassador-campaign.types.ts
export type AmbassadorGroupType = string; // was: "DEPARTMENT" | "COLLEGE" | "CUSTOM"
```

No Prisma change — `AmbassadorGroup.groupType` is already a plain `String` column; only the Zod boundary was
artificially narrower than the schema. Frontend's `AmbassadorStructureStep.tsx` swaps its (presumably 3-option)
type picker for a combo-box: a few common suggestions (Department, College, Team, Region, Cohort) plus free text,
same UX pattern as a tags input. This also makes the Phase 2 field-key picker and the Ambassador Structure step
conceptually consistent — both are now "pick or type a category name," not two different closed vocabularies.

**Verification:** create an Ambassador Structure row with `groupType: "Region"`, confirm it saves and displays
without hitting the old enum's 400.

---

## Phase 4 — Seam around the Contest coupling (not a full generalization)

Per the audit's closing note: generalizing "what a campaign promotes" into a real pluggable target system before a
second organization's actual requirements exist is a guess, and guessed abstractions are exactly the kind of
premature coupling this whole effort is trying to undo. What's worth doing now is cheap and reversible; what's not
worth doing now is deferred explicitly.

**Do now:**

- Introduce a small internal value type, used only inside the service layer (no schema change, no API change):

```ts
// ambassador-campaign.types.ts
export type CampaignTarget = { type: "CONTEST"; contestId: string };
// Only variant today. A second variant (e.g. `{ type: "EXTERNAL_URL"; url: string }`)
// is additive to this union whenever a real second case shows up — nothing upstream of
// this type needs to change shape to add one.
```

- Everywhere `ambassador-campaign.service.ts` currently reasons about "the campaign's contest" as a bare
  `contestId` string, route it through this type instead — e.g. `resolveTarget(campaign): CampaignTarget`. This is
  a naming/organization change, not a behavior change: `PublishCampaignSchema` still requires `contestId`, referral
  capture still only resolves against `Contest`, nothing about what ambassadors or admins see changes.

**Explicitly deferred, and why:** relaxing `contestId` to optional end-to-end, generalizing `AvailableCampaignItem`/
`MyCampaignItem` to not assume a contest is always present, and building a second attribution path (for whatever a
non-quiz campaign would actually resolve `?ref=` against) — all of this needs a real second use case to design
against. Doing it now means guessing at a shape for "external URL campaign" or "form-submission campaign" with zero
concrete requirements, which risks building the *next* piece of accidental coupling instead of removing this one.
Revisit this phase specifically when an actual second organization's campaign type is known.

---

## Phase 5 — Campaign timeline phases become overridable, not fixed

**Files:** `campaign-timeline.ts`, `schema.prisma` (additive column), `ambassador-campaign.validator.ts`.

```prisma
// schema.prisma — additive only
model AmbassadorCampaign {
  // ...existing fields...
  phaseTemplate  Json?   // CampaignPhaseTemplate[] override; null = use the built-in default
}
```

```ts
// campaign-timeline.ts
const DEFAULT_PHASE_TEMPLATE: CampaignPhaseTemplateEntry[] = [ /* today's 6 entries, unchanged, now just the default */ ];

export function generateCampaignPhases(
    startDate: Date,
    endDate: Date,
    template: CampaignPhaseTemplateEntry[] = DEFAULT_PHASE_TEMPLATE,
): CampaignPhase[] { /* same body, just reads `template` instead of the module-level constant */ }
```

Wizard's Timeline step gets an "edit phases" affordance (rename/add/remove/reweight entries, fractions must still
sum to 1 — reuse the existing validation) that's optional — an org that never touches it gets today's exact 6
phases, byte-for-byte, so this is fully backward compatible. Lowest priority in this set since a wrong phase label
degrades gracefully (cosmetic) rather than silently breaking data the way Phases 1–2 did.

---

## Build order

1. Phase 1 (delete + seed) — ship first, smallest possible diff, immediately stops every new org from seeing YSM's
   numbers.
2. Phase 2 (leaderboard scope) — the functional fix; do the backend (§2.1–2.4) and frontend (§2.5) together since
   the type change is shared between them, then run the data migration (§2.4) against existing campaigns/templates
   before deploying the validator change that would reject the old shape.
3. Phase 3 (group type) — independent, can land any time after Phase 2 or in parallel; no ordering dependency.
4. Phase 4 (contest seam) — independent, purely internal, no user-facing change; land whenever convenient.
5. Phase 5 (phase template) — independent, lowest priority; land last or defer to a later pass entirely.

## Open items to confirm before building

- **Phase 2 field-key limit:** the plan caps `groupByFieldKeys` at 2–3 levels (`max(3)` in the Zod schema above).
  Confirm that's enough — the pilot brief only ever needed 2 (college + department combined).
- **Phase 2 migration window:** confirm whether any campaigns are currently `LIVE` with real ambassador data before
  running the data migration script, since the deploy needs to land the migration and the new validator/service
  code in the same release (old-shape `scope` values would fail the new validator otherwise).
- **Phase 4 scope check:** confirm the recommendation to defer full target-generalization is right, or if there's
  already a concrete second-org requirement (even directional) that should shape `CampaignTarget`'s second variant
  now instead of later.
- **Phase 1 seed script ownership:** confirm YSM's organizationId and who runs the one-off seed script in
  production (this session, or handed off).
