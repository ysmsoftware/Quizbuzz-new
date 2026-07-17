# Main App — Onboarding Flow + Frictionless Registration
### Implementation Plan (minimal-change, YAGNI)

**Read against the real codebase** at `github.com/ysmsoftware/Quizbuzz-new` (cloned and inspected, not assumed). This plan touches the fewest files possible and writes the fewest lines possible. Two independent changes:

1. **Organization onboarding flow** — new post-signup wizard (net-new, but small).
2. **Frictionless participant registration** — relax the four demographic fields (mostly *deletion* of over-strict validation).

Guiding constraint throughout: **do not disrupt any existing flow.** Both changes are additive or relaxing — nothing existing is removed or made stricter.

---

## PART 0 — What the codebase actually looks like (verified facts)

These are confirmed from reading the real source, and they shape everything below:

- **Backend module layout is exactly the rulebook's 6-file pattern** — `*.routes.ts / *.controller.ts / *.service.ts / *.repository.ts / *.types.ts / *.validator.ts` per module under `backend/src/modules/`. Modules present: `admin/auth`, `organization`, `contest`, `participant`, `contact`, `payment`, `quiz`, `question`, `submission`, `certificate`, `proctoring`, `messaging`, `analytics`.
- **Prisma schema** lives at `backend/prisma/schema.prisma`. `Organization` currently has only `name/slug/logoUrl/website/isActive/isDeleted/createdAt/updatedAt` — no profile/onboarding fields. `Contact.college/department/city/state` are **already `String?` (nullable)**.
- **Org creation** happens in `admin-auth.repository.ts → createWithOrganization()`, a single `prisma.$transaction` that creates the Admin, the Organization (only `name` + `slug`), and the `OrgMember` as `OWNER` with `acceptedAt` set. This is the one place onboarding state must initialize.
- **Public participant registration** is `POST /register/:contestSlug` → `contest.controller.registerParticipant` → `contest.service.registerParticipant` → validated by `contest.validator.ts → RegisterParticipantSchema`.
- **The registration DTO and service already treat the four fields as optional.** `RegisterParticipantDTO` has `college?`, `city?`, `state?`, `lastName?`. The service passes them straight through to `contactService.createForRegistration`, which already accepts optionals, into nullable Contact columns.
- **The FRONTEND public register form** (`frontend/app/contests/[slug]/register/page.tsx`) **already declares these fields `.optional()`** in its `detailsSchema` and already sends `value || undefined`.

### The single most important finding

> There is a **latent inconsistency in production right now**: the frontend register form lets a participant leave college/city/state blank, but the backend `RegisterParticipantSchema` **hard-requires** `college` (`min(1, "College / Organization is required")`), `city`, `state`, and `lastName`. So a user who submits with those blank gets a backend 400 today. The registration friction is enforced in exactly **one file** (`contest.validator.ts`), and relaxing it also **fixes an existing frontend/backend mismatch bug**. This makes Part 2 almost entirely a deletion.

---
---

# PART 1 — Organization Onboarding Flow

## 1.1 Design (as agreed, matched to this codebase)

- Signup stays untouched (name, email, owner, password → OTP verify).
- A **gated post-auth wizard** runs on first entry, driven by an `onboardingCompleted` flag on `Organization` (per-org, not per-admin — correct because one Admin can own multiple orgs via `OrgMember`).
- Only the **OWNER** of a not-yet-onboarded org sees it. Invited `ADMIN`/`VIEWER` members never do.
- `PLAN_SELECTION` step is **stubbed to "Free"** for now — the ops subscription backend doesn't exist yet, and onboarding must not block on it.

## 1.2 Schema changes — `backend/prisma/schema.prisma`

