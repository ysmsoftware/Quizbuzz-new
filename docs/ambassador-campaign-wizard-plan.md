# Ambassador Campaign Creation — Redesign Plan

**Branch:** `feature/ambassador-program`
**Scope:** Convert the current single giant-form campaign creation flow into a multi-step wizard with draft persistence, followed by a status-gated post-publish management dashboard.
**Status:** Plan only — no code changed yet.

---

## 1. Current state (confirmed from code)

The entire feature already works end-to-end, but as one form and one payload:

- **One create endpoint**: `POST /api/v1/org/ambassadors/campaigns` (`ambassador-campaign.routes.ts`) takes the full payload — `contestId`, `name`, `ambassadorTypesAllowed`, a fully-populated `rewardConfig` (milestone tiers, speed bonus, leaderboard prizes), and `shareTemplates` — validated in one shot by `CreateCampaignSchema` in `ambassador-campaign.validator.ts`. A campaign cannot exist in the database until every section is complete (`milestoneTiers` requires `min(1)`).
- **One form component**: `frontend/components/features/ambassador/CampaignForm.tsx` renders every section (Details → Milestone Tiers → Speed Bonus → Leaderboard Prizes → Share Templates) on one scrollable page, plain `useState`, one submit button, one POST/PATCH. Used for both create and edit — same component, same "everything editable" behavior.
- **No draft state.** `AmbassadorCampaignStatus` is only `ACTIVE | ARCHIVED`. There's no `DRAFT`. Leaving the form mid-fill loses everything.
- **No field locks after publish.** `PATCH /campaigns/:id` and the edit form accept changes to any field regardless of how live the campaign is (registrations, rewards paid out, etc.).
- **No ambassador structure, capacity calc, or timeline/phases** — `college`/`department` are free-text keys inside `Ambassador.applicationData`, not structured groups with targets. There's no start/end date or phase concept on the campaign itself (only inherited from the linked `Contest`).
- **Templates only exist as "duplicate"** — `POST /campaigns/:id/duplicate` clones a full campaign into a new contest. No standalone reusable template.
- **A working precedent already exists in the codebase**: `ContestService.updateContest` (`backend/src/modules/contest/contest.service.ts:247-311`) implements exactly the status-gated field-lock pattern this project needs — an `editableStatuses` allowlist, fields blocked past `DRAFT`, and a narrow allowlist once further along (`REGISTRATION_CLOSED` → only `maxParticipants`). Copy this pattern rather than inventing a new one.

---

## 2. Target design

```
CREATE                                          MANAGE (post-publish)
01 Basics            (required)                 Overview
02 Promotion          (required)                Ambassadors
03 Ambassador Structure (required)               Leaderboard
04 Rewards            (required)                 Rewards
05 Leaderboards       (optional)                 Timeline
06 Timeline           (required)                 Resources
07 Ambassador Kit     (optional)                 Settings
08 Review & Publish   (required)
```

Each wizard step PATCHes the draft campaign as the admin moves forward (no client-side-only state that can be lost). Publishing is an explicit status transition, not just "the last POST call." After publishing, editing happens on a per-tab management dashboard, not by reopening the wizard — and field-level lock rules apply based on campaign status.

---

## 3. Data model changes

### 3.1 Status state machine (replaces `ACTIVE | ARCHIVED`)

```prisma
enum AmbassadorCampaignStatus {
  DRAFT
  PUBLISHED
  LIVE
  ENDED
  ARCHIVED
}
```

- `DRAFT` — being built in the wizard, everything editable, may be incomplete (no minimum tier count enforced).
- `PUBLISHED` — passed Review & Publish, visible to ambassadors, before the contest's registration window opens.
- `LIVE` — contest registration is open / campaign actively accruing registrations. Can be set explicitly, or derived from `Contest.status` transitioning to `PUBLISHED`/`LIVE` (worth deciding: mirror `Contest.status` or keep independent — recommend deriving it to avoid drift, since `AmbassadorCampaign.contestId` is already a strict 1:1).
- `ENDED` — contest closed/completed; rewards still payable/reportable, structural fields locked.
- `ARCHIVED` — existing value, kept for the current archive-via-PATCH behavior.

