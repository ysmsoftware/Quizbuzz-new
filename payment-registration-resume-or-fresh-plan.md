# Payment Registration Flow — Resume-or-Fresh Plan

Plan only, no code changed yet. Grounded in `Quizbuzz-new/backend/src/modules/{payment,contest,participant,contact}/*`
and `Quizbuzz-new/frontend/{app/contests/[slug]/register/page.tsx,lib/hooks/usePayment.ts,lib/services/registration-service.ts}`
(read 2026-08-02). Companion to the diagnosis already discussed: abandoned Razorpay checkouts leave a
`Participant` stuck at `PENDING_PAYMENT` with a `Payment` stuck at `PENDING`, and the existing retry
path can't reach it (`retryPayment` only accepts `status === FAILED`, which a plain dismiss never
produces), while a second registration attempt hard-blocks with `ConflictError("Participant is already
registered for this contest")`.

## 0. Design decision — update in place, not delete-and-recreate (confirmed)

> [!IMPORTANT]
> **Update-in-Place Architecture**: Instead of deleting orphan `Participant` & `Payment` records when an attempt goes stale, we update the existing `Payment` record in place with a fresh Razorpay Order ID (reusing `updateForRetry`). This avoids data corruption and race conditions from late webhooks.

The conversation originally described the fix as "delete the orphan order and create a new one" once an
attempt goes stale. Having traced the schema, update-in-place is the confirmed approach instead, for a
concrete reason: `Payment.participantId` is `@unique` and `Participant` is `@@unique([contactId,
contestId])` — there can only ever be one row of each per person per contest. That means "create a new
one" for a stale attempt isn't actually possible without first deleting the old `Participant` row too
(not just the `Payment`), and deleting `Participant` rows is riskier than it looks: if a slow webhook
lands *after* we've decided an attempt is "stale" and torn down its row (a real race — Razorpay's mobile
UPI redirect flow in `usePayment.ts` explicitly exists because confirmation can arrive after the user
already navigated away), we'd either lose a payment that actually succeeded or throw a webhook handler
error trying to update a row that no longer exists.

The `payment.repository.ts:updateForRetry` method already does exactly the safer version of this —
same `Payment` row, new `razorpayOrderId`, `status` reset, `attempts` incremented, `failureReason`
cleared — it's just currently unreachable for the exact case we need it for (see §2.3). This builds on
that instead of introducing deletion. Net effect operationally is the same as originally asked for — the
stale attempt is replaced by a usable fresh order — it just happens via update rather than delete+insert,
and it's the reason the "multiple pending rows for one person" scenario can't happen at all once this
lands: there is structurally always exactly one `Participant` + one `Payment` row per person per contest,
continuously refreshed across retries, never duplicated.

## 1. New config (no magic numbers, per house rules)

`backend/src/config/index.ts`, next to the existing `PAYMENT` block:

```ts
PAYMENT_ORDER_REUSE_WINDOW_MS: z.coerce.number().min(0).default(10 * 60 * 1000), // 10 min, matches Razorpay order validity
```

Exported as `config.payment.orderReuseWindowMs`. This is the single threshold that decides "reuse the
existing order as-is" vs. "refresh it" — used identically on the backend (deciding what `createOrder`
returns) and reflected to the frontend (deciding what copy to show in the resume prompt).

