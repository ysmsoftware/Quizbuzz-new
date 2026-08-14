# Ambassador / Incentive Program — Implementation Plan

Plan only, no code changed yet. Grounded in `Quizbuzz-new/backend/src/{modules,middlewares,providers,workers,config}`
and `quizbuzz-ops-next/server/{features,db}` plus `components/views/FeatureFlagsView.tsx` (re-verified
2026-08-10 against the actual feature-flag implementation), and in the reward mechanics from
`QuizBuzz_Incentive_Program.md` / the re-uploaded `.docx` copy (identical content, table-formatted — the
YSM pilot brief). Reflects every decision made across the prior discussion — recapped inline where it
affects a design choice, not repeated in full.

**Revision note (previous pass):** §0.2 and §1.1 were rewritten to use the real Feature Flag Registry
(`FeatureFlag` / `FeatureFlagOrgOverride`, mirrored into the main app as `platform_feature_flags` /
`organization_feature_flag_overrides`) instead of the billing-tier `Plan.feature*` /
`Organization.planLimitsCache` mechanism this doc originally (incorrectly) assumed. That pass also added
the two live-data-flow walkthroughs (§4, §5) and the leaderboard/goodie reward-config structure.

**Revision note (this pass):** clarified a point that was still ambiguous — the Ambassador Type catalog
(§0.3/§1.2) is ops-created, confirmed, but *what data gets collected from an applicant* is type-specific
(a Student needs college/department, a Faculty needs employee ID, a possible future Industry/Corporate
type needs company name — none of that is one fixed shape). Rather than hardcoding a fixed field set on
`Ambassador` or relying on a seed script every time a new type shows up, each `AmbassadorType` now carries
its own **application field schema** — a small ops-authored form definition, stored as data, editable from
the same ops screen that creates the type. See §0.3 for the shape and §1.2/§3.1/§4 for how it flows
through to the actual application form. Nothing here is seeded via migration anymore, including the
initial three types — see the note at the end of §0.3.

## 0. Foundations (shared by all three parts below)

### 0.1 Where the data lives

Everything about an ambassador's identity, applications, campaigns, referral attribution, and rewards
lives in the **main app's database** (`Quizbuzz-new/backend/prisma/schema.prisma`), alongside
`Organization`/`Contest`/`Contact`/`Participant`. It has to — the main app's own request path (contest
registration, the org-admin dashboard, the ambassador's own dashboard) needs to read and write this data
directly, the same reason `OrganizationPayoutAccount` lives there instead of in `quizbuzz-ops-next`'s
own database.

What's ops-owned instead: (a) whether the program is on at all for an org — reuses the feature flag
system as-is, nothing new to mirror by hand, see §0.2; and (b) the Ambassador Type catalog
(General/Student/Faculty, ops-curated) — this one **does** need a small purpose-built mirror into the
main app, because it doesn't fit the flag system's shape. See §0.3 for why, and what that mirror looks
like.

### 0.2 How the ops toggle actually reaches the main app — the real feature flag system

This is how `quizbuzz-ops-next` actually implements flags today, confirmed by reading
`feature-flag-registry.ts`, `sync-feature-flags.ts`, `feature-flags.repository.ts`,
`feature-flags.service.ts`, `is-feature-enabled.ts`, `FeatureFlagsView.tsx`, and the main app's
`common/feature-flags.ts` + `common/effective-flag-state.ts`, plus the Prisma models on both sides:

1. **Code-defined registry** (`quizbuzz-ops-next/server/features/feature-flags/feature-flag-registry.ts`)
   — a `FEATURE_FLAG_REGISTRY` array is the single source of truth for *which flags exist*: each entry is
   `{ key, label, description, defaultEnabled, severity: STANDARD|WARNING|CRITICAL, supportsOrgOverride }`.
   Adding a flag means adding an entry here and shipping a deploy — there is no "create a flag from the
   UI" path, by design (`feature-flags.service.ts`'s `toggleFlag`/`setOrgOverride` both call
   `requireFlag(key)`, which 404s if the key isn't already synced from the registry).
2. **Sync on boot** — `syncFeatureFlagRegistry()` runs on every `quizbuzz-ops-next` boot
   (`instrumentation.ts`), upserting registry entries into ops's own `FeatureFlag` table without ever
   touching a flag's live `isEnabled` value once it exists, and soft-deprecating (never deleting) any flag
   removed from the registry, preserving the audit trail.
3. **Ops's own tables are the source of truth for "is it on right now."** `FeatureFlag` (global default +
   severity + who/when last changed) and `FeatureFlagOrgOverride` (per-org override with a required
   `reason`, optional `expiresAt`, "set = soft-remove old + insert new" so history is never mutated in
   place).
4. **Ops UI** — `FeatureFlagsView.tsx`, gated behind `hasPermission('FEATURE_FLAG_MANAGE')`
   (SUPER_ADMIN-only; everyone else sees a read-only banner). Each flag card has a global toggle
   (CRITICAL/WARNING flags require a confirmation modal on turn-ON) and, if `supportsOrgOverride: true`, a
   "Manage organizations" expander showing every existing org override plus a form to add one
   (`Organization ID` + `Enabled/Disabled` + a **required** `reason`) or remove one.
5. **Write-through mirror** — every toggle/override change writes to ops's own DB first + an audit log
   entry, then best-effort fire-and-forget mirrors the same value into the **main app's own database**
   via raw SQL (`queryMainDb`, the same cross-database pattern payouts uses) into `platform_feature_flags`
   and `organization_feature_flag_overrides`. Deliberately minimal on that side — just `key`/`isEnabled`
   and `key+organizationId`/`isEnabled`/`expiresAt` — no label/description/severity/audit fields, those
   stay ops-only.