**Add 6 enums** (matching the file's existing `SCREAMING_SNAKE` + inline-comment style):

```prisma
enum OnboardingStep {
  NOT_STARTED
  IDENTITY
  USE_CASE
  ATTRIBUTION
  CONTACT_LOCALE
  PLAN_SELECTION
  COMPLETED
}

enum OrgPrimaryUseCase {
  EDUCATIONAL_INSTITUTION
  COACHING_INSTITUTE
  CORPORATE_TRAINING
  RECRUITMENT_ASSESSMENT
  INDIVIDUAL_EDUCATOR
  COMMUNITY_CLUB
  PERSONAL
  OTHER
}

enum OrgSizeBucket {
  SIZE_1
  SIZE_2_10
  SIZE_11_50
  SIZE_51_200
  SIZE_200_PLUS
}

enum ExpectedContestVolume {
  RANGE_1_4
  RANGE_5_20
  RANGE_20_PLUS
  UNSURE
}

enum ExpectedParticipantVolume {
  RANGE_UNDER_100
  RANGE_100_500
  RANGE_500_2000
  RANGE_2000_PLUS
  UNSURE
}

enum HeardAboutSource {
  GOOGLE_SEARCH
  SOCIAL_MEDIA
  LINKEDIN
  WORD_OF_MOUTH
  REFERRAL
  ADVERTISEMENT
  EVENT_CONFERENCE
  OTHER
}
```

**Add 3 columns to `Organization`** (hot-path gating flags stay on the row the app already loads every request):

```prisma
  onboardingStep       OnboardingStep @default(NOT_STARTED)
  onboardingCompleted  Boolean        @default(false)
  onboardingCompletedAt DateTime?
  profile              OrganizationProfile?
```
Plus one index for the ops-dashboard funnel query later: `@@index([onboardingCompleted])`.

**Add the new 1:1 `OrganizationProfile` model** (all fields nullable except the segmentation ones filled during the wizard; ulid + snake_case map + cascade, matching every other model):

```prisma
model OrganizationProfile {
  id                       String                    @id @default(ulid())
  organizationId           String                    @unique
  primaryUseCase           OrgPrimaryUseCase?
  useCaseOther             String?
  sizeBucket               OrgSizeBucket?
  expectedContestsPerMonth ExpectedContestVolume     @default(UNSURE)
  expectedParticipants     ExpectedParticipantVolume @default(UNSURE)
  heardAboutSource         HeardAboutSource?
  heardAboutOther          String?
  primaryContactName       String?
  primaryContactPhone      String?
  primaryContactEmail      String?
  country                  String?
  state                    String?
  city                     String?
  timezone                 String?
  preferredCurrency        String                    @default("INR")
  gstNumber                String?
  billingAddress           String?
  marketingOptIn           Boolean                   @default(false)
  createdAt                DateTime                  @default(now())
  updatedAt                DateTime                  @updatedAt

  organization             Organization              @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([primaryUseCase])
  @@index([sizeBucket])
  @@index([heardAboutSource])
  @@map("organization_profiles")
}
```
Also add `profile OrganizationProfile?` to the `Organization` relations block (already listed above).

> Migration is purely additive — new nullable columns + new table + new enums. **Zero risk to existing rows**: every existing org gets `onboardingStep = NOT_STARTED`, `onboardingCompleted = false` by default. See §1.6 for how existing orgs are handled so they aren't wrongly forced through the wizard.

## 1.3 New backend module — `backend/src/modules/onboarding/`

One new module, the standard 6 files. It does **not** duplicate org logic — it reads/writes onboarding state and the profile only.

```
onboarding/
  onboarding.routes.ts        # 4 routes, all behind existing auth middleware
  onboarding.controller.ts    # parse + envelope, no logic
  onboarding.service.ts       # step progression, completion, owner-guard
  onboarding.repository.ts     # Prisma: read org onboarding fields, upsert profile
  onboarding.validator.ts      # one Zod schema per step (all fields validated)
  onboarding.types.ts
```

**Routes** (mounted at `/api/v1/onboarding`, reusing the existing `authenticatedOrgMiddleware` that other modules already use — no new auth work):

| Method & Path | Purpose |
|---|---|
| `GET  /onboarding/status` | `{ completed, currentStep, profile }` for the active org — the frontend reads this to decide whether to show the wizard |
| `PATCH /onboarding/step/:step` | Save one step's data (validated per-step), advance `onboardingStep`. Idempotent — re-saving a step is fine |
| `POST /onboarding/complete` | Mark `onboardingCompleted = true`, `onboardingCompletedAt = now`, `onboardingStep = COMPLETED` |
| `GET  /onboarding/plans` | Returns a static `[{ slug: "free", name: "Free", ... }]` for now — stub. Becomes a real ops call later. **No new table.** |

**Owner guard** lives in the service: every write checks the caller's `OrgMember.role === OWNER` for the active org (the role is already available from `authenticatedOrgMiddleware`'s context — confirm the exact field name when wiring). Non-owners get a clean 403; they should never be in this flow anyway.