> [!NOTE]
> **Order Reuse Window**: Configured via `PAYMENT_ORDER_REUSE_WINDOW_MS` (defaulting to 10 minutes, matching Razorpay's standard order validity). Orders younger than 10 minutes are reused as-is when resuming; older orders trigger an in-place refresh with a new Razorpay Order ID.

## Open Questions

> [!TIP]
> **Razorpay Order Expiry Alignment**: `PAYMENT_ORDER_REUSE_WINDOW_MS` is set to 10 minutes (600,000 ms). We should confirm if Razorpay's default order validity matches this in production, or explicitly pass `expire_by` if required in future releases.

Our own `createOrder` never sets Razorpay's `expire_by` on the order it creates today, so the order's
real validity window is currently whatever Razorpay defaults to when it's left unset. Confirming this
against Razorpay's docs/dashboard (or a live test order) settles whether `PAYMENT_ORDER_REUSE_WINDOW_MS`
is safely at-or-under Razorpay's actual expiry, or whether we should start explicitly setting `expire_by`
ourselves so our own window is the source of truth instead of inferring theirs. Doesn't block writing the
rest of this plan, but should be closed out before §5's implementation order kicks off.

## 2. Backend changes

### 2.1 New endpoint: look up an existing attempt

Public route, mirroring the existing `POST /contests/register/:contestSlug` convention in
`contest.routes.ts:12` — add `POST /contests/register-status/:contestSlug`, body `{ contactToken }`
(reuses the same OTP-verified token `registerParticipant` already checks — deliberately not a raw
`email` query param, so this can't be used to enumerate registered emails without having passed OTP
first, same trust boundary the existing endpoint already relies on).

Logic (new method on `ContestService`, sitting next to `registerParticipant`):

1. Verify `contactToken` → email. Resolve contest by slug → `organizationId`.
2. `contactService.findByEmailOrPhone(organizationId, email)` — no contact → `{ existing: null }`.
3. `participantRepo.findByContactId(organizationId, contestId, contactId)` — no participant →
   `{ existing: null }`.
4. Participant found. If `status === REGISTERED` → `{ existing: { participantId, registrationRef,
   status: "REGISTERED" } }` (no payment info needed — frontend just says "you're already registered").
5. If `status === PENDING_PAYMENT` → load its `Payment` via `findByParticipantId`. Compute
   `ageMs = Date.now() - payment.createdAt`, `resumable = payment.status !== "SUCCESS" && ageMs <
   config.payment.orderReuseWindowMs`. Return `{ existing: { participantId, registrationRef, status:
   "PENDING_PAYMENT", payment: { status, ageMs, resumable } } }`.

### 2.2 `ContestService.registerParticipant` — stop hard-blocking on retry

`contest.service.ts:370-444`. Today it unconditionally calls `participantService.registerParticipant`,
which throws `ConflictError` the moment any existing row is found (`participant.service.ts:82-91`),
regardless of that row's status. Change:

- Before attempting creation, look up the existing participant the same way §2.1 does.
- If found and `status === REGISTERED` → keep throwing the conflict (this is a genuine duplicate,
  correct as-is).
- If found and `status === PENDING_PAYMENT` → **don't throw.** This is exactly the "Start Fresh" case —
  reuse the existing `Participant` row (optionally update its details if the form fields changed —
  college/department/phone edits between attempts are plausible and harmless to accept), skip creating
  a new row entirely, and fall through to the same `paymentRequired: true` response shape the fresh-
  registration path already returns. `createOrder` (§2.3) then decides reuse-vs-refresh from there.
- The `P2002` catch block stays as a defensive backstop for the genuine concurrent-race case (two
  simultaneous requests both passing the check above), unchanged.

### 2.3 `PaymentService.createOrder` — the actual resume/refresh decision

`payment.service.ts:30-109`. Currently: `if (existingOrder && status !== FAILED) → return existing
order unchanged`, with no age check at all — meaning right now it would happily hand back an order
Razorpay may have already invalidated. New logic:

```
existingOrder = findByParticipantId(participantId)
if existingOrder.status === SUCCESS → throw "Payment already completed" (unchanged)
if existingOrder exists:
    ageMs = now - existingOrder.createdAt
    if existingOrder.status !== FAILED && ageMs < config.payment.orderReuseWindowMs:
        return existing order details unchanged            // resume, exactly today's behavior
    else:
        create a fresh Razorpay order
        updateForRetry(participantId, newOrderId)           // same mechanism retryPayment already uses
        return the fresh order details                      // refresh, new behavior
else:
    create order + Payment row as today (fresh registration, unchanged)
```

This one change is what actually closes the gap — it now correctly handles all three cases (no prior
order, fresh-enough prior order, stale-or-failed prior order) from a single call, which is also what
the frontend calls after either "Resume Payment" or "Start Fresh" — same endpoint either way, the
`participantId` it's given determines the outcome.

### 2.4 `retryPayment` — fold in, don't keep a second gate

`payment.service.ts:308-375`. With §2.3 in place, `createOrder` now does everything `retryPayment` does
(issue a fresh order on the existing `Payment` row via `updateForRetry`) plus the parts it was missing
(the reuse-window check, and reachability for the plain-dismiss case that never reaches `FAILED`).
Recommend retiring `retryPayment` as a separate concept — point the frontend's "Try Again"/"Check
Again" buttons (`register/page.tsx:236-238`) at `createOrder` instead of `paymentApi.retryPayment`, and
either delete the now-redundant `POST /payments/retry` route or leave it mounted but unused (matches
the "harmless escape hatch" precedent from the payout work). Not a hard requirement — if you'd rather
keep them as two distinct endpoints for clarity, the alternative is just relaxing line 335's condition
to `payment.status !== "FAILED" && ageMs < reuseWindow` (i.e., also allow retry on stale `PENDING`), but
that leaves two code paths doing near-identical work.

### 2.5 Optional: safety-net sweep for attempts that never come back

Everything above only fires when the participant does something (resume, start fresh, or hit
create-order again). Someone who registers once and simply never returns still leaves one
`PENDING_PAYMENT` row sitting there indefinitely — by design now (not duplicated, just unresolved).
That's arguably a legitimate signal ("started but didn't pay"), not corruption, so no cleanup is
strictly required for correctness. If the org-side registration list should stop counting these after
a longer horizon, a scheduled job (same pattern as `jobs/subscription-reconciliation.job.ts` in the
ops repo, or a new BullMQ repeatable job here) could flag — not delete — `PENDING_PAYMENT` participants
whose `Payment` has been non-`SUCCESS` for longer than a separate, larger config value (e.g.
`PAYMENT_ABANDONED_FLAG_AFTER_MS`, default 48h) so the frontend registration list can filter them out
of the default view. Deferred — only worth building if §3.5 (below) isn't enough on its own.

## 3. Frontend changes

### 3.1 Call the lookup right after OTP verification

`app/contests/[slug]/register/page.tsx`, in `handleVerifyOtp` (~line 181), immediately after
`registrationService.verifyOtp(...)` succeeds and before `setStep("details")`: call the new
`register-status` endpoint with the returned `contactToken`. Branch on the response:

- `existing === null` → `setStep("details")`, exactly today's behavior.
- `existing.status === "REGISTERED"` → new step, e.g. `setStep("already-registered")`, showing their
  `registrationRef` and a link to whatever the org already surfaces for confirmed registrants (join
  link / registration-success page) — no form.
- `existing.status === "PENDING_PAYMENT"` → new step, e.g. `setStep("resume-or-fresh")`:
  - **Resume Payment** (shown/enabled when `existing.payment.resumable === true`): store
    `participantId` from the response, skip straight to the payment step — call `createOrder` (§2.3
    returns the still-fresh existing order) and open Razorpay checkout directly, no form re-entry.
  - **Start Fresh**: proceeds to the normal details form (pre-fill from the prior attempt if you want
    less retyping, optional), submits through `registerForContest` as today — now safe per §2.2, and
    `createOrder` will issue a refreshed order per §2.3 since the old one is stale (or the user chose
    fresh even though it wasn't).
  - When `resumable === false` (order's past the window but participant hasn't explicitly chosen yet),
    just show "Start Fresh" — no point offering to resume an order that's about to be refreshed anyway.

### 3.2 "Try Again" / "Check Again" buttons

`register/page.tsx:685-712` (`paymentState === "failed"` and `paymentState === "timeout"` branches),
currently both call `handleRetryPayment` → `retryPayment(...)`. Per §2.4, repoint both at the same
`createOrder` call `handlePayment` already uses, dropping the separate `retryPayment` hook path.

### 3.3 Org-side registration list

Lower priority, separate from the core fix: once §2.2/§2.3 land, "multiple pending rows for one
person" structurally can't happen, so most of the clutter you described disappears without any UI
change. If single, genuinely-abandoned `PENDING_PAYMENT` rows (people who never came back at all) still
feel noisy in the org's registration list, that's a display filter, not a data problem — worth a
follow-up only if it's still bothering you after this lands, and would pair naturally with §2.5's flag
if you end up building that.

## 4. Cross-verification checklist

- **Idempotency middleware**: `createOrder` and the old `retry` route both sit behind `idempotency`
  middleware (`payment.routes.ts:9-11`) keyed on an idempotency key the client supplies. Confirm the
  frontend passes a *stable* key for "resume" calls (same `participantId`-derived key each time within
  the same attempt) but a fresh one when actually generating a new order — otherwise the idempotency
  layer itself could mask the refresh. Check `idempotency.middleware.ts`'s exact keying before wiring
  §3.1's resume call.
- **New endpoint abuse surface**: `register-status` requires a valid `contactToken`, same trust
  boundary as `registerParticipant` — confirm rate limiting (`middlewares/rate-limit.ts`) is applied to
  it the same way it's applied to the OTP endpoints, since it's still a lookup that could be hammered.
- **Free contests** (`paymentEnabled: false`): these skip payment entirely and go straight to
  `REGISTERED` — confirm §2.1/§2.2 correctly short-circuit to the `REGISTERED` branch for these rather
  than trying to evaluate payment freshness on a contest that never had a `Payment` row.
- **Webhook race**: confirm `handleWebhook`'s `payment.captured` (`payment.service.ts:220`) still finds
  the payment correctly by `razorpayOrderId` after a §2.3 refresh — since refresh changes
  `razorpayOrderId` on the same row, a webhook for the *old* order id arriving late (the exact race §0
  is designed around) should be checked: does `findByRazorpayOrderId` still resolve it correctly, or
  does it silently no-op because the row's `razorpayOrderId` has since moved on? Worth an explicit test
  case (§5).

## 5. Order of operations

1. Confirm Razorpay's actual order-expiry default (§1's open question) — sets the real value for
   `PAYMENT_ORDER_REUSE_WINDOW_MS`, everything else is inert until this is right.
2. §2.3 (`createOrder` resume/refresh logic) — the load-bearing change, everything else routes through
   it.
3. §2.2 (`registerParticipant` stop-blocking) — safe to do right after; without §2.3 this alone would
   just reuse a possibly-stale order, so order matters.
4. §2.1 (lookup endpoint) — additive, no risk to existing flows.
5. §3.1–3.2 (frontend wiring) — depends on 2.1–2.3 all being live.
6. §2.4 (retire `retryPayment`) — cleanup, do last, after confirming §2.3 fully covers its cases.

## 6. Testing plan

- Register for a paid contest, open Razorpay checkout, dismiss without attempting payment. Within the
  reuse window, click "Check Again" (or re-enter via OTP + see the resume prompt) — confirm the *same*
  `razorpayOrderId` is reused, no new `Payment` row, no new `Participant` row.
- Same scenario, but wait past `PAYMENT_ORDER_REUSE_WINDOW_MS` before retrying — confirm a *new*
  `razorpayOrderId` is issued on the *same* `Payment` row (`attempts` incremented), still one
  `Participant` row throughout.
- Re-enter registration via OTP a second time (simulating a new session/day) for an email with a
  `PENDING_PAYMENT` participant — confirm the resume-or-fresh prompt appears instead of the current
  `ConflictError`, and both branches complete successfully.
- Complete payment for real after a refresh (stale-order case) — confirm the webhook resolves against
  the *new* `razorpayOrderId` and `Participant` correctly flips to `REGISTERED`.
- Send a stale/duplicate webhook for an *old*, since-refreshed `razorpayOrderId` — confirm it's handled
  gracefully (logged as unknown/stale order, not crashing, not double-processing) per §4's webhook-race
  item.
- Attempt registration for an email already `REGISTERED` on this contest — confirm the clean
  "already registered" message appears, not a raw 409 or the resume/fresh prompt.
- `npx tsc --noEmit` clean on both `backend/` and `frontend/` after implementation.