6. **Main app reads its own local copy** — `common/feature-flags.ts`'s `isFeatureEnabled(key, { organizationId })`, backed by an in-memory TTL cache (5s for `maintenance_mode`/
   `new_registrations_paused`, 60s default) and **fails closed** (unknown key or DB error → `false`,
   falling back to a stale cache entry if one exists). Effective-state resolution
   (`common/effective-flag-state.ts`'s `computeEffectiveFlagState`) is simple: an active, non-expired org
   override always wins over the global default.
7. **Real call sites** confirm the pattern: `maintenance.middleware.ts` gates the entire `/api/v1` router
   on `maintenance_mode` (org-unaware, `supportsOrgOverride: false` — "maintenance for one org" isn't
   coherent); `contest.service.ts:879` checks `new_registrations_paused` inline inside
   `registerParticipant`, before OTP verification.

**What this means for the Ambassador Program's top-level toggle: it needs nothing new except one registry
entry.**

```ts
// feature-flag-registry.ts — new entry
{
  key: "ambassador_program_enabled",
  label: "Ambassador Program",
  description: "Enables the campus ambassador / incentive program for an organization — applications, campaigns, and the ambassador dashboard.",
  defaultEnabled: false,
  severity: "STANDARD",     // no confirmation modal — enabling this for one org isn't platform-endangering
  supportsOrgOverride: true, // this IS the "per-org rollout switch" the whole feature depends on
}
```

Ops leaves the global default OFF and adds a per-org override for YSM (`isEnabled: true`, reason: e.g.
"YSM pilot — Aug 2026") — through `FeatureFlagsView.tsx`, completely unmodified. Zero new ops UI code,
zero new ops tables, zero new main-app tables for this part. The main app checks
`await isFeatureEnabled("ambassador_program_enabled", { organizationId })` before rendering the
"Ambassadors" nav item and before letting any `/api/v1/org/ambassador*` route do anything for a
non-enabled org — returning a plain 404 rather than a 403, so there's no signal the feature exists at all
(matches "no indication or signal" from the original ask). The fail-closed default is a nice extra fit
here: if the cache/DB read ever fails, the feature silently stays hidden rather than silently appearing.

### 0.3 Ambassador Type catalog — why it's a separate small mirror, not more flag entries

Could each type (General/Student/Faculty) just be its own flag key (`ambassador_type_student_enabled`,
etc.), toggled per-org the same way? That would work for *toggling* an existing type on/off per org — but
it doesn't cover the other half of what was asked for: **"operators can create different type[s] of
ambassador... from the operational dashboard"** — i.e. ops adding a brand new type (say, "Alumni
Ambassador") later without a code deploy. The registry is deliberately code-first (§0.2, point 1) — there
is no API path to create a new flag key at runtime, on purpose, so that "what flags exist" stays
code-reviewed. That's the right constraint for platform kill-switches; it's the wrong constraint for a
small taxonomy ops wants to curate live.

So the type catalog stays its own thing, ops-owned, but **built in the same spirit** as the flag mirror —
same "ops table is the source of truth, main app gets a minimal read-only mirror kept in sync on write"
pattern, just without the registry's code-first gate on creating new entries. This is also where the
question raised this pass gets answered: **a type isn't just a name — it's a name plus the set of form
fields an applicant of that type has to fill in.** A Student needs college/department; a Faculty needs
college/department/employee ID; a hypothetical future Industry/Corporate type would need company
name/designation instead — none of that is one fixed shape, so it can't live as fixed columns on
`Ambassador`. It's carried as a small, ops-authored form definition, right on the type itself:

```prisma
// quizbuzz-ops-next/prisma/schema.prisma — ops's own database
model AmbassadorType {
  id                String   @id @default(ulid())
  key               String   @unique   // stable slug set at creation, e.g. "student" — immutable, this is the join key mirrored into the main app
  label             String              // "Student Ambassador" — editable
  description       String?
  proofFieldLabel   String   @default("Identity / Enrollment Proof")
                                        // what the required proof-document upload is called for this type,
                                        // e.g. "College ID Card" / "Employee ID Card" / "Company ID / GST Certificate"
  applicationFields Json     @default("[]")
                                        // ordered array of extra field definitions this type's application
                                        // form asks for, beyond the fixed baseline (name/email/phone/proof) —
                                        // see the worked example below
  isActive          Boolean  @default(true)   // ops can retire a type without deleting history (referenced by existing Ambassador rows)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  orgAccess         OrganizationAmbassadorTypeAccess[]
}

model OrganizationAmbassadorTypeAccess {
  id             String   @id @default(ulid())
  organizationId String              // main app's Organization.id — no FK, cross-database, same as flag overrides
  ambassadorTypeId String
  isEnabled      Boolean  @default(false)
  reason         String?             // optional here (unlike flag overrides) — this is a lower-stakes toggle
  updatedById    String?             // ops Admin.id
  updatedAt      DateTime @updatedAt

  ambassadorType AmbassadorType @relation(fields: [ambassadorTypeId], references: [id])

  @@unique([organizationId, ambassadorTypeId])
}
```

`applicationFields` worked example for the `student` type — the shape the ops form-builder (§1.2) writes
and the applicant-facing form (§3.1) reads to render itself:

```json
[
  { "key": "college",         "label": "College / Institution",     "type": "TEXT",   "required": true },
  { "key": "department",      "label": "Department",                "type": "TEXT",   "required": true },
  { "key": "studentId",       "label": "Student ID / Roll Number",   "type": "TEXT",   "required": false },
  { "key": "graduationYear",  "label": "Expected Graduation Year",   "type": "SELECT", "required": true, "options": ["2026", "2027", "2028"] }
]
```

Field `type` is a small closed set the renderer understands generically (`TEXT`, `EMAIL`, `PHONE`,
`NUMBER`, `SELECT`, `DATE`) — enough to cover every field the pilot brief and any reasonable variant
(Faculty, a future Industry/Corporate type) would need, without needing arbitrary custom widgets. `key`
becomes the property name under which the answer is stored on `Ambassador.applicationData` (§0.4).

**No seed script, for the initial types or any future one.** The three starting types
(`general`/`student`/`faculty`) are created through the exact same ops UI form described in §1.2, at
first setup — there's no migration-time seed data anywhere in this design, on purpose, since the whole
point raised this pass is that adding a type (and defining what it asks for) should never require a
deploy. Every create/update/toggle mirrors into two new, deliberately minimal main-app tables, exactly
paralleling how `feature-flags.repository.ts` mirrors flags:

```prisma
// Quizbuzz-new/backend/prisma/schema.prisma — main app's own database
model PlatformAmbassadorType {
  key               String   @id      // matches AmbassadorType.key in ops's DB
  label             String
  proofFieldLabel   String
  applicationFields Json
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

Needs one small addition to the cross-database grant, e.g.
`quizbuzz-ops-next/prisma/grants/002_quizbuzz_ops_ambassador_types.sql`, granting INSERT/UPDATE on these
two tables to `quizbuzz_ops_reader` — the same shape of change payouts and the flag mirror already
required, nothing novel about the mechanism itself. Main app reads through a small new
`common/ambassador-types.ts`, structurally identical to `common/feature-flags.ts` (local read + TTL
cache, fails closed to an empty list — an org with no readable type data simply can't apply as any type,
never crashes).

### 0.4 Main-app schema additions

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

// Ambassador is its own identity — not a Contact. Contacts are contest leads/participants;
// an Ambassador logs into their own dashboard repeatedly over weeks, which is a different
// relationship to the platform (closer to Admin than to Contact).
model Ambassador {
  id                String            @id @default(ulid())
  organizationId    String
  email             String
  phone             String?
  firstName         String
  lastName          String?
  // References PlatformAmbassadorType.key (§0.3) — validated at application time against
  // the org's currently-enabled types, not a DB-level FK (main app's copy is a read-only
  // mirror, not meant to carry referential integrity back to ops).
  ambassadorType    String
  // Answers to that type's applicationFields schema (§0.3), keyed by field.key — e.g.
  // {"college": "...", "department": "...", "graduationYear": "2027"}. Deliberately not
  // fixed columns: a Student's fields and a future Industry/Corporate type's fields are
  // different shapes, and the whole point of §0.3 is that a new type's fields shouldn't
  // require a migration.
  applicationData   Json              @default("{}")
  status            AmbassadorStatus  @default(PENDING)
  proofStorageKey   String            // proof document upload — what it's called is per-type (AmbassadorType.proofFieldLabel, §0.3), via the existing FileStorageProvider
  proofUrl          String
  appliedAt         DateTime          @default(now())
  reviewedAt        DateTime?
  reviewedById      String?           // Admin.id
  rejectionReason   String?
  isActive          Boolean           @default(true)  // for SUSPENDED, distinct from REJECTED
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  organization      Organization           @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  enrollments        AmbassadorCampaignEnrollment[]

  @@unique([organizationId, email])
  @@index([organizationId, status])
  @@map("ambassadors")
}

model AmbassadorCampaign {
  id                    String                    @id @default(ulid())
  organizationId        String
  contestId             String
  name                  String
  ambassadorTypesAllowed String[]                 // subset of the org's currently-enabled types
  rewardConfig          Json                       // see §2.3 — milestone tiers, speed bonus, leaderboard prizes, all configurable
  sourceCampaignId       String?                   // "duplicated from" lineage, nullable
  status                AmbassadorCampaignStatus  @default(ACTIVE)
  createdById           String                     // Admin.id
  createdAt             DateTime                  @default(now())
  updatedAt             DateTime                  @updatedAt

  organization          Organization              @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  contest                Contest                   @relation(fields: [contestId], references: [id], onDelete: Cascade)
  enrollments            AmbassadorCampaignEnrollment[]

  @@unique([contestId])   // one active campaign per contest keeps this simple — see §2.1 note
  @@index([organizationId, status])
  @@map("ambassador_campaigns")
}

// The actual per-ambassador-per-contest referral code (already-settled decision — one
// code per ambassador per contest, not one stable code reused everywhere).
model AmbassadorCampaignEnrollment {
  id              String     @id @default(ulid())
  campaignId      String
  ambassadorId    String
  referralCode    String     @unique   // e.g. QB-AMB-7F3K2 — short, URL-safe
  createdAt       DateTime   @default(now())

  campaign        AmbassadorCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  ambassador      Ambassador         @relation(fields: [ambassadorId], references: [id], onDelete: Cascade)
  referrals       Participant[]      @relation("ReferredBy")

  @@unique([campaignId, ambassadorId])   // one enrollment per ambassador per campaign
  @@index([referralCode])
  @@map("ambassador_campaign_enrollments")
}
```

Add to `Participant` (additive, nothing existing touched):

```prisma
model Participant {
  // ...existing fields...
  referredByEnrollmentId String?
  referredByEnrollment   AmbassadorCampaignEnrollment? @relation("ReferredBy", fields: [referredByEnrollmentId], references: [id])

  @@index([referredByEnrollmentId])
}
```

No reward/ledger table in this pass — an ambassador's accrued reward is *computed* from
`COUNT(Participant WHERE referredByEnrollmentId = X)` against `AmbassadorCampaign.rewardConfig`'s tier
table, on read. At pilot scale (the brief's own numbers: 5,000 registrations, 50 ambassadors) this is a
cheap aggregate query, not something that needs pre-materializing. Worth revisiting only if this becomes
a platform-wide feature with campaigns running into the tens of thousands of referrals each.

### 0.5 Referral capture — confirmed as a small addition, not a rework

Already agreed this doesn't need new architecture: `?ref=CODE` on the registration link →
`ContestService.registerParticipant` (`contest.service.ts:446`) resolves `CODE` against
`AmbassadorCampaignEnrollment.referralCode` scoped to that contest's active campaign, and stamps
`referredByEnrollmentId` onto the `Participant` row it already creates. If the code doesn't resolve
(typo, expired campaign, contest has no active campaign) registration proceeds unattributed — never
blocks registration. No change to the payment/resume-or-fresh flow just built — attribution rides on the
same `Participant` row that flow already manages correctly. Full step-by-step in §5.

### 0.6 Module layout

Two new backend modules, following the exact convention every existing module already uses
(`contact/`, `participant/`, `payment/`: `.routes.ts .controller.ts .service.ts .repository.ts .types.ts .validator.ts`):

- `backend/src/modules/ambassador/` — identity, auth, application, the ambassador's own dashboard data
  (referral stats, leaderboard position, reward status).
- `backend/src/modules/ambassador-campaign/` — org-admin campaign CRUD, reward config, applications
  review queue, org-side reporting. Kept separate from `ambassador/` the same way `quiz-registration` is
  kept separate from `quiz` — two audiences (ambassador vs. org admin) hitting the same underlying data
  through different trust boundaries shouldn't share one file set.

New auth middleware, `backend/src/middlewares/authenticated-ambassador.middleware.ts`, structurally
identical to `authenticated-participant.middleware.ts:1-46` (cookie → bearer → header fallback, JWT
verify, attaches `req.ambassador = { id, organizationId }`).

**Login mechanism — recommend OTP, not password.** Reuses the exact machinery
`quiz-registration.service.ts` already has (Redis-backed OTP, rate limiting, `EmailProvider.send`) almost
unchanged — issue an `ambassadorToken` instead of a `contactToken` on verify. This is far less new
infrastructure than a full password + bcrypt + refresh-token system (`Admin`'s pattern), and skips
building password-reset flows entirely. Trade-off: ambassadors re-verify by email each session rather
than staying logged in with a password — reasonable for a dashboard checked every few days, not
constantly. Flag if you'd rather match `Admin`'s persistent-session pattern instead; either is a small
change relative to everything else here.

**Notification delivery — resolved this pass.** `MessagingService.enqueueMessage` is keyed off
`participantId`/`contestId`, neither of which an `Ambassador` has — extending its queue contract just for
three low-volume, one-off emails (application submitted / approved / rejected) isn't worth it at pilot
scale (tens of ambassadors, not thousands). Instead, `ambassador.service.ts` calls `EmailProvider.send`
directly, the same shortcut `quiz-registration.service.ts` already takes for OTP emails — no queue, no
new infrastructure. Revisit only if this becomes a platform-wide feature with ambassador volume large
enough that synchronous send-on-request-thread becomes a real latency concern.

---

## 1. Part 1 — Operational Dashboard (`quizbuzz-ops-next`)

### 1.1 Ambassador Program toggle, per org

Nothing to build beyond §0.2's one registry entry. Ops manages this from the existing
`app/dashboard/flags` screen (`FeatureFlagsView.tsx`), same as every other flag — global default
(leave OFF), per-org overrides with a required reason, audit trail, all of it already working. No new
route, no new component, no new ops-side table.

### 1.2 Ambassador Type catalog management — this is the control the last round of questions was about

New ops-only screen, `app/dashboard/ambassador-types/page.tsx`. This is where both halves of "creating a
type" happen — there's no other place in the system either one can happen from:

- **The type itself**: key, label, description, `proofFieldLabel` (what the required proof upload is
  called for this type), active/retired — a plain create/edit form over `AmbassadorType`.
- **What it asks an applicant for**: a small repeating-row field builder under the same form — add a
  field, give it a key + label + type (`TEXT`/`EMAIL`/`PHONE`/`NUMBER`/`SELECT`/`DATE`), mark it
  required or not, and for `SELECT` fields, list the options. This writes `AmbassadorType.applicationFields`
  (§0.3) directly — it's a small structured editor over that JSON array, not a raw JSON textbox, but there's
  no code path involved: creating "Industry Ambassador" with a "Company Name" text field and a
  "Designation" text field is the same button click as it was for Student's college/department, no deploy,
  no seed script.

Plus — reusing the exact `OrgOverridesPanel` interaction pattern from `FeatureFlagsView.tsx` (§0.2, point
4) even though it's against a different table — a per-type "which orgs have this enabled" expander backed
by `OrganizationAmbassadorTypeAccess`. This is the piece that stops every org from inventing their own
differently-named version of the same role: ops curates the taxonomy once (including what it collects),
orgs only pick from what's offered.

Backend: `quizbuzz-ops-next/server/features/ambassador-types/` — `.service.ts` / `.repository.ts` /
`.types.ts`, same shape as `server/features/feature-flags/`. Every mutation follows that module's exact
sequence: write to ops's own DB first, write an audit log entry via `writeAuditLogEntry`, then
fire-and-forget mirror into the main app's `platform_ambassador_types` /
`organization_ambassador_type_access` tables via `queryMainDb` (§0.3).

---

## 2. Part 2 — Ambassador Management in the Main App (org-admin side)

Everything in this part only renders/works once `await isFeatureEnabled("ambassador_program_enabled", { organizationId })` resolves `true` (§0.2) — the org-admin dashboard gets a new "Ambassadors" nav item
that's simply absent otherwise.

### 2.1 Applications queue

List of `Ambassador` rows with `status: PENDING` for the org, showing name, contact, requested
`ambassadorType` (only ever one of the org's currently-enabled types per `common/ambassador-types.ts`,
§0.3 — validated server-side on application submit, not just client-side), that type's
`applicationData` answers rendered by looping over the same type's `applicationFields` schema to get
the labels (so a Student row shows "College: ..., Department: ...", a future Industry row would show
"Company Name: ..., Designation: ..." — the review screen never hardcodes which fields exist), and the
proof document under its per-type label (`AmbassadorType.proofFieldLabel`, rendered via
`FileStorageProvider.getPresignedGetUrl`, the same pattern already used for certificate/proctoring
evidence). Approve / deny actions, deny requires a reason (stored on `rejectionReason`, shown back to the
applicant). Full request/response sequence for this in §4.

### 2.2 Campaign management

Create a campaign: pick a contest (from the org's own contests), name it, choose which of the org's
enabled ambassador types can participate, and build the reward-tier config (§2.3). One active campaign
per contest is the modeled default (`@@unique([contestId])` in §0.4) — matches "scoped per contest"
without allowing two competing campaigns to run against the same contest simultaneously, which would
make attribution and leaderboards ambiguous. If running genuinely parallel campaigns per contest turns
out to be a real need later, that unique constraint is the one thing to revisit.

Confirming the point raised this pass: **a campaign's reward structure is not per-type.** One campaign =
one `rewardConfig`, shared by every ambassador type listed in `ambassadorTypesAllowed` — a General and a
Student ambassador enrolled in the same campaign see and earn against the exact same tier table. Type is
purely an eligibility gate on who can join, never a second axis on what they earn. This matches how the
pilot brief itself works (one reward structure, applied uniformly across all 50 department ambassadors).

**Duplicate** a prior campaign: copies `rewardConfig` and `ambassadorTypesAllowed` into a new campaign
tied to a different contest, `sourceCampaignId` pointing back to the original — fully editable from
there, never a locked copy.

### 2.3 Reward config — configurable, not hardcoded, worked example from the brief

`AmbassadorCampaign.rewardConfig` is a JSON blob whose *shape* the app understands generically — the
actual numbers are never in code. The pilot brief (confirmed against both the original `.md` and the
re-uploaded `.docx` — identical content) actually describes **three** reward mechanisms, not two: per-
registration milestone tiers, a speed bonus, and four separate leaderboard cuts each with their own
top-N prizes (including non-cash "goodies" — vouchers, earbuds, trophies). The shape below expresses all
three, since §2.2's "one campaign, shown to every type for motivation" framing means the campaign needs
to carry the *complete* incentive picture, not just the milestone piece originally modeled:

```json
{
  "currency": "INR",
  "amountsInPaise": true,

  "milestoneTiers": [
    { "minRegistrations": 1,   "maxRegistrations": 40,  "rewardType": "PER_REGISTRATION", "amountPerRegistration": 1500 },
    { "minRegistrations": 41,  "maxRegistrations": 70,  "rewardType": "FLAT_PLUS_PER_REG", "amountPerRegistration": 1500, "goodie": { "label": "Gift Voucher", "cashEquivalent": 80000 } },
    { "minRegistrations": 71,  "maxRegistrations": 100, "rewardType": "FLAT_PLUS_PER_REG", "amountPerRegistration": 1800, "goodie": { "label": "Bluetooth Earbuds", "cashEquivalent": 150000 } },
    { "minRegistrations": 101, "maxRegistrations": null, "rewardType": "PER_REGISTRATION", "amountPerRegistration": 2000 }
  ],

  "speedBonus": {
    "enabled": true,
    "campaignStartAt": "2026-08-10T00:00:00Z",
    "milestoneThreshold": 100,
    "tiers": [
      { "withinDays": 7,  "bonusAmount": 50000, "label": "Fast Starter" },
      { "withinDays": 14, "bonusAmount": 30000, "label": "Early Finisher" },
      { "withinDays": 28, "bonusAmount": 15000, "label": "On Track" }
    ]
  },

  "leaderboardPrizes": [
    {
      "scope": "INDIVIDUAL_AMBASSADOR",
      "label": "Top Individual Ambassadors",
      "ranks": [
        { "rank": 1, "cashAmount": 200000, "goodie": { "label": "Free Premium Internship" } },
        { "rank": 2, "cashAmount": 150000 },
        { "rank": 3, "cashAmount": 100000 }
      ]
    },
    {
      "scope": "DEPARTMENT",
      "label": "Overall Department Leaderboard",
      "rankedBy": "REGISTRATION_RATE_PERCENT",
      "ranks": [
        { "rank": 1, "goodie": { "label": "Bluetooth Speaker", "cashEquivalent": 300000 } },
        { "rank": 2, "goodie": { "label": "Gift Hamper", "cashEquivalent": 200000 } },
        { "rank": 3, "goodie": { "label": "Gift Voucher", "cashEquivalent": 100000 } }
      ]
    },
    {
      "scope": "INTER_COLLEGE_DEPARTMENT",
      "label": "Top Department per College (Top 3 Colleges)",
      "winnerCount": 3,
      "ranks": [
        { "rank": 1, "cashAmount": 800000, "goodie": { "label": "Trophy" } },
        { "rank": 2, "cashAmount": 500000, "goodie": { "label": "Trophy" } },
        { "rank": 3, "cashAmount": 300000, "goodie": { "label": "Trophy" } }
      ]
    },
    {
      "scope": "COLLEGE",
      "label": "College Leaderboard",
      "rankedBy": "REGISTRATION_RATE_PERCENT",
      "ranks": [
        { "rank": 1, "cashAmount": 1500000, "goodie": { "label": "Trophy" } },
        { "rank": 2, "cashAmount": 1000000, "goodie": { "label": "Trophy" } },
        { "rank": 3, "cashAmount": 500000, "goodie": { "label": "Trophy" } },
        { "rankRange": [4, 10], "cashAmount": 100000, "label": "Rank 4–10" }
      ],
      "consolation": { "label": "College Topper (per college, excluding Top 10)", "cashAmount": 50000 }
    }
  ]
}
```

(Amounts in paise, matching how `Payment.amount`/`PaymentConfig.amount` are already stored elsewhere in
this schema. `cashEquivalent` on a `goodie` is display-only — used to show ambassadors "worth ₹X" next to
a non-cash prize, never actually paid out as cash unless the config also sets a sibling `cashAmount`.)
The org-admin campaign form renders this as editable tier tables per section (milestones / speed bonus /
each leaderboard cut), not a raw JSON editor — the JSON shape is an implementation detail, not something
an org admin hand-writes. The Quiz Winner Prize Pool (the brief's §5) is deliberately **not** part of
this config — that pool rewards quiz *performance*, not referral activity, and stays wherever contest
prize/certificate config already lives; it's a different axis from everything ambassador-related here.

### 2.4 Reporting

Per-campaign view: every enrolled ambassador, their live registration count (`COUNT(Participant WHERE referredByEnrollmentId = enrollment.id)`), current milestone tier reached, computed accrued reward, and
department/college rollups — the four leaderboard cuts in §2.3 are the same underlying aggregate grouped
differently, not four separate systems. An "amount owed" export per ambassador, feeding the same
manual-disbursement process the payout rollback work already established — no automated payout wiring
here, on purpose.

---

## 3. Part 3 — The Ambassador's Own Dashboard

This is the part with a real user waiting on it, so it's split into the full lifecycle: apply → wait →
work → get paid (manually, per above). §4 and §5 below walk through the same lifecycle as live
request/response sequences, if you want the concrete version instead of the summary here.

### 3.1 Application

Public page, reached via the org's own ambassador-program link (not discoverable if the org isn't
enabled — §0.2). Form: a fixed baseline (name, email, phone) plus a single-select for ambassador type —
options populated from `common/ambassador-types.ts`'s per-org read (§0.3), nothing hardcoded — and once a
type is picked, the form renders that type's `applicationFields` schema (§0.3) as additional inputs
(college/department for Student, for example), plus a proof upload labeled with that type's
`proofFieldLabel` ("College ID Card" for Student, "Employee ID Card" for Faculty, etc.). The whole
type-specific section re-renders when the applicant changes the type dropdown — nothing about which
extra fields appear is hardcoded in the frontend. Proof upload itself goes through
`FileStorageProvider.upload`, same provider already used for certificate/proctoring files, new folder
convention e.g. `ambassador-proof/{organizationSlug}/{ambassadorId}` matching the existing
`proctoring/{contestSlug}/{participantSlug}` folder-validation pattern in `s3.provider.ts:7-11` (extend
`validateFolder` for the new prefix rather than bypassing it).

Submits to `PENDING`. Confirmation email — direct send via `EmailProvider`, not queued (§0.6).

### 3.2 Waiting / rejected states

Simple status page reachable via the OTP-login flow (§0.6): `PENDING` shows "still under review,"
`REJECTED` shows the org's stated reason if one was given, `SUSPENDED` (a later admin action, not part
of the application flow) shows a neutral "contact the organization" message — never exposes internal
detail.

### 3.3 Approved — the actual working dashboard

Once `APPROVED`, the ambassador browses and self-joins campaigns (§4 covers exactly how). For each
campaign they're enrolled in:

- **Per-campaign card**: their `referralCode`, the full shareable link
  (`{frontendUrl}/contests/{slug}/register?ref={code}`), copy-to-clipboard, and the ready-made share
  assets the brief calls for (§6.3 of the pilot brief) — pre-written WhatsApp/Instagram templates and a
  shareable poster/flyer. These are static content per campaign (org admin uploads/writes them once when
  creating the campaign), not generated per ambassador. Full detail in §5.
- **Live progress**: current registration count for that campaign, which milestone tier they're
  currently in and what's needed to reach the next one, computed directly from §2.3's tier table against
  their live count — no separate "your progress" model, just the same aggregate query rendered from the
  ambassador's own side.
- **Speed bonus status**, if the campaign has one enabled: days remaining in each bonus window, whether
  they've already qualified.
- **Leaderboards**: their rank on each of the four cuts from §2.3 that the campaign has enabled —
  individual (within their ambassador type), department, inter-college department, college. Computed the
  same aggregate-and-cache approach as the org-admin reporting view (§2.4), not a duplicate system.
- **Reward summary**: accrued amount so far, broken down by milestone + speed bonus + any leaderboard
  standing, status labeled "Earned — pending disbursement," consistent with the manual-payout direction.
  No in-app payout action anywhere on this page.
- **Available campaigns**: any *other* active campaign whose `ambassadorTypesAllowed` includes their type
  that they haven't joined yet (e.g. a second contest the org is running) — a "Join" button, one click,
  no re-application needed (§4 covers why re-application isn't required here).

### 3.4 What this dashboard deliberately does not do

No participant-to-participant referral loop (explicitly descoped). No self-service "create a new
ambassador type" — that's ops-only (§1.2). No in-app payout initiation — cash/reward disbursement stays
manual, tracked via §2.4's export, same posture as the org payout rollback already implemented.

---

## 4. Live Data Flow — Ambassador Application → Verification → Approval

Concrete walkthrough of the same lifecycle §3.1–3.3 describe structurally, as an actual request sequence.

1. **Applicant lands on the application page.** `GET /ambassador/apply/{orgSlug}` (public, no auth) — the
   page first checks `isFeatureEnabled("ambassador_program_enabled", {organizationId})` server-side; if
   `false`, returns a plain 404 (no "this feature isn't available" message — indistinguishable from a
   route that never existed, per §0.2). If `true`, it calls a public
   `GET /api/v1/public/ambassador-types?organizationId=...` which reads `common/ambassador-types.ts`
   (§0.3) and returns the *full* definition of each type the org currently has enabled, not just names —
   `[{ key: "student", label: "Student Ambassador", proofFieldLabel: "College ID Card", applicationFields: [...] }, { key: "general", ... }]`. The type dropdown is built from the `label`s; nothing about which
   types exist or what they ask for is hardcoded in the frontend.
2. **Applicant picks a type, the form grows to match, then uploads proof.** Name, email, phone are always
   present. Choosing a type from the dropdown built in step 1 renders that type's `applicationFields`
   (college/department for Student, for example) and labels the proof upload with its `proofFieldLabel`.
   The proof file itself goes through `FileStorageProvider.upload` into
   `ambassador-proof/{organizationSlug}/{tempId}/...` first, returning a `proofStorageKey` + `proofUrl`,
   the same two-step upload-then-submit pattern already used for proctoring evidence.
3. **Submit.** `POST /api/v1/public/ambassador/apply` with `{organizationId, firstName, lastName, email, phone, ambassadorType, applicationData: {...the type-specific answers, keyed by field.key...}, proofStorageKey, proofUrl}`. Server re-validates `ambassadorType` against the same org-scoped
   enabled-types list from step 1 (never trusts the client value blindly), re-validates `applicationData`
   against that type's `applicationFields` schema (every `required` field present, `SELECT` values within
   `options`), and checks `@@unique([organizationId, email])` — a second application from the same email
   for the same org is rejected with a clear "you've already applied" message rather than a raw constraint
   error, same posture as the existing participant registration flow's duplicate handling. Creates the
   `Ambassador` row, `status: PENDING`.
4. **Applicant gets a confirmation email**, sent directly via `EmailProvider` (§0.6) — "Your application
   to become a [Student] Ambassador for [Org Name] has been received and is under review." No dashboard
   access yet; `status: PENDING` blocks login past the waiting page (§3.2).
5. **Org admin sees it immediately.** The Applications queue (§2.1) is a live `GET /api/v1/org/ambassadors?status=PENDING` list — no polling delay beyond normal page load, this isn't
   queued or batched. Each row shows the applicant's details plus a presigned view link to their proof
   document (`FileStorageProvider.getPresignedGetUrl`, generated on-demand per row, short-lived).
6. **Org admin approves or denies.** `POST /api/v1/org/ambassadors/{id}/approve` or `/reject` (with a
   required `reason` on reject). On approve: `status → APPROVED`, `reviewedAt`/`reviewedById` set. On
   reject: `status → REJECTED`, `rejectionReason` stored.
7. **Applicant gets the outcome by email**, again a direct send:
   - Approved: "Congratulations — you're approved as a [Student] Ambassador for [Org Name]. [Link to your
     dashboard]" — the link takes them into the OTP-login flow (§0.6); once verified, they land on §3.3's
     dashboard, initially showing zero active campaigns and a prompt to browse "Available Campaigns."
   - Rejected: "Your application wasn't approved. Reason: [rejectionReason]." No dashboard access; hitting
     the login flow shows the rejected-state page (§3.2) with the same reason.
8. **No auto-enrollment into a campaign at approval time.** Approval only grants *identity* — it doesn't
   assume which contest they're promoting. The ambassador picks from currently-active campaigns matching
   their type on their own dashboard (§3.3's "Available campaigns" list, self-serve "Join" — this is the
   moment `AmbassadorCampaignEnrollment` gets created and `referralCode` generated, covered next in §5).
   This also means one approval covers every future campaign they're eligible for — no re-applying per
   contest.

## 5. Live Data Flow — Campaign Promotion & Referral Monitoring During Registration

Concrete walkthrough of what an approved ambassador actually does day-to-day, and how the numbers on
their dashboard get there.

1. **Joining a campaign.** From "Available campaigns" (§3.3), the ambassador clicks Join on a campaign
   whose `ambassadorTypesAllowed` includes their type. `POST /api/v1/ambassador/campaigns/{campaignId}/join`
   creates the `AmbassadorCampaignEnrollment` row and generates a short, URL-safe `referralCode` (e.g.
   `QB-AMB-7F3K2`) — unique per `(campaignId, ambassadorId)`, so the same person joining a second campaign
   later gets a second, independent code, never reusing one across contests (already-settled decision).
2. **What the ambassador has to share**, all rendered from that one enrollment row plus the campaign's
   static assets (set once by the org admin when creating the campaign, §2.2):
   - The referral link itself: `{frontendUrl}/contests/{contestSlug}/register?ref=QB-AMB-7F3K2`, with a
     copy-to-clipboard button.
   - Pre-written share text (WhatsApp/Instagram story templates) and a poster/flyer image URL, both
     stored as plain fields on `AmbassadorCampaign` (org admin writes them once, every enrolled ambassador
     in that campaign sees the same assets, with `{referralLink}` templated in at render time).
3. **A prospective participant clicks the link.** They land on the normal contest registration page —
   nothing about the registration UI itself changes. The `ref` query param is read client-side once on
   page load and carried through the existing flow: stored alongside the in-progress registration form
   state, survives the OTP-verification step, and gets sent as part of the final `POST .../register` payload the existing flow already makes.
4. **Attribution happens inside the existing registration call, not a separate step.**
   `ContestService.registerParticipant` (`contest.service.ts:446`, §0.5) — after its existing logic
   resolves the participant, it additionally looks up `ref` against
   `AmbassadorCampaignEnrollment.referralCode` scoped to that contest's one active campaign
   (`@@unique([contestId])`), and if it resolves, stamps `referredByEnrollmentId` onto the `Participant`
   row being created (or reused — this rides on the exact same row the resume-or-fresh flow already
   manages, no interaction with that logic beyond one extra field being set). If `ref` is missing,
   unrecognized, or the contest has no active campaign, registration proceeds exactly as it does today —
   attribution is additive and never blocks or alters the payment/registration path itself.
5. **The ambassador watches it happen live**, not on a delay. Their dashboard's "Live progress" panel
   (§3.3) is a direct `COUNT(Participant WHERE referredByEnrollmentId = enrollment.id)` against their own
   enrollment, run on page load/refresh — no batching, no overnight job, no separate analytics pipeline.
   As soon as a registration attributed to their code completes, the count reflects it the next time they
   load or refresh the dashboard. The same query, grouped by department/college instead of by individual
   enrollment, is what feeds the leaderboard cuts (§2.3/§2.4) — one aggregate, several groupings, exactly
   as already noted in §2.4.
6. **Milestone/speed-bonus/leaderboard status are all derived, not stored.** Every number the ambassador
   sees — current tier, progress to next tier, whether a speed-bonus window is still open, current
   leaderboard rank — is computed at read time from that live count against `AmbassadorCampaign.rewardConfig`
   (§2.3). Nothing about "what they've earned" is written anywhere until an org admin actually reads the
   §2.4 export to process a manual payout — consistent with "no reward/ledger table in this pass" (§0.4).

---

## 6. Build order

1. §0.4 schema migration (main app) — additive only, nothing existing touched. Include the two mirror
   tables from §0.3 (`PlatformAmbassadorType`, `OrganizationAmbassadorTypeAccess`) in this same pass.
2. §0.2's one registry entry (`ambassador_program_enabled`) — trivial, unlocks testing the "org isn't
   enabled" 404 path immediately with zero other code written yet.
3. §1.2 ops-side Ambassador Type catalog (table + service + UI) + its main-app mirror write-through
   (§0.3) — can be built and tested independently of everything else, since it's just writing rows into
   ops's own database and mirroring them. Confirm the mirror actually lands in the main app's tables
   before moving on, same integration-point caution as the original plan flagged for `planLimitsCache`.
4. §2.1/§2.2/§2.3 org-admin side (applications, campaigns, reward config) — no ambassador-facing surface
   needed yet to build and test this against seeded data.
5. §0.5 referral capture on `registerParticipant` — additive, verify it doesn't change behavior when no
   `ref` param is present (existing registration flow, including the resume-or-fresh logic, must be
   completely unaffected).
6. §3.1–3.3 ambassador-facing application + dashboard + campaign self-join, including the new auth
   middleware and the direct-send notification emails (§0.6).
7. §2.4 reporting / leaderboard aggregates — natural to build alongside 3.3 since both read the same
   queries, just rendered for different audiences.

## 7. Open items to confirm before/while building

- **Login mechanism** (§0.6): OTP-based (recommended, less new infrastructure) vs. password-based
  (matches `Admin`'s pattern, persistent sessions). Pick one before building the ambassador auth
  middleware — switching later means migrating every existing ambassador's login method.
- **One campaign per contest** (§2.2's `@@unique([contestId])`): flagged as the simplifying default:
  confirm it holds before building, since relaxing it later means a schema change plus deciding how
  competing campaigns on one contest would split attribution.
- **Quiz Winner Prize Pool** (brief §5, explicitly excluded from `rewardConfig` in §2.3): confirm where
  this should actually live — it's a contest-level prize structure keyed to quiz *performance*, arguably
  belongs alongside whatever certificate/results config already exists on `Contest`, not inside the
  ambassador module at all. Out of scope for this document either way; flagging so it isn't lost.
