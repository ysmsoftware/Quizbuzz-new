# Ambassador / Incentive Program — Implementation Plan

Plan only, no code changed yet. Grounded in `Quizbuzz-new/backend/src/{modules,middlewares,providers,workers,config}`
and `quizbuzz-ops-next/server/{features,db}` (read 2026-08-02), and in the reward mechanics from
`QuizBuzz_Incentive_Program.md` (the YSM pilot brief). Reflects every decision made across the prior
discussion — recapped inline where it affects a design choice, not repeated in full.

## 0. Foundations (shared by all three parts below)

### 0.1 Where the data lives

Everything about an ambassador's identity, applications, campaigns, referral attribution, and rewards
lives in the **main app's database** (`Quizbuzz-new/backend/prisma/schema.prisma`), alongside
`Organization`/`Contest`/`Contact`/`Participant`. It has to — the main app's own request path (contest
registration, the org-admin dashboard, the ambassador's own dashboard) needs to read and write this data
directly, the same reason `OrganizationPayoutAccount` lives there instead of in `quizbuzz-ops-next`'s
own database.

What lives in **`quizbuzz-ops-next`'s own database** instead: the `AmbassadorType` catalog (General /
Student / Faculty, ops-curated) and which types are enabled for which org. Ops never needs low-latency
access to campaign/referral data, and the main app never needs to manage the type catalog — so unlike
payouts (which needed a new grants file entry so ops could read/write the main app's tables directly),
this reuses a mechanism that's *already wired end-to-end*: see §0.2.

### 0.2 How the ops toggle actually reaches the main app

`quizbuzz-ops-next`'s `entitlements.service.ts` already computes a `features: { proctoring, certBranding,
prioritySupport, analyticsExport, customDomain }` object per org (plan defaults + per-org overrides) and
writes it into `Organization.planLimitsCache` (a JSON column in the **main app's** database) — see
`entitlements.repository.ts:39`. The main app reads that cache to decide what an org is allowed to do.
This is precisely "ops flips something, org's app behavior changes, no new plumbing" — so extend it
rather than building a parallel mechanism:

```ts
features: {
  proctoring: ...,
  certBranding: ...,
  // ...existing...
  ambassadorProgram: boolean,       // NEW — is the feature on at all for this org
  ambassadorTypes: string[],        // NEW — which type names are currently enabled, e.g. ["STUDENT","GENERAL"]
}
```

`ambassadorProgram` and `ambassadorTypes` are computed the same way the existing five are — from ops's
own tables (§1.1/§1.2, new, living in `quizbuzz-ops-next`'s schema, **not** the `Plan`/`SubscriptionOverride`
system, since this isn't a paid-tier upsell like proctoring — it's a curated rollout switch, independent
of billing plan). `syncOrgPlanLimitsCache(orgId)` gets called right after an ops toggle changes, same as
it's presumably already called after a plan/override change, so the main app's cache reflects it promptly.

The main app checks `organization.planLimitsCache.features.ambassadorProgram` before rendering the
"Ambassador Program" nav item in the org dashboard and before allowing any `/ambassador-program/*`
admin API route to do anything — an org that isn't enabled gets a 404-shaped response, not a 403, so
there's no signal the feature exists at all (matches "no indication or signal" from the original ask).

### 0.3 Main-app schema additions

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
  college           String?
  department        String?
  // Plain string, not a foreign key — AmbassadorType is defined in ops's separate database
  // (§0.1), cross-database FKs aren't possible. Validated at application time against
  // organization.planLimitsCache.features.ambassadorTypes, not enforced at the DB level.
  ambassadorType    String
  status            AmbassadorStatus  @default(PENDING)
  proofStorageKey   String            // ID card / enrollment proof, via the existing FileStorageProvider
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
  rewardConfig          Json                       // see §2.3 — milestone tiers, speed bonus, all configurable
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

### 0.4 Referral capture — confirmed as a small addition, not a rework

Already agreed this doesn't need new architecture: `?ref=CODE` on the registration link →
`ContestService.registerParticipant` (`contest.service.ts:446`) resolves `CODE` against
`AmbassadorCampaignEnrollment.referralCode` scoped to that contest's active campaign, and stamps
`referredByEnrollmentId` onto the `Participant` row it already creates. If the code doesn't resolve
(typo, expired campaign, contest has no active campaign) registration proceeds unattributed — never
blocks registration. No change to the payment/resume-or-fresh flow just built — attribution rides on the
same `Participant` row that flow already manages correctly.

### 0.5 Module layout

Two new backend modules, following the exact convention every existing module already uses
(`contact/`, `participant/`, `payment/`: `.routes.ts .controller.ts .service.ts .repository.ts .types.ts
.validator.ts`):

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

---

## 1. Part 1 — Operational Dashboard (`quizbuzz-ops-next`)

### 1.1 Ambassador Program toggle, per org

New tables in `quizbuzz-ops-next/prisma/schema.prisma` (ops's own database, normal migration, no grants
file changes needed — these are ops-internal management tables):

```prisma
model AmbassadorType {
  id          String   @id @default(ulid())
  name        String   @unique   // "General", "Student", "Faculty"
  description String?
  isActive    Boolean  @default(true)   // ops can retire a type without deleting history
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  orgAccess   OrganizationAmbassadorTypeAccess[]
}

model OrganizationAmbassadorAccess {
  id             String   @id @default(ulid())
  organizationId String   @unique   // main app's Organization.id — no FK, cross-database
  enabled        Boolean  @default(false)
  enabledAt      DateTime?
  enabledById    String?             // ops Admin.id
  updatedAt      DateTime @updatedAt
}

model OrganizationAmbassadorTypeAccess {
  id               String   @id @default(ulid())
  organizationId   String              // no FK, cross-database, same as above
  ambassadorTypeId String
  enabled          Boolean  @default(false)

  ambassadorType   AmbassadorType @relation(fields: [ambassadorTypeId], references: [id])

  @@unique([organizationId, ambassadorTypeId])
}
```

Seed data (migration or seed script): three `AmbassadorType` rows — `General`, `Student`, `Faculty` —
matching the confirmed starting set.

**UI:** extend `app/dashboard/organizations/[orgId]/page.tsx` with a new "Ambassador Program" card, same
visual pattern as the existing payout-account status card on that page — a single enable/disable toggle
for `OrganizationAmbassadorAccess.enabled`, and once enabled, a checklist of the three (or however many)
`AmbassadorType` rows with a toggle each, writing to `OrganizationAmbassadorTypeAccess`. Every toggle
here fires `syncOrgPlanLimitsCache(orgId)` immediately after (§0.2), and logs through the existing
`audit-writer.ts` pattern with new event names alongside `org.payout_account_linked` —
`org.ambassador_program_enabled`, `org.ambassador_program_disabled`, `org.ambassador_type_toggled`.

### 1.2 Ambassador Type catalog management

New ops-only screen, `app/dashboard/ambassador-types/page.tsx` — a simple list + create/edit form over
`AmbassadorType` (name, description, active/retired). This is the piece that stops every org from
inventing their own differently-named version of the same role, per the reasoning already agreed on:
ops curates the taxonomy once, orgs only pick from what's offered.

Backend: `quizbuzz-ops-next/server/features/ambassador-types/` — `.service.ts` / `.repository.ts` /
`.types.ts`, same shape as `server/features/payouts/`, but entirely against ops's own Prisma client
(`server/db/ops-prisma.ts`) since this data never leaves ops's database — no `queryMainDb` calls needed
here at all, unlike payouts.

---

## 2. Part 2 — Ambassador Management in the Main App (org-admin side)

Everything in this part only renders/works once `organization.planLimitsCache.features.ambassadorProgram
=== true` (§0.2) — the org-admin dashboard gets a new "Ambassadors" nav item that's simply absent
otherwise.

### 2.1 Applications queue

List of `Ambassador` rows with `status: PENDING` for the org, showing name, contact, college,
department, requested `ambassadorType` (only ever one of `organization.planLimitsCache.features.ambassadorTypes`
— validated server-side on application submit, not just client-side), and the proof document (rendered
via `FileStorageProvider.getPresignedGetUrl`, the same pattern already used for certificate/proctoring
evidence). Approve / deny actions, deny requires a reason (stored on `rejectionReason`, shown back to
the applicant). Approval flips `status → APPROVED` and triggers the `AMBASSADOR_APPLICATION_APPROVED`
notification (§0.5's messaging note below).

### 2.2 Campaign management

Create a campaign: pick a contest (from the org's own contests), name it, choose which of the org's
enabled ambassador types can participate, and build the reward-tier config (§2.3). One active campaign
per contest is the modeled default (`@@unique([contestId])` in §0.3) — matches "scoped per contest"
without allowing two competing campaigns to run against the same contest simultaneously, which would
make attribution and leaderboards ambiguous. If running genuinely parallel campaigns per contest turns
out to be a real need later, that unique constraint is the one thing to revisit.

**Duplicate** a prior campaign: copies `rewardConfig` and `ambassadorTypesAllowed` into a new campaign
tied to a different contest, `sourceCampaignId` pointing back to the original — fully editable from
there, never a locked copy.

### 2.3 Reward config — configurable, not hardcoded, worked example from the brief

`AmbassadorCampaign.rewardConfig` is a JSON blob whose *shape* the app understands generically — the
actual numbers are never in code. Using the YSM pilot brief's own numbers as the worked example of what
this shape needs to express (not as defaults baked into the app):

```json
{
  "milestoneTiers": [
    { "minRegistrations": 1,   "maxRegistrations": 40,  "rewardType": "PER_REGISTRATION", "amountPerRegistration": 1500 },
    { "minRegistrations": 41,  "maxRegistrations": 70,  "rewardType": "FLAT_PLUS_PER_REG", "flatAmount": 80000, "flatLabel": "Gift Voucher", "amountPerRegistration": 1500 },
    { "minRegistrations": 71,  "maxRegistrations": 100, "rewardType": "FLAT_PLUS_PER_REG", "flatAmount": 150000, "flatLabel": "Bluetooth Earbuds", "amountPerRegistration": 1800 },
    { "minRegistrations": 101, "maxRegistrations": null, "rewardType": "PER_REGISTRATION", "amountPerRegistration": 2000 }
  ],
  "speedBonus": {
    "enabled": true,
    "campaignStartAt": "2026-08-10T00:00:00Z",
    "tiers": [
      { "withinDays": 7,  "bonusAmount": 50000, "label": "Fast Starter" },
      { "withinDays": 14, "bonusAmount": 30000, "label": "Early Finisher" },
      { "withinDays": 28, "bonusAmount": 15000, "label": "On Track" }
    ],
    "milestoneThreshold": 100
  },
  "currency": "INR",
  "amountsInPaise": true
}
```

(Amounts in paise, matching how `Payment.amount`/`PaymentConfig.amount` are already stored elsewhere in
this schema — consistent unit across the app.) The org-admin campaign form renders this as an editable
tier table (add/remove/edit rows), not a raw JSON editor — the JSON shape is an implementation detail,
not something an org admin hand-writes.

### 2.4 Reporting

Per-campaign view: every enrolled ambassador, their live registration count (`COUNT(Participant WHERE
referredByEnrollmentId = enrollment.id)`), current milestone tier reached, computed accrued reward, and
department/college rollups — the four leaderboard cuts the brief describes (individual ambassador,
department, inter-college department, college) are the same underlying aggregate grouped differently,
not four separate systems. An "amount owed" export per ambassador, feeding the same manual-disbursement
process the payout rollback work already established — no automated payout wiring here, on purpose.

---

## 3. Part 3 — The Ambassador's Own Dashboard

This is the part with a real user waiting on it, so it's split into the full lifecycle: apply → wait →
work → get paid (manually, per above).

### 3.1 Application

Public page, reached via the org's own ambassador-program link (not discoverable if the org isn't
enabled — §0.2). Form: name, email, phone, college, department, and a single-select for ambassador type
— options populated from `organization.planLimitsCache.features.ambassadorTypes`, nothing hardcoded.
Proof upload (ID card / enrollment doc) via `FileStorageProvider.upload`, same provider already used for
certificate/proctoring files, new folder convention e.g. `ambassador-proof/{organizationSlug}/{ambassadorId}`
matching the existing `proctoring/{contestSlug}/{participantSlug}` folder-validation pattern in
`s3.provider.ts:7-11` (extend `validateFolder` for the new prefix rather than bypassing it).

Submits to `PENDING`. Confirmation email ("we got your application, org will review it") —
`AMBASSADOR_APPLICATION_SUBMITTED`, optional but recommended so the applicant isn't left wondering.

### 3.2 Waiting / rejected states

Simple status page reachable via the OTP-login flow (§0.5): `PENDING` shows "still under review,"
`REJECTED` shows the org's stated reason if one was given, `SUSPENDED` (a later admin action, not part
of the application flow) shows a neutral "contact the organization" message — never exposes internal
detail.

### 3.3 Approved — the actual working dashboard

Once `APPROVED` and enrolled in at least one campaign:

- **Per-campaign card** for each contest they're enrolled in: their `referralCode`, the full shareable
  link (`{frontendUrl}/contests/{slug}/register?ref={code}`), copy-to-clipboard, and the ready-made
  share assets the brief calls for (§6.3 of the pilot brief) — pre-written WhatsApp/Instagram templates
  and a shareable poster/flyer. These are static content per campaign (org admin uploads/writes them
  once when creating the campaign), not generated per ambassador.
- **Live progress**: current registration count for that campaign, which milestone tier they're
  currently in and what's needed to reach the next one, computed directly from §2.3's tier table against
  their live count — no separate "your progress" model, just the same aggregate query rendered from the
  ambassador's own side.
- **Speed bonus status**, if the campaign has one enabled: days remaining in each bonus window, whether
  they've already qualified.
- **Leaderboards**: their rank on each of the four cuts from §2.4 that the campaign has enabled —
  individual (within their ambassador type), department, inter-college department, college. Computed the
  same aggregate-and-cache approach as the org-admin reporting view (§2.4), not a duplicate system.
- **Reward summary**: accrued amount so far, broken down by milestone + speed bonus, status labeled
  "Earned — pending disbursement," consistent with the manual-payout direction. No in-app payout action
  anywhere on this page.
- **Application history**: if they're enrolled in more than one campaign over time (multiple contests),
  a simple list/archive view, not the primary landing state.

### 3.4 What this dashboard deliberately does not do

No participant-to-participant referral loop (explicitly descoped). No self-service "create a new
ambassador type" — that's ops-only (§1.2). No in-app payout initiation — cash/reward disbursement stays
manual, tracked via §2.4's export, same posture as the org payout rollback already implemented.

---

## 4. Build order

1. §0.3 schema migration (main app) — additive only, nothing existing touched.
2. §1.1/§1.2 ops-side tables + UI — can be built and tested independently of the main app, since it's
   just writing booleans/rows into ops's own database. Confirm `syncOrgPlanLimitsCache` actually fires on
   toggle before moving on — this is the one integration point everything else depends on.
3. §0.2 main-app read of `planLimitsCache.features.ambassadorProgram`/`ambassadorTypes` — gate the new
   nav item and routes behind it. Verify the "org isn't enabled" path returns a clean 404-shaped response,
   not a 403 that reveals the feature exists.
4. §2.1/§2.2/§2.3 org-admin side (applications, campaigns, reward config) — no ambassador-facing surface
   needed yet to build and test this against seeded data.
5. §0.4 referral capture on `registerParticipant` — additive, verify it doesn't change behavior when no
   `ref` param is present (existing registration flow, including the just-built resume-or-fresh logic,
   must be completely unaffected).
6. §3.1–3.3 ambassador-facing application + dashboard, including the new auth middleware.
7. §2.4 reporting / leaderboard aggregates — natural to build alongside 3.3 since both read the same
   queries, just rendered for different audiences.

## 5. Open items to confirm before/while building

- **Login mechanism** (§0.5): OTP-based (recommended, less new infrastructure) vs. password-based
  (matches `Admin`'s pattern, persistent sessions). Pick one before building the ambassador auth
  middleware — switching later means migrating every existing ambassador's login method.
- **Messaging delivery path** for ambassador notifications: `MessagingService`'s existing
  `enqueueMessage` calls are keyed off `participantId`/`contestId` — an `Ambassador` is neither. Needs
  either a small extension to accept an arbitrary email recipient (closer to how `quiz-registration.service.ts`
  calls `EmailProvider.send` directly for OTP, bypassing the queue) or a genuinely new delivery path.
  Worth a quick look at `messaging.service.ts` before writing `ambassador.service.ts`'s notification
  calls.
- **One campaign per contest** (§2.2's `@@unique([contestId])`): flagged as the simplifying default:
  confirm it holds before building, since relaxing it later means a schema change plus deciding how
  competing campaigns on one contest would split attribution.