**Migration note:** every existing `ACTIVE` row should map to `LIVE` (they're already running with real ambassadors/registrations) in the migration, not `DRAFT` — don't retroactively lock in-flight campaigns into a state the admin can't act on.

### 3.2 New fields on `AmbassadorCampaign`

```prisma
model AmbassadorCampaign {
  ...
  status              AmbassadorCampaignStatus @default(DRAFT)   // was ACTIVE
  wizardStep          Int      @default(1)                       // last completed step, for resume
  registrationTarget  Int?                                       // capacity: total target
  startDate           DateTime?
  endDate             DateTime?
  phases              Json?    @default("[]")                    // generated CampaignPhase[] snapshot
  sourceTemplateId    String?                                     // set when instantiated from a template
}
```

`registrationTarget` and per-group targets are what makes `rankedBy: "REGISTRATION_RATE_PERCENT"` on leaderboards finally computable — that field is already schema-legal but a documented no-op in `campaign-stats.ts` because no denominator exists anywhere. This closes that gap for free.

### 3.3 New model: Ambassador Structure (Phase 2 — see rollout)

```prisma
model AmbassadorGroup {
  id                 String   @id @default(ulid())
  campaignId         String
  campaign           AmbassadorCampaign @relation(fields: [campaignId], references: [id])
  groupType          String   // "DEPARTMENT" | "COLLEGE" | "CUSTOM", config-driven not hardcoded enum
  name               String
  ambassadorTarget   Int?     // e.g. 1 ambassador per department
  registrationTarget Int?     // e.g. 100 per ambassador
  createdAt          DateTime @default(now())
}
```

This turns `college`/`department` from ad-hoc `applicationData` string keys (fragile, `"Unknown"` fallback today) into real rows the wizard's capacity calculator and the leaderboard grouping can both query directly, instead of `campaign-stats.ts` string-matching JSON.

### 3.4 New model: Campaign Templates (Phase 4)

```prisma
model AmbassadorCampaignTemplate {
  id                    String   @id @default(ulid())
  organizationId        String
  name                  String
  ambassadorTypesAllowed String[]
  rewardConfig          Json
  shareTemplates        Json     @default("{}")
  registrationTarget    Int?
  createdAt             DateTime @default(now())
}
```

Kept separate from `AmbassadorCampaign` rather than an `isTemplate` flag on the same table — a template has no `contestId` (campaigns require one, 1:1 unique) and shouldn't carry any campaign-only fields (status, enrollments). `duplicateCampaign`'s existing clone logic in `ambassador-campaign.service.ts` is directly reusable for "instantiate from template."

---

## 4. Backend changes

All within the existing module shape (`ambassador-campaign.routes/controller/service/repository/types/validator.ts`) — no new module needed.

1. **Relax `CreateCampaignSchema` for drafts.** Add a `CreateDraftCampaignSchema` (only `name` + `organizationId` required, everything else optional) used by `POST /campaigns` when no `contestId`/`rewardConfig` is supplied yet. Keep the existing strict schema as `PublishCampaignSchema`, run against the full row at the Review & Publish step.
2. **Step-scoped PATCHes reuse the existing endpoint.** No new per-step endpoints needed — `PATCH /campaigns/:id` already accepts partial bodies. Just remove/relax the requirement that a full `rewardConfig` be present, and gate it on `status === DRAFT`.
3. **Add `POST /campaigns/:id/publish`.** Explicit transition `DRAFT → PUBLISHED`. Runs the full `PublishCampaignSchema` against the accumulated row (this is where "not just the last successful PATCH" validation happens) and returns actionable validation errors per step/field so the Review screen can deep-link back to the offending step.
4. **Field-level lock enforcement in `updateCampaign`** (`ambassador-campaign.service.ts:173`) — copy the `ContestService.updateContest` pattern:
   - `editableStatuses` per field group (e.g., `contestId`, `ambassadorTypesAllowed` locked once not `DRAFT`; `shareTemplates`, description-like fields stay editable through `LIVE`; `rewardConfig`/`registrationTarget` require an explicit confirmation flag once `LIVE`).
   - Config-driven, not hardcoded per QuizBuzz's own rulebook — define the lock table as data (e.g. `campaign-field-lock.config.ts`) rather than if/else chains, same spirit as `config.scaling.maxUsersPerInstance` vs. magic numbers.
5. **Capacity calculator** — pure function `calculateCampaignCapacity(groups: AmbassadorGroup[])` → `{ ambassadorCount, registrationTarget }`, same style as the existing pure `reward-calculator.ts`. Used by both the wizard's live preview and campaign detail overview.
6. **Timeline generator** — pure function `generateCampaignPhases(startDate, endDate, milestoneTierCount)` → `CampaignPhase[]`, stored into the new `phases` JSON field on save, regenerated whenever dates change while still `DRAFT`.
7. **Template endpoints** — `POST /campaign-templates` (save current draft as template), `GET /campaign-templates`, `POST /campaigns/:id/from-template/:templateId` (reuses `duplicateCampaign`'s clone logic against a template source instead of a campaign source).

---

## 5. Frontend changes

1. **Replace `useState` bag with React Hook Form + Zod resolver, one form context per step**, matching what the frontend implementation guide already recommended (it just wasn't followed for `CampaignForm.tsx`). This is what makes per-step validation and the persistent summary sidebar tractable.
2. **New stepper shell** wrapping the existing route: `frontend/app/org/ambassadors/campaigns/new/page.tsx` becomes a stepper container with left-side step nav (✓/●/○ states) and right-side persistent summary card, reusing `useOrgAmbassadorCampaign` for the draft's live state.
3. **Reuse existing editors as step bodies, don't rewrite them**: `MilestoneTiersEditor.tsx`, `SpeedBonusEditor.tsx`, `LeaderboardPrizesEditor.tsx`, `ShareTemplatesEditor.tsx`, and `RepeatingRowTable.tsx` all drop into the new step layout largely unchanged. Only the Ambassador Structure and Timeline steps are genuinely new UI.
4. **Autosave on step transition**: each "Continue" click fires a `PATCH` mutation for that step's fields before advancing (TanStack Query mutation, same pattern as `useOrgAmbassadorCampaigns.ts` already uses) — not a debounced autosave, an explicit save-per-step, so admins get clear "saved" feedback.
5. **Review & Publish step**: calls `POST /campaigns/:id/publish`, surfaces validation errors returned per-field with a "Go to step" link back into the wizard, matching the warning-banner pattern described in the original proposal (e.g. "No reward configured for ambassadors exceeding 100 registrations").
6. **Post-publish dashboard**: new route `frontend/app/org/ambassadors/campaigns/[id]/page.tsx` (currently doesn't exist as a distinct detail view — `CampaignsList.tsx` links straight to the edit form) with tabs: Overview / Ambassadors / Leaderboard (existing `LeaderboardTable.tsx`, currently only reachable via the report page) / Rewards / Timeline / Resources / Settings. Each tab renders fields as read-only or editable based on the status lock table from backend §4.4 — mirror the same lock config on the frontend so disabled states render correctly without waiting for a failed PATCH.
7. **Templates picker**: "Start from scratch" vs "Use template" choice at the very start of `campaigns/new`, before Basics.

---

## 6. Phased rollout (recommended order)

Given the scope, ship incrementally rather than as one PR:

| Phase | Delivers | New schema? |
|---|---|---|
| **1** | Decompose `CampaignForm.tsx` into the wizard steps using *only existing fields* (Basics/Promotion/Rewards/Leaderboards/Kit/Review). Add `DRAFT` to the status enum, relax create schema, add `publish` endpoint, per-step PATCH autosave. | Yes — status enum only |
| **2** | Post-publish management dashboard + field-level lock enforcement (backend + frontend), copying `ContestService.updateContest`'s pattern. | No |
| **3** | Ambassador Structure step + capacity calculator (`AmbassadorGroup` model, replaces free-text college/department reads in `campaign-stats.ts`). | Yes |
| **4** | Timeline/Phases step + auto-generated phase preview. | Yes (`phases`, `startDate`, `endDate`) |
| **5** | Campaign templates (save/instantiate). | Yes (`AmbassadorCampaignTemplate`) |

Phase 1 alone already solves the core complaint — "giant campaign form" — and is deployable independently. Phases 3–5 are additive and don't block each other.

---

## 7. Open questions before implementation starts

1. Should `LIVE` be derived automatically from `Contest.status`, or set independently by the admin? Deriving avoids two systems drifting out of sync but adds a dependency between modules.
2. Should `registrationTarget` live at the campaign level, the group level, or both (sum-of-groups vs. explicit override)? Affects the capacity calculator's shape.
3. For Phase 1, does "Review & Publish" need to block on anything beyond what `CreateCampaignSchema` already validates, or is reusing the existing strict schema as `PublishCampaignSchema` sufficient?
4. Any existing `ACTIVE` campaigns in production data that need a manual migration decision beyond the blanket `ACTIVE → LIVE` mapping in §3.1?
