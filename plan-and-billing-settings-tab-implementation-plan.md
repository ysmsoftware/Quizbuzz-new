# Plan & Billing Settings Tab — Audit Findings + Implementation Plan

Status: **audit complete, price/checkout bug already fixed, feature build awaiting approval** (per your instruction to write the plan first).

---

## PART 0 — What I checked and what I found

### 0.1 Onboarding plan-selection ("Choose your QuizBuzz Plan" modal)

You asked: *"check if the plans entered on the operational side are all shown there or not, and on what criteria."*

**Where it actually lives:** not a step inside `OnboardingModal.tsx` (that wizard only has 3 steps — Identity, Use Case, Contact/Locale). It's a separate `UpgradePromptModal.tsx`, triggered right after the wizard's last step completes.

**Criteria plans are shown under:** `UpgradePromptModal` calls `GET /onboarding/plans` → backend `onboarding.service.ts::getPlans()` → fetches `${OPS_BASE_URL}/api/v1/billing-portal/plans` live. That ops endpoint filters `WHERE isActive = true`, ordered by price ascending. So **yes, ops-configured plans do reach onboarding**, gated only by the plan's `isActive` flag in the ops dashboard — with two caveats found and handled below:

1. **Bug (found + already fixed):** the ops `/plans` endpoint stopped returning a flat `price` field after the recent billing-portal migration (replaced by `monthlyPrice`/`annualPrice`/`allowsMonthly`/`allowsAnnual`). The main app's `PlanOption` type still expected `price`, so every plan rendered as effectively free, and — the serious part — `activePlan.price > 0` was always `false`, meaning **anyone who picked a paid plan during onboarding got instant access with no checkout redirect and no charge.** I've already fixed this (see Part 0.3 below) since you approved it.
2. **Config risk (not yet fixed, flagging for your awareness):** `OPS_BASE_URL` defaults to `http://localhost:3010` and isn't listed in `.env.production.example`. If it's not explicitly set in your production main-app deployment, the live ops fetch fails silently and every org only ever sees the static single free-plan fallback — meaning none of your configured paid plans reach onboarding at all. Worth confirming this env var is actually set wherever the main app backend runs in production.
3. **Secondary security finding (not yet fixed):** `BILLING_HANDOFF_SECRET` has a hardcoded fallback baked into the env schema (`"billing_handoff_secret_shared_key_998877"`), also missing from `.env.production.example`. If unset in production, the JWT that authorizes billing handoff is signed with a secret visible in this repo's source. Recommend explicitly setting a real secret in production and rotating it if it may have shipped with the default.

### 0.2 Settings — current state

`frontend/app/org/settings/page.tsx` currently has 4 tabs: **General, Profile Details, Payouts, Appearance.** No plan/billing tab exists yet.

Notably, the ops checkout page **already redirects back to `{mainAppUrl}/org/settings?tab=billing&subscription=success|failed`** on completion/abandonment — someone building the ops side anticipated this tab's existence and URL shape. The Settings page already has a `useEffect` that reads `?subscription=success|failed` and shows a toast, but nothing currently reads `?tab=` to auto-select a tab, and there's no `billing` tab to select.

**Where "current plan" data already lives:** the main app doesn't need a new live cross-service call for this. Every time ops assigns/changes an org's plan, it already writes `planSlug`, `planStatus`, and a `planLimitsCache` JSON blob directly onto this app's own `organizations` table (`entitlements.repository.ts::updateMainDbPlanLimitsCache`) — and those three columns are already declared in this repo's own `schema.prisma` (lines 219–221). They're just **not exposed yet** through `OrganizationResult` / the `GET /organization` response or the frontend `useOrganization` hook.

### 0.3 Already fixed (per your go-ahead)

- `backend/src/modules/onboarding/onboarding.types.ts` — `PlanOption` now matches the live ops shape (`allowsMonthly`, `allowsAnnual`, `monthlyPrice`, `annualPrice` instead of a flat `price`).
- `backend/src/modules/onboarding/onboarding.service.ts` — `STATIC_PLANS` fallback updated to the same shape.
- `frontend/lib/api/onboarding.api.ts` — `PlanOption` mirrored.
- `frontend/components/features/organization/UpgradePromptModal.tsx` — price display and the paid/free branch (`isPaidPlan`) now compute correctly off `monthlyPrice`/`annualPrice`, so selecting a paid plan during onboarding correctly redirects to checkout instead of silently granting free access.

No schema migration was needed for this fix — it's a type/logic correction only.

---

## PART 1 — Plan & Billing Settings tab (not yet built — this is the plan)

### 1.1 Goal