**Service writes** go to two places: onboarding flags on `Organization` (update) and the profile (upsert into `OrganizationProfile`). Both are single Prisma calls; no cross-module orchestration needed beyond reading the org.

## 1.4 One-line change to existing org creation — `admin-auth.repository.ts`

In `createWithOrganization()`'s `tx.organization.create`, the new columns default correctly with **no code change** (defaults handle it). Optionally set `onboardingStep: "IDENTITY"` explicitly to signal "wizard ready to begin" — but even that is optional since the default `NOT_STARTED` works. **Net change here: 0–1 lines.**

## 1.5 Gating — how the frontend knows to show the wizard

**Minimal approach, no new middleware:** the frontend `admin` layout already runs an auth/me check on mount (confirmed: `app/admin/layout.tsx` uses a `useAuth`/`meQuery` gate and redirects unverified users). Add one parallel check: after auth resolves, call `GET /onboarding/status`; if `!completed && role === OWNER`, route to `/admin/onboarding` (new page) instead of the dashboard. This mirrors the existing `isEmailVerified` redirect pattern already in that file — **same shape, one more condition.**

Backend does **not** need to hard-block every `/admin/*` route for MVP (YAGNI) — the frontend redirect is sufficient for the intended flow, and the data captured is not security-sensitive. (If hard enforcement is ever wanted, it's a small middleware added later; not now.)

**New frontend files:**
- `frontend/app/admin/onboarding/page.tsx` — the wizard (stepper UI, one card per step, uses existing shadcn components already in the repo)
- `frontend/lib/hooks/useOnboarding.ts` — TanStack Query hooks over the 4 endpoints (matches the repo's existing `lib/hooks/` convention)

No existing frontend file is modified except **one added condition** in `app/admin/layout.tsx`.

## 1.6 Existing-org safety (the one migration subtlety)

New columns default `onboardingCompleted = false`, which would wrongly force **every existing org** through the wizard on their next login. Two YAGNI-friendly options:

- **Preferred:** a one-line data migration in the same migration file — `UPDATE organizations SET "onboardingCompleted" = true, "onboardingStep" = 'COMPLETED';` — marking all *pre-existing* orgs as already onboarded (they've been using the app; don't nag them). New orgs created after the migration start fresh at `NOT_STARTED`. This is the correct behavior and one SQL line.
- Alternative: backfill later. Not recommended — leaves existing owners staring at a wizard.

## 1.7 Files touched — Part 1

| File | Change | Size |
|---|---|---|
| `backend/prisma/schema.prisma` | +6 enums, +3 org columns, +1 model, +1 index | additive |
| `backend/prisma/migrations/*` | generated + 1 backfill SQL line | generated |
| `backend/src/modules/onboarding/*` (6 new files) | new module | small module |
| `backend/src/modules/admin/auth/admin-auth.repository.ts` | optional 1-line | ~1 line |
| *(wherever routers are mounted — `app.ts`/router index)* | mount `onboardingRouter` | 1 line |
| `frontend/app/admin/layout.tsx` | +1 redirect condition | ~5 lines |
| `frontend/app/admin/onboarding/page.tsx` (new) | wizard UI | new page |
| `frontend/lib/hooks/useOnboarding.ts` (new) | hooks | small |

No existing backend module's logic is altered. No existing table is modified destructively.

---
---

# PART 2 — Frictionless Participant Registration

## 2.1 The change in one sentence

Make `college`, `city`, `state`, and `lastName` **optional** in the backend `RegisterParticipantSchema` — which is where (and the only place) they're currently required — bringing the backend in line with the frontend (already optional) and the DTO/service/schema (already optional/nullable).

## 2.2 The actual edit — `backend/src/modules/contest/contest.validator.ts`

In `RegisterParticipantSchema`, four field definitions change (this is the entire functional change of Part 2):

```diff
- lastName: z.string().min(1, "Last name is required").max(100),
+ lastName: z.string().max(100).optional(),

- college: z.string().min(1, "College / Organization is required").max(300),
+ college: z.string().max(300).optional(),

- city: z.string().min(1, "City is required").max(100),
+ city: z.string().max(100).optional(),

- state: z.string().min(1, "State is required").max(100),
+ state: z.string().max(100).optional(),
```

`firstName`, `email`, `phone` stay required — those are the genuine frictionless minimum (identity + contact). `department` was already optional. **That's the whole backend change.** No service, repository, type, or DTO edit is needed — they already handle these as optional/nullable (verified).

## 2.3 Why nothing downstream breaks (verified, not assumed)

- **DTO already optional:** `RegisterParticipantDTO` declares `college? / city? / state? / lastName?`.
- **Service already passes through safely:** `contest.service.registerParticipant` forwards these to `contactService.createForRegistration`, which accepts optionals.
- **DB already nullable:** `Contact.college/department/city/state/lastName` are all `String?` in the real schema.
- **Admin views already null-safe:** `ParticipantDetail` and contact list types declare these as `string | null`, and the admin UI reads them as nullable already. A participant registering with them blank simply shows blank in the admin participant/contact views — no crash, no undefined access.
- **This also fixes a live bug:** the frontend already allowed blank submission but the backend rejected it — after this change, the two agree.

## 2.4 Frontend — already done, tiny cleanup only

The public register form (`frontend/app/contests/[slug]/register/page.tsx`) **already** has these `.optional()` and sends `|| undefined`. The **only** cosmetic nicety (optional, YAGNI — skip if you want zero frontend change in Part 2): the visible labels currently read "College / Institution", "City", "State" without required markers (good — they're not marked required, so no change needed), while "First Name *" keeps its asterisk (correct). So **the frontend needs no functional change at all.** At most, if any placeholder text implies these are needed, soften it — but this is optional polish, not required.

> Verified: the form's `detailsSchema` already matches the relaxed backend schema after this change. Frontend and backend will be consistent for the first time.

## 2.5 Files touched — Part 2

| File | Change | Size |
|---|---|---|
| `backend/src/modules/contest/contest.validator.ts` | 4 fields `min(1)` → `.optional()` | 4 lines |

That is the entire required change for Part 2. One file, four lines.

---
---

# PART 3 — Sequencing & Safety

## 3.1 Recommended order

1. **Part 2 first** (it's 4 lines, fixes an existing bug, zero schema migration, instant win, de-risks the demo of "registration is now smooth and uniform").
2. **Part 1 next** (onboarding — the larger but still contained piece; needs a migration).

Doing Part 2 first means the "frictionless registration" outcome you want is live almost immediately, independent of the onboarding work.

## 3.2 What is deliberately NOT done (YAGNI)

- **No hard backend gating middleware** on every `/admin/*` route for onboarding — frontend redirect suffices; the captured data isn't security-sensitive. Add later only if a real need appears.
- **No real plan/subscription tables** — `GET /onboarding/plans` returns a static Free plan. The ops subscription system (its own project) plugs in later at exactly one step, no rework.
- **No `industry` field** — `primaryUseCase` already captures the meaningful segmentation for a quiz platform; a second overlapping taxonomy would just be filled inconsistently.
- **No changes to signup** — signup stays as lean as it is; all enrichment moved to the post-auth wizard.
- **No participant-registration UI redesign** — the form already supports the relaxed fields; only backend validation is brought into line.
- **No touching** any of the 12 other backend modules, the quiz/socket flow, payment flow, or worker chain.

## 3.3 Regression checklist (before merge)

- Existing orgs: after migration + backfill, log in as an existing owner → land on dashboard, **not** the wizard.
- New signup: create a fresh org → OWNER is routed into the wizard → complete it → subsequent logins skip it.
- Invited admin: invite an ADMIN to an onboarded org → they never see the wizard.
- Registration (paid + free contest): register with **only** first name + email + phone (college/city/state blank) → succeeds end-to-end, participant appears in admin view with blank demographic fields.
- Registration with all fields filled → still works exactly as before (backwards compatible).
- Admin participant/contact list & detail pages render fine with null demographic fields.

---

*Plan derived from direct inspection of `github.com/ysmsoftware/Quizbuzz-new` (backend module structure, `contest.validator.ts`, `contest.service.ts`, `contact.validator.ts`, `admin-auth.repository.ts`, `prisma/schema.prisma`, and the public register form). Every "already optional / already nullable" claim above was verified in source, not assumed. Follows YAGNI: additive or relaxing changes only, minimal files, minimal lines, no disruption to existing flows.*
