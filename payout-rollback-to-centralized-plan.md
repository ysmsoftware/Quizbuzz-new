# Payout Rollback — Route Transfers → Centralized Payout

Plan only. No code changed yet. Grounded in the actual code at `Quizbuzz-new/backend`
(read 2026-07-31): `payment.service.ts`, `contest.service.ts`, `container.ts`, `routes.ts`,
`config/index.ts`, `route-transfer.worker.ts`, plus the org-facing frontend
(`app/org/settings/page.tsx`, `app/org/contests/create/page.tsx`, `lib/hooks/use-payout.ts`).
Companion reading: `razorpay-route-payout-spec.md` (original design) and
`payout-manual-onboarding-ux-plan.md` (the manual-KYC stopgap already built on top of it).

## 0. Why

RazorpayX Route's linked-account creation (`accounts.create()`) sits behind Razorpay's
Partner/Technology-Partner program, which gates on business scale (₹30–40L+ turnover) the
client doesn't have yet. The manual-onboarding stopgap (human-mediated KYC, `MANUAL` mode)
papers over the account-creation problem but the *transfer* leg — money leaving the platform's
account and moving to an org — was still live and automatic. Rolling all the way back:
QuizBuzz collects and holds all contest revenue in its own Razorpay account, full stop.
Org payouts become a manual, out-of-app process (bank transfer/UPI, reconciled by ops) until
either a wallet feature or an alternate payout provider is evaluated later — both explicitly
deferred, not part of this plan.

## 1. Important finding before the how-to

`RAZORPAY_ROUTE_ENABLED` is **already `false`** in `.env.production`, `.env.local`, and
`.env.example` today. But that flag is a false sense of security: grep confirms it is only
ever read in one place, `payout.service.ts:setupPayoutAccount` —

```ts
if (onboardingMode === PayoutOnboardingMode.API && config.payout.enabled) { ... }
```

— which gates the *auto-create-linked-account* path that's already dead (onboarding mode is
`MANUAL` everywhere). **It does not gate the webhook's transfer-enqueue call at all.**
`payment.service.ts`'s `handleWebhook` enqueues a `route-transfer-queue` job on every
`payment.captured` event unconditionally, guarded only by `if (this.payoutService)` — and
`container.ts` always constructs and injects `payoutService`, so that guard is always true.
In practice nothing has transferred yet only because no org happens to have an `ACTIVE`
linked account (an organic accident, not an enforced kill switch). So step 2 below ("turn off
the flag") on its own would change nothing — the actual fix is removing the enqueue call
itself (step 1). Flagging this now so the plan doesn't stop at a flag flip that looks like a
fix but isn't one.

## 2. The four changes

### 2.1 Stop creating the transfer from the payment webhook

**File:** `backend/src/modules/payment/payment.service.ts`, `handleWebhook`, `payment.captured`
branch, lines ~289–317.

Remove the entire block that builds the `RouteTransferJobPayload` and calls
`routeTransferQueue.add("create-route-transfer", ...)`. Everything above it in that branch stays
untouched — `participantService.confirmPaymentRegistration`, the payment-confirmation email
enqueue, and the payment row being marked `SUCCESS` are all provider-agnostic and already the
correct behavior for "money received directly into our account." After this change, a captured
payment simply confirms the registration and stops — no transfer, no `PaymentRouteTransfer`
row created going forward.

**Also stop the recurring reconciliation sweep**, or it keeps running forever finding nothing
to reconcile (harmless but noisy, and misleading in logs): `route-transfer.worker.ts` line 120
calls `paymentService.ensureReconciliationRecurringJob()` on worker startup. Either remove that
call, or — cleaner — stop starting the `route-transfer-worker` process at all once step 2.1's
enqueue call is gone, since the worker (`processRouteTransfer` in `route-transfer.worker.ts`)
has nothing left to consume. Check `workers/index.ts` / `worker.registry.ts` for where it's
registered and drop it from the active worker list rather than deleting the file outright (see
§4 on what to keep vs. remove).

### 2.2 Turn off the flag

`RAZORPAY_ROUTE_ENABLED=false` is already set in every env file — no change needed there. Worth
doing anyway, once 2.1 lands, so the flag's meaning matches reality: wire
`config.payout.enabled` into the webhook path itself (e.g. `if (config.payout.enabled) { enqueue }`)
even though the block is being removed — or, if the block is fully deleted per 2.1, the flag
becomes vestigial and can be left in `config/index.ts` unused (harmless, documents intent) or
removed in the same pass. Recommend leaving the env var and schema entry in place, just
disconnected — matches the pattern already used in this repo (see §4).

### 2.3 Remove it from the payout onboarding flow

This is the org-facing "Payouts" tab in `app/org/settings/page.tsx` — the `PayoutsTabContent`
component (lines ~738–930+), the `TabsTrigger value="payouts"` entry in the settings `TabsList`
(line ~252), and the "Request Payout Setup" form that calls `POST /payout-accounts/setup`. Under
a fully centralized model there's nothing for an org to set up — no linked account, no KYC
request — so this tab has no reason to exist for org admins. Remove the tab trigger and its
`TabsContent`, and drop the now-unused `usePayout` setup-mutation wiring from that page.

Backend: leave `payout.routes.ts` / `payout.controller.ts` / `payout.service.ts` reachable but
disconnect them from anything that runs automatically (this mirrors exactly what the
manual-onboarding plan already did with the "Attach & Activate" box — removed from the UI,
endpoint left intact as a harmless escape hatch). No org will hit these endpoints once the
frontend entry point is gone.

### 2.4 Remove the paid-contest payout enforcement

Three call sites in `backend/src/modules/contest/contest.service.ts`, all doing the identical
check — "does this org have an `ACTIVE` payout account? If not, block":

- `createContest`, lines 54–59
- `updateContest`, lines 177–182
- `publishContest`, lines 285–290

Delete all three blocks. Once gone, `paymentEnabled: true` is accepted unconditionally on
create/update/publish — any org can create, edit, and publish a paid contest regardless of
payout status. `this.payoutRepo` becomes an unused constructor param in `ContestService`;
either drop it from the constructor and `container.ts`'s `new ContestService(...)` call (line
92), or leave it as an unused optional param for now — recommend dropping it, since keeping an
unused dependency injected for no reason is exactly the kind of thing that causes confusion
later.