Or asked for: current plan visible in Settings, a way to see/change it, an Upgrade button that redirects into the existing ops checkout flow — "cross verify and check over there... do it over there."

### 1.2 Backend changes

**`backend/src/modules/organization/organization.types.ts`**
Add to `OrganizationResult`:
```ts
planSlug: string | null;
planStatus: string | null;
planLimitsCache: Record<string, any> | null;
```

**`backend/src/modules/organization/organization.repository.ts`**
Add `planSlug`, `planStatus`, `planLimitsCache` to the existing org `select` in whichever query backs `GET /organization` (currently only selects `id/name/slug/logoUrl/website/isActive/createdAt` plus counts/members). One-line addition to an existing select, no new query.

No other backend module changes needed — `GET /onboarding/plans` and `POST /onboarding/handoff` already exist and already do exactly what an "Upgrade" button needs (fetch catalog, mint a handoff JWT, return `checkoutUrl`). They're not onboarding-specific in what they return; reusing them from Settings is just calling the same two endpoints from a new place. (Optional cleanup, not required: could alias them under a more general path later, e.g. `/billing/plans` — skip for now, YAGNI.)

### 1.3 Frontend changes

**`frontend/lib/hooks/useOrganization.ts`** — extend whatever type/mapping backs `org` with `planSlug` / `planStatus` / `planLimitsCache` (mirrors the backend DTO addition).

**`frontend/app/org/settings/page.tsx`:**
- Add a 5th tab, value `"billing"` (matches the ops redirect URL exactly — must be `billing`, not `plan` or `subscription`), label "Plan & Billing".
- Read `?tab=` from the URL on mount and pass it as `Tabs`' initial value (currently hardcoded to `"general"` — small fix needed regardless of this feature, since the ops redirect already sends `?tab=billing` and it's currently ignored).
- New tab content, `PlanBillingTabContent`, showing:
  - **Current plan card**: plan name (looked up by `org.planSlug` against the `GET /onboarding/plans` catalog — reusing `useOnboardingPlans()`, renamed or aliased to something tab-agnostic like `usePlanCatalog()` if you want cleaner naming), status badge (`org.planStatus`), and the limits from `org.planLimitsCache` (contests/participants/members caps, feature flags) rendered the same way the ops dashboard's `QuotaUsageGrid` does, for consistency.
  - **Upgrade / Change Plan button** opening a plan-picker — the existing `UpgradePromptModal` grid UI, extracted into a shared `PlanPickerGrid` component so onboarding and Settings render identical plan cards instead of duplicating the grid markup. Selecting a paid plan calls the existing `createBillingHandoff(planSlug)` and redirects to `checkoutUrl`, exactly like onboarding does today — no new redirect mechanism needed.
  - Since the ops checkout page already targets `?tab=billing&subscription=success|failed`, the existing toast `useEffect` on the Settings page will fire correctly once the tab exists — no change needed there beyond making sure the page actually lands on the right tab (the `?tab=` read above).

### 1.4 Files touched (estimate)

| File | Change |
|---|---|
| `backend/src/modules/organization/organization.types.ts` | +3 fields on `OrganizationResult` |
| `backend/src/modules/organization/organization.repository.ts` | +3 fields in existing select |
| `frontend/lib/hooks/useOrganization.ts` | +3 fields on the org type |
| `frontend/app/org/settings/page.tsx` | +1 tab, `?tab=` read on mount |
| `frontend/components/features/organization/PlanBillingTabContent.tsx` (new) | current plan card + upgrade button |
| `frontend/components/features/organization/PlanPickerGrid.tsx` (new, extracted from `UpgradePromptModal`) | shared plan-card grid |
| `frontend/components/features/organization/UpgradePromptModal.tsx` | refactor to use the extracted `PlanPickerGrid` (optional, keeps behavior identical either way) |

No schema migration, no new ops endpoints, no new cross-service auth — this reuses plumbing that already exists on both sides.

### 1.5 Open questions before I build

- Should a currently-paid org be allowed to self-serve **downgrade** to Free from this tab, or should downgrades stay ops-admin-only (as they are today, via the ops dashboard's `ChangePlanModal`)? Onboarding's flow only ever goes free → paid; Settings would be the first place a self-serve downgrade could happen if you want it.
- Should the "current plan" card show billing-cycle/renewal-date info too? That's stored in ops (`OrganizationSubscription.currentPeriodEnd`/`billingCycle`), not in the `planLimitsCache` blob synced to the main DB — showing it here would need one more field added to `syncOrgPlanLimitsCache`'s payload (small change, on the ops side) rather than a new cross-service call.

Let me know if this plan looks right (and answers to the two questions above) and I'll build it.