**Frontend mirror:** `app/org/contests/create/page.tsx` around lines 783–803 — the amber
"Set up payouts before enabling paid registration" `Alert` and the `disabled={!payout.isActive}`
on the "Enable Paid Registration" `Switch`. Remove both; the switch should just reflect
`form.paymentEnabled` directly, no `payout.isActive` gating. This depends on `usePayout()` still
existing as a hook (it will, for the `account`/`transfers`/`summary` queries even if unused by
this page) — or drop the import here too if nothing else on this page needs it.

## 3. Cross-verification checklist

Ambassador-adjacent instruction from you: verify every other place a payout-account check might
have been added, since the mental model was "we added checks in multiple places." Checked:

- **Order creation** (`payment.service.ts`, `createOrder`) — **clean**. No payout-account check
  exists here today; a paid contest's Razorpay order is created purely off `PaymentConfig`
  (amount/currency), independent of payout status. Nothing to remove.
- **`payment.validator.ts` / `payment.controller.ts`** — **clean**. No payout references.
- **`publishChecklist.ts`** (frontend, 47 lines) — **clean**. No payout references; the publish
  checklist only covers question-count/timing/etc., not payout status.
- **`organization` module / org onboarding flow** — **clean**. Zero payout references anywhere
  in `modules/organization/`; the org onboarding steps (`OnboardingStep` enum) never touched
  payouts. (This confirms "remove it from the onboarding process" in §2.3 refers to the
  *Payouts tab's own request flow*, not the org's general onboarding wizard — there's no
  payout step in that wizard to remove.)
- **`route-transfer.worker.ts` reconciliation cron** — **needs action**, see §2.1.
- **`quizbuzz-ops-next` payouts feature** (`server/features/payouts/`, `app/dashboard/payouts/`)
  — **no code change required for this pass**, flagged for awareness only. This is the internal
  ops view over `PaymentRouteTransfer`/`OrganizationPayoutAccount` — once §2.1–2.4 land, it'll
  just show a frozen historical/empty state rather than live transfer telemetry. Fine to leave
  as-is; revisit its copy/framing only if it becomes actively confusing to ops staff.
- **`OrganizationPayoutAccount`, `PaymentRouteTransfer` schema + tables** — **kept, not
  dropped**. No migration in this plan. These tables cost nothing sitting empty/unused, and
  keep the door open for the wallet feature or a different provider later without a schema
  do-over. Confirmed no other model has a required (non-nullable, non-optional) relation into
  either table that would break if they simply stop accumulating new rows.

## 4. What stays untouched, on purpose

- `razorpay.provider.ts`'s `createLinkedAccount` / `createPaymentTransfer` methods — dead code
  after this change, but harmless; removing them is optional cleanup, not required for the
  rollback to work.
- The `payout` Prisma module, its routes/controller/service/repository files — left in place per
  §2.3, matching the existing "keep the escape hatch" precedent from
  `payout-manual-onboarding-ux-plan.md` §2.3.
- All of `payment.service.ts` besides the one block in §2.1 — `createOrder`, `verifyPayment`,
  `retryPayment`, `cancelPayment` are provider-mechanics for collecting money, not for
  distributing it, and are unaffected by this rollback.

## 5. Order of operations

1. §2.1 — remove the webhook's transfer enqueue + stop the reconciliation cron. Do this first;
   it's the only change with a live-traffic blast radius (a bad edit here touches every
   successful payment).
2. §2.4 — remove the three contest-service enforcement points + frontend switch gating. Safe
   to do right after; contest creation/publish is a much lower-traffic path than the webhook.
3. §2.3 — remove the Payouts tab from org settings.
4. §2.2 — flag cleanup (optional, cosmetic once 2.1–2.3 are done).

## 6. Verification after implementing

- Register + pay for a contest end-to-end; confirm `Payment.status → SUCCESS`,
  `Participant.status → REGISTERED`, confirmation email enqueued, and **no** new
  `PaymentRouteTransfer` row is created.
- Confirm BullMQ has no repeatable `periodic-payout-reconciliation` job registered after
  restart (`routeTransferQueue.getRepeatableJobs()` should return empty, or the worker
  shouldn't be running at all).
- Create a paid contest (`paymentEnabled: true`) for an org with **no** payout account row at
  all — should succeed at create, update, and publish with no `BadRequestError`.
- Org settings page no longer shows a "Payouts" tab; direct navigation to
  `?tab=payouts` degrades gracefully (falls back to `general` or shows nothing broken).
- `npx tsc --noEmit` clean on both `frontend/` and `backend/` after removing the now-unused
  `payoutRepo` param / `usePayout` gating code.
