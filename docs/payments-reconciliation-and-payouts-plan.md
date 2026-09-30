# Payments: Reconciliation, Resilience & Organization Payouts — Plan

Status: **discussion / plan.** Part 1 describes what is already built and deployed. Parts 2–5 are
proposals — nothing in them is implemented yet.

Written 2026-09-30, after the "paid but shown as declined by bank" incident of 29 Sep 2026.
Covers both codebases: `Quizbuzz-new` (main SaaS app — backend + frontend) and
`quizbuzz-ops-next` (ops dashboard). Companion docs: `payout-rollback-to-centralized-plan.md`,
`payment-registration-resume-or-fresh-plan.md`.

---

## Contents

0. [Context and settled facts](#0-context-and-settled-facts)
1. [What is already built (deployed)](#1-what-is-already-built-deployed)
2. [How production systems keep payments consistent — and how we compare](#2-how-production-systems-keep-payments-consistent--and-how-we-compare)
3. [Payment collection: remaining hardening (main app)](#3-payment-collection-remaining-hardening-main-app)
4. [Reconciliation & monitoring (ops)](#4-reconciliation--monitoring-ops)
5. [Organization payouts](#5-organization-payouts)
6. [Roadmap](#6-roadmap)
7. [Decisions — made and open](#7-decisions--made-and-open)
8. [Checks to run (no code)](#8-checks-to-run-no-code)
9. [Glossary](#9-glossary)

---

## 0. Context and settled facts

### 0.1 The incident (29 Sep 2026)

Three participants (Mansi Ahire, Chetan Sonawane, Nida Shah) paid ₹99 via UPI, Razorpay captured
the money and emailed a receipt, but our app showed "Payment declined by bank" / "could not
complete it in time" and left their registrations `PENDING_PAYMENT`.

Root cause, confirmed from Razorpay's webhook log:

1. With UPI, Razorpay sent `payment.failed` and then `payment.captured` ~10–17 s later for the
   **same** payment (a late bank confirmation).
2. Our webhook marked the row `FAILED` on the first event and **dropped** the capture
   (`if (status === FAILED) return;`), still replying 200 — so Razorpay never retried.
3. The participant saw "failed", tapped Pay again, and because the row was `FAILED` a **second
   Razorpay order** was created, **overwriting** the first order's ID on the row. The paid order
   became untraceable from our DB.
4. The second order was abandoned (they had already paid) and later timed out →
   `payment.failed` → the row stayed `FAILED` for good.

### 0.2 Settled facts (business / account)

| Fact | Consequence |
|---|---|
| **No Razorpay Route.** Route / linked accounts need a Partner-program tier gated on turnover (quoted to us as roughly ₹1–1.5 Cr; the earlier rollback doc recorded ₹30–40 L+). We're on a normal business account. | All contest money lands in the platform's single Razorpay account. Route transfer code was rolled back (`payout-rollback-to-centralized-plan.md`). |
| **One Razorpay account, same keys** for the main app and ops; **two webhook URLs**. | Each webhook URL can receive the other app's events. Reconciliation can cover the whole account from one place. |
| **Orgs are paid out manually for now**, from ops, after deducting commission/fees. Bank details are already collected in org settings (`organization_payout_accounts`). | Payouts need a ledger and an ops workflow (Part 5). |
| **Subscriptions are paid in ops** (billing portal); the main app reads plan/usage read-only. | Ops has its own payment flow that needs the same hardening. |
| **Registration step 2 blocks closed/over contests** before the payment step. | Late captures on closed contests are rare, but see 3.2 (resume path). |
| **Refunds are manual** — a business decision, policy to be decided later. | Duplicates are flagged and held, not auto-refunded. |
| **The main app is multi-tenant SaaS.** Orgs cannot see Razorpay. | Orgs need self-service verification ("Verify with Razorpay") and simple views; ops gets full detail. |

### 0.3 Principles

1. **Razorpay is the source of truth for money.** Our DB is a copy that must keep being
   checked against it.
2. **One writer for payment state.** Only the main app changes contest-payment state. Webhooks,
   reconciliation and admin verification all run the same main-app code. Ops reads, flags, and
   triggers fixes by calling the main app — it never writes payment rows directly.
3. **Everything automatic is safe to run twice** (idempotent): retries and overlapping jobs cannot
   double-confirm, double-email or double-pay.
4. **"Captured" beats "failed"; a settled state never moves backwards.**
5. **Tiered visibility:** customer sees a simple status; organization sees outcome and enough to
   answer "did they pay?"; ops sees everything.
6. **Nothing fails silently.** Anything we can't settle automatically becomes visible in ops.

---

## 1. What is already built (deployed)

### 1.1 Main app (`Quizbuzz-new`)

| Change | What it achieves |
|---|---|
| `payment_orders` table (migration `20260929164414_payment_order_history`, backfilled) | Every Razorpay order per registration is kept; retries no longer overwrite history. Per-order status, payment ID, method, Razorpay failure reason/code. |
| Captured always wins (incl. over `FAILED`, and on an older order) | Fixes the incident's root cause. |
| Failed attempt only fails the row if it's on the **current** order | A stale failure on an old order can't mark a live payment failed. |
| Webhook resolves payment by order history → current order → `notes.participantId` | Captures on orders we no longer track are re-linked instead of dropped. |
| Duplicate capture on an already-paid registration is logged + audited (`payment.duplicate_captured`) | Double payments are visible for a refund. |
| `createOrder` asks Razorpay first; same order reused within the window (even after a failed attempt); window measured from the current order | Stops handing out second orders to people who already paid. |
| Checkout success handler confirms with Razorpay immediately | Doesn't wait for the webhook. |
| Status polling re-checks Razorpay (throttled 10 s per payment) | Late captures are found while the customer is still on the page. |
| Hourly sweep re-checks unpaid/failed payments from the last 48 h (before abandoned-payment cleanup) | Catches missed webhooks. |
| Frontend: FAILED shown only after holding 45 s; poll up to 3 min; calm failure copy + "Check payment status"; no fake success on timeout | Customers don't panic or pay twice. |
| Registration drawer → Payment tab: real reason, payment/order IDs, every order, receipts | Orgs can see what happened. |
| Two-step **Look up on Razorpay → review → Confirm** (server re-runs all checks: captured, amount, belongs to this registration, not linked elsewhere, still unpaid) | Orgs (who can't access Razorpay) can settle a genuine payment safely. |
| Removed non-functional "Allow Free Entry" and "Mark as Manually Paid" stubs | No buttons that pretend to work. |
| `deploy.yml`: watcher 20 min, SSM execution cap 18 min, bounded `docker pull`, curl timeouts | No more false "deploy failed" while the server is still deploying. |

### 1.2 Ops (`quizbuzz-ops-next`)

| Change | What it achieves |
|---|---|
| Payments page (search by email/phone/name/IDs, status, retried-only, date range) | Observability of every contest payment across tenants. |
| Order history per payment (newest first), receipts, stored webhook metadata | Cross-check against the Razorpay dashboard. |
| Grant `005_quizbuzz_ops_payment_orders.sql` | Read access to `payment_orders`. |
| Date range picker, grouped sidebar | UX. |
| Dockerfile: full `node_modules` in the runner image | Fixes the ops worker boot loop (`Cannot find module 'ioredis/built/utils'`) — ops emails were never being sent. |

---

## 2. How production systems keep payments consistent — and how we compare

Apps that collect payments at scale (food delivery, e-commerce, ticketing) don't rely on any one
signal. They combine four, from fastest/least trustworthy to slowest/most authoritative:

| Signal | Speed | Trust | Role |
|---|---|---|---|
| Checkout callback (browser handler / UPI redirect) | Instant | Low — can be missing or forged | A hint to go and ask the gateway |
| Webhook | Seconds | Signed, but late / duplicated / out of order / sometimes missing | Main source of status updates |
| Status API (server asks gateway) | On demand | Authoritative now | Settling anything uncertain, on a schedule |
| Settlement report / daily payment list | Next day | Final word on money | Catches anything the other layers missed |

Common building blocks:

1. **Business order separate from payment attempts** (one order → many attempts → at most one accepted payment).
2. **Explicit state machine**, finished states never move back, plus a **permanent event log** (raw webhooks, status-check responses, admin actions).
3. **Webhook inbox:** verify signature → store raw event (unique gateway event ID) → reply 200 → process from a queue.
4. **"Pending" as a real state** in the UI, with a schedule of gateway status checks (≈5 s, 30 s, 2 min, 10 min, 1 h).
5. **Automatic handling of late money** (captured after cancel/timeout, or paid twice) — usually an automatic refund.
6. **Daily full reconciliation** against the gateway's list/settlement file, with each mismatch type routed to auto-fix or alert.
7. **Transactional outbox:** status change + business confirmation + "to send" notifications in one DB transaction.
8. **Support tooling by UTR/RRN.**
9. **Monitoring:** webhook lag, % settled by reconciliation (≈0 is healthy), stuck pending, duplicates.
10. **Scale:** queues + unique-key idempotency; per-payment ordering; very large apps add multi-gateway failover (uptime, not correctness).

### 2.1 Comparison

| Capability | Large apps | Us today | Gap / plan |
|---|---|---|---|
| Order separate from attempts | ✅ | ✅ `payment_orders` | — |
| One active order per registration | ✅ | ✅ reuse window + Razorpay check | Harden (3.2) |
| Captured beats failed, no downgrade | ✅ | ✅ | — |
| Signed webhooks, idempotent processing | ✅ | ✅ | — |
| Webhook inbox (store before process) | ✅ | ❌ processed inline; **replies 200 even on processing errors** | 3.3 |
| Raw event log | ✅ | ⚠️ order history + audit log only | 3.3 |
| Pending before failed in UI | ✅ | ✅ | — |
| Scheduled status checks | ✅ | ✅ poll + hourly 48 h sweep | Fine at our volume |
| Daily full match vs gateway | ✅ | ❌ only re-checks rows we know | 4.1 |
| Payment + seat confirmation atomic | ✅ | ❌ two separate writes | 3.1 |
| Authorized / refund events tracked | ✅ | ❌ only `captured` / `failed` handled | 3.4 |
| Auto-refund duplicates / late money | ✅ | ⚠️ flagged, refund manual | Business decision (7) |
| Support lookup | ✅ | ✅ Verify with Razorpay | — |
| Alerts | ✅ | ⚠️ log lines only | 4.3 |
| Multi-gateway, sharding | at their scale | ❌ | Not needed |

---

## 3. Payment collection: remaining hardening (main app)

### 3.1 Confirm payment and seat atomically (transactional outbox)

**Problem.** "Mark payment SUCCESS" and "participant `PENDING_PAYMENT` → `REGISTERED`" are two
separate writes. A crash/restart between them leaves a paid payment with an unconfirmed seat, and
reconciliation skips it because the payment already looks settled.

**Approach.** One DB transaction: payment → SUCCESS, participant → REGISTERED, and insert
"to send" rows (confirmation + registration emails, later: ledger entries — see 5.2) in an
`outbox` table. A worker sends outbox rows and marks them done.

The two-step registration flow (free vs paid contests) is **unchanged** — this only changes how
the final step is persisted.

| Pros | Cons |
|---|---|
| Removes the last "paid but not confirmed" hole | Small refactor of `applyCapture` |
| Emails can't be lost or duplicated by a crash | New outbox table + worker (or reuse the message queue) |
| Natural place to write ledger entries later | |

**Cheaper alternative:** keep the two writes, add a sweep for "SUCCESS payment + `PENDING_PAYMENT`
participant" that confirms them. Fixes the symptom within an hour; doesn't cover emails. Good as a
stopgap, not the end state.

### 3.2 One registration = one payment

Money that's captured has left the customer's account; "not accepting" it after the fact means a
refund. So the goal is **prevention**, with a clearly marked last resort.

| Layer | What it does |
|---|---|
| a. Longer reuse window (`PAYMENT_ORDER_REUSE_WINDOW_MS` 10 min → 24 h) | Same order almost always reused. Razorpay rejects a second payment on an already-paid order, so one order ⇒ one payment. Config only. |
| b. In-flight check before a new order | When the window expires, ask Razorpay about the old order: captured → mark paid; attempt still pending/authorized → tell the customer "a payment is still processing" and **don't** create a new order; only failed/no attempts → new order. |
| c. Per-registration lock on order creation | Two tabs clicking Pay at the same instant can't both create orders (DB row lock or Redis `SET NX`). |
| d. Re-check registration deadline in `createOrder` | Closes the resume path: register before the deadline, come back to pay after it. |
| e. Duplicate hold (last resort) | A second capture on a paid registration is marked `DUPLICATE`, never confirms twice, is excluded from the org's payable balance (5.2), and is queued in ops for a refund decision. |

Remaining rare case: a late UPI bank confirmation after the contest has **started**. It's a
legitimate, pre-deadline payment → **confirm and flag to ops** (recommended).

### 3.3 Webhook inbox

**Approach.** Endpoint: verify signature → insert raw event into `payment_webhook_events`
(unique on Razorpay's event ID) → reply 200 **only after the insert succeeds** (5xx otherwise, so
Razorpay retries) → enqueue. Worker processes with today's logic; marks `PROCESSED`, `IGNORED`
(not ours — see 3.5) or `FAILED` (retried; after N tries → `DEAD`, visible in ops).

| Pros | Cons |
|---|---|
| No event is ever lost (today a DB blip during processing loses it) | New table + worker |
| Redeliveries dropped by a unique key | Slight processing delay (ms–s) |
| Permanent raw log: ops can show every event Razorpay sent for a payment | Table grows — add retention (e.g. 12 months) |

### 3.4 Handle `payment.authorized` and refund events

**Background — authorized vs captured.** Authorized = the bank debited the customer and Razorpay
is holding the money. Captured = we accept it; it gets settled to us. With **auto-capture** on,
Razorpay captures immediately. **Payments left authorized-but-not-captured are auto-refunded by
Razorpay** (per their docs, after ~5 days — confirm in dashboard).

When does that happen?

1. Auto-capture off or misconfigured — every payment would sit authorized and later be refunded (an outage).
2. **Late authorization** (the realistic one): the bank confirms after checkout timed out.
   Razorpay's **capture settings** decide: capture if it arrives within X minutes, otherwise
   auto-refund. Our three incident payments were late authorizations inside that window. Outside
   it, Razorpay refunds — and today **we'd never know** (we don't handle `payment.authorized` or
   `refund.*`).

**Approach.**
- Subscribe to and handle `payment.authorized`, `refund.created`, `refund.processed`, `refund.failed`.
- Authorized → show "processing" (never confirms a seat; only capture does).
- Refund fields per order: refund ID, amount, status, **ARN** (bank's refund reference), reason
  (`RAZORPAY_AUTO`, `DUPLICATE`, `MANUAL`).
- Reconciliation also reads `status: refunded` / `amount_refunded` in case a refund webhook is missed.

**Who sees what.**
- Customer: money back in their account (UPI usually faster, cards ~5–7 working days). Our status
  page + an email: "Your ₹99 was refunded on <date>, reference <ARN>".
- Organization: the order shows **Refunded**, date and amount.
- Ops: refund ID, ARN, reason, status.

### 3.5 Tag every order with its source

Add `notes.source`: `contest_registration` (main app) / `subscription` (ops). Both webhook URLs
can then skip the other app's events cleanly (stored as `IGNORED`, not errors), and the daily
match (4.1) can map every payment on the account to exactly one app. Untagged captured money =
alert.

### 3.6 Trim what organizations see

Org drawer keeps: status, amount, paid time, payment ID, attempt list (time / outcome / reason),
refund status, the Verify-with-Razorpay flow. Moves to ops only: receipts, error codes, raw
metadata, duplicate internals.

---

## 4. Reconciliation & monitoring (ops)

### 4.1 Daily full match against Razorpay

Runs in ops (ops owns subscription payments and already reads the main DB; one job covers the
whole account).

1. Fetch yesterday's payments, refunds (and later payouts) from Razorpay (paginated).
2. Read yesterday's contest payments/orders/refunds from the main DB (read-only) and subscription payments from the ops DB.
3. Match on payment ID, fall back to order ID, classify by `notes.source`.
4. Record every mismatch in an ops `reconciliation_mismatches` table:

| Mismatch | Meaning | Default handling |
|---|---|---|
| Captured at Razorpay, not SUCCESS with us | Missed capture | Auto-resolve via main-app endpoint |
| SUCCESS with us, not captured at Razorpay | Should never happen | Urgent alert |
| Payment on an order we don't know | Unlinked money | Link via notes, else alert |
| Two captures on one registration | Duplicate | Hold, refund queue |
| Refunded at Razorpay, SUCCESS with us | Unknown refund | Auto-sync status |
| Amount differs | Wrong charge | Alert |
| No `notes.source` | Unknown money | Alert |

5. **Resolve** buttons (and auto-resolution) call a **main-app endpoint protected by a shared
   secret** (same pattern as the existing ops metrics/settings endpoints), which runs the same
   checks as Verify-with-Razorpay. Ops never writes payment rows itself (principle 2).
6. Daily summary to Slack/email.

| Pros | Cons |
|---|---|
| The only layer that catches money we don't know about at all | Razorpay API pagination / rate limits to respect |
| One job for the whole account | Needs a main-app "resolve" endpoint |
| Becomes the base for payout reconciliation (5.8) | |

### 4.2 Harden ops billing (subscriptions) with the same patterns

Before subscriptions go fully live: captured-beats-failed, Razorpay check before a new order,
order history, grace-period UI, webhook inbox. Same failure modes as contest payments.

### 4.3 Monitoring & alerts

Track and alert on: webhook lag; inbox backlog and `DEAD` events; count settled by reconciliation
instead of webhook (≈0 is healthy); payments processing > N min; duplicates held; refunds failed;
daily mismatch count; (later) payouts failed/reversed, negative org balances.

---

## 5. Organization payouts

### 5.1 How money reaches organizations — options

| Option | How it works | Pros | Cons | Cost | Fit now |
|---|---|---|---|---|---|
| **A. Razorpay Route** (linked accounts) | Split/transfer at capture into each org's linked account | Fully automatic; Razorpay holds the compliance burden of third-party funds | Gated on Partner tier / turnover we don't have; per-transfer pricing; already rolled back | Higher (separate product, confirm pricing) | ❌ Not available |
| **B. Manual bank transfer** | Ops computes net payable, someone sends NEFT/IMPS from the company bank, enters UTR in ops | Zero integration; works today; no extra Razorpay product | Human effort per payout; typos; no status webhooks; doesn't scale beyond tens of orgs | Bank's NEFT/IMPS charges (often nil on business accounts) | ✅ Phase 1 |
| **C. RazorpayX Payouts** (from a RazorpayX balance) | Ops calls the payout API → org's bank/UPI; status + UTR via webhooks | Automated; idempotent; approval workflows; bank-account validation API; scales | Separate activation/KYC; funds must be in RazorpayX balance (loaded from your bank); per-payout fees | Per-payout fee (confirm with Razorpay) | ✅ Phase 2 |
| **D. RazorpayX current account** | PG settlements land directly in a RazorpayX-powered current account; payouts from the same account | Removes the manual "load balance" step; cleanest money flow | Account opening/eligibility; business-banking change | Current-account plan + per-payout fees (confirm) | ✅ Phase 2/3 if approved |

**Recommendation:** start with **B** and design the data so **C/D** is a drop-in replacement for
the "send money" step. The ledger (5.2) is the hard part and is identical for all options.
Route (A) is out of reach and not needed.

**Get in writing from Razorpay before C/D** — ask this exact question:

> "Our SaaS collects payments through our Razorpay Payment Gateway account on behalf of
> organizations using our platform. We maintain an internal ledger that calculates each
> organization's net payable after gateway fees, our platform commission, refunds and holds. We
> intend to periodically disburse each organization's payable balance to its verified bank account
> using RazorpayX Payouts. Is this business model permitted under our account, and can our
> Payment Gateway settlements be funded directly into the RazorpayX/current-account setup used for
> those payouts?"

This forces answers on the two things that actually matter: **business/compliance eligibility**
and **the funding path**. The payout mechanics themselves (contacts, fund accounts, payouts,
idempotency, webhooks, approvals) are documented RazorpayX features.

**Compliance/tax (check with your CA before the first real payout):** collecting other
organizations' money and paying it out yourself resembles payment-aggregator activity; GST on
platform commission (invoice to the org); possible TDS obligations (e.g. section 194-O).

### 5.2 The ledger — the core of the design

An **append-only list of entries per organization**. Never edited; corrections are new entries.
Balances are **projections** (sums) over it — never a mutable `organization.balance` as the source
of truth (a cached balance table is fine as a projection).

**Entry types**

| Type | Written when | Sign |
|---|---|---|
| `PAYMENT_CREDIT` | Contest payment captured & accepted | + |
| `GATEWAY_FEE` | Same time — **the actual fee Razorpay charged** (from the payment's `fee`/`tax`), never a hard-coded "2% + GST" | − (if orgs bear it) |
| `PLATFORM_COMMISSION` | Same time — rate snapshotted on the entry | − |
| `REFUND` | Refund processed (policy decides whether commission/fee are reversed) | − |
| `CHARGEBACK` | Card dispute | − |
| `PAYOUT` | Payout reserved/paid (see 5.4) | − |
| `PAYOUT_REVERSAL` | Bank bounced a payout | + |
| `ADJUSTMENT` | Manual correction by ops, reason required | ± |

**Entry shape (conceptual)**

```
ledger_entries
  id, organization_id
  type, amount (paise, signed), currency
  reference_type, reference_id        -- e.g. PAYMENT/pay_..., PAYOUT/po_...
  status                              -- ON_HOLD | AVAILABLE | RESERVED | PAID
  hold_reason                         -- PAYMENT_SETTLEMENT | CONTEST_ACTIVE | REFUND_WINDOW
                                      -- | COMPLIANCE_REVIEW | MANUAL_HOLD
  available_at                        -- when the hold is expected to release
  commission_rate / fee snapshot      -- so past statements never change
  created_by, reason, created_at, metadata
```

Example for one ₹99 registration: `+99.00` payment, `−2.34` gateway fee (actual), `−5.00`
commission → `91.66` payable.

**Projections:** on-hold, available, reserved, paid-to-date, negative balance.

**Hold / release.** Entries start `ON_HOLD` (reasons above; suggested policy: until the contest
ends + N days, covering refunds and card chargebacks, and never before Razorpay has settled the
money). A scheduled job releases them to `AVAILABLE`.

Excluded from payable, always: duplicate payments held for refund, refunded amounts, chargebacks.

**Where the ledger lives — options**

| Option | Pros | Cons |
|---|---|---|
| **Main app DB, finance module** (written in the same transaction as payment confirmation, 3.1) | Single writer for payments (principle 2); atomic with capture; no new infra | Main app grows a finance module; ops reads it cross-DB and acts via main-app endpoints |
| Ops DB | Ops already does billing | Two apps writing money state; ledger not atomic with capture; org views need a mirror |
| **Separate financial service + DB** (ledger, payouts, bank accounts, reconciliation; both apps consume its API) | Cleanest separation; right end-state at scale | New service, deployment, auth and ops overhead now |

**Recommendation (cost/scale):** start with a clearly bounded **finance module in the main app**
(its own tables and service layer, nothing else touches them directly). Ops reads it and performs
actions (approve, mark paid) through main-app endpoints. This keeps a **single source of
financial truth** without new infrastructure, and the module can be extracted into its own
service later without changing the data model. Avoid duplicating the ledger between the two apps.

### 5.3 Bank accounts & verification

Two separate states — **verification** and **payout eligibility** are not the same thing.

```
bank_account_status:  NOT_ADDED → PENDING → VERIFIED | REJECTED
                      (change account ⇒ new record, PENDING again)
payout_status:        ACTIVE | FROZEN (reason: BANK_CHANGED, ORG_SUSPENDED, FRAUD_REVIEW,
                                        COMPLIANCE_REVIEW, REFUND_EXPOSURE, MANUAL)
```

- **Verification** behind an abstract `BankAccountVerificationService`: manual (ops) now;
  RazorpayX fund-account validation later. Razorpay offers several methods — penny test (**we**
  deposit ₹1 into the org's account and get back the registered beneficiary name; nothing is
  deducted from the org), penniless validation, UPI and IFSC validation. The abstraction lets the
  method change without touching the domain model.
- **Bank change = fraud guard:** old account record kept (immutable), new one `PENDING`, payouts
  `FROZEN` until verified + optional cooling period (24–48 h), org owner emailed. Classic attack:
  account takeover → redirect payouts.
- **Snapshot on approval:** a payout stores the bank-account record/snapshot it was approved
  against; a later change can't redirect money already in flight.
- Store external IDs (`razorpay_contact_id`, `razorpay_fund_account_id`, `razorpay_validation_id`)
  but never use them as our primary keys.

### 5.4 Payout lifecycle

```
DRAFT → PENDING_APPROVAL → APPROVED → PROCESSING → PAID
                        ↘ REJECTED               ↘ FAILED
                                         PAID ──→ REVERSED (bank bounced later)
```

- **Reserve on approval, not on draft.** On approval, the included ledger entries move to
  `RESERVED` (and a `PAYOUT` entry is written as reserved), so two drafts can't spend the same
  balance. `PAID` on confirmation; `FAILED`/`REVERSED` releases back to `AVAILABLE`
  (`PAYOUT_REVERSAL` entry).
- **Our payout ID is the business identifier.** With RazorpayX: send it as `reference_id` **and**
  as the idempotency key (`X-Payout-Idempotency`), so worker retries can never turn one payout into
  three.
- **Webhooks are authoritative.** "Created" from the API is not "paid". Status moves only on
  payout webhooks (processed / failed / reversed), with a status-fetch fallback.
- `queue_if_low_balance` can let RazorpayX queue a payout when balance is short — but our own
  reservation state stays the business truth regardless.
- Manual mode (option B): ops marks PROCESSING, transfers, enters the UTR, marks PAID. Same states.

### 5.5 Eligibility engine & scheduling

```
eligible(org) = bank_account VERIFIED
             && payout_status ACTIVE (not frozen)
             && org ACTIVE
             && available_balance >= minimum_payout (e.g. ₹500)
             && no pending bank change
             && no unresolved chargeback / compliance hold
```

Triggers:
- **Scheduled drafts** (e.g. weekly, or N days after a contest ends) — scheduler → eligibility → drafts.
- **Org request** ("Request payout" on available balance) — optional, later.
- **Ops manual.**

Phasing:
- **Phase 1:** drafts are automatic, **sending is never automatic** — ops reviews and approves every payout.
- **Phase 2** (only after reconciliation, refunds, reversals, bank changes and duplicate protection
  have been proven in production): policy-based auto-approval, e.g. `< ₹10,000` automatic,
  `₹10,000–₹1,00,000` one approval, `> ₹1,00,000` two approvals (our maker-checker; RazorpayX's
  own approval workflow can be an additional layer).

### 5.6 What the organization owner sees (main app → Org settings → Payouts)

- Balance cards: **Available**, **On hold** (with release date and reason), **Paid to date**.
- Bank account: masked number, verification status, rejection reason.
- Payout history: date, amount, status timeline (Drafted → Approved → Processing → Paid with UTR /
  Failed with reason).
- Statement per payout: by contest — gross, gateway fees, commission, refunds, net — and our GST
  invoice for the commission. Downloadable.
- Emails on each status change and on bank-detail changes.
- No internal details (approvers, Razorpay IDs beyond the UTR).

### 5.7 What ops sees and does

- **Balances:** every org's available / on hold / reserved / negative.
- **Payout queue:** drafts to review; approve/reject with reason; second approval above threshold.
- **In progress:** processing payouts; UTR entry (manual) or RazorpayX status.
- **Exceptions:** reversed payouts, negative balances (refund after payout), orgs owed money
  without a verified account, frozen payouts after bank changes.
- **Bank verification queue.**
- **Reconciliation:** ledger payout entries vs bank statement / RazorpayX (extends 4.1).
- **Audit:** who approved, sent, adjusted what and why.

### 5.8 Edge cases

| Case | Handling |
|---|---|
| Refund/chargeback after the org was paid | Negative balance, deducted from the next payout. Decide write-off vs recovery if the org never earns again. |
| Org suspended/deleted with money owed | Payouts frozen; ops decides. |
| Commission rate changes | Rate snapshotted per entry — past statements never change. |
| Bank change during an in-flight payout | Payout uses its approval-time snapshot. |
| Payout bounced | `REVERSED` → balance released, account marked invalid, org + ops notified. |
| Duplicate/held money | Never payable. |
| Tiny balances | Minimum payout threshold. |
| Worker retries / double click | Idempotency key = our payout ID. |

---

## 6. Roadmap

Ordered so each step builds on the previous one.

| # | Work | Where | Size | Why this order |
|---|---|---|---|---|
| 1 | Atomic payment + seat confirmation with outbox (3.1) | Main | S | Closes the last consistency hole; ledger entries hook in here |
| 2 | Double-payment guard: 24 h window, lock, deadline re-check, in-flight check, duplicate hold (3.2) | Main | S–M | One registration = one payment |
| 3 | Webhook inbox + raw event log (3.3), `notes.source` tagging (3.5) | Main | M | No event ever lost |
| 4 | `payment.authorized` + refund events, refund status for customer/org (3.4) | Main | M | Razorpay auto-refunds become visible |
| 5 | Org drawer trim (3.6) | Main | S | Can go alongside any step |
| 6 | Daily full match + mismatch queue + resolve endpoint + alerts (4.1, 4.3) | Ops (+ main endpoint) | M | Final safety net |
| 7 | Ops billing hardening (4.2) | Ops | M | Before subscriptions go live |
| 8 | Ledger (5.2) — entries written from step 1's transaction; hold/release job | Main finance module | M–L | Foundation for payouts |
| 9 | Bank verification + freeze states (5.3), manual payouts + approval (5.4, 5.5 phase 1), ops screens (5.7) | Main + Ops | L | Option B live |
| 10 | Org Payouts page + statements (5.6) | Main | M | Org transparency |
| 11 | RazorpayX (option C/D) after written confirmation | Main/Ops | M | Automation |
| 12 | Policy-based auto-approval (5.5 phase 2) | Ops | S | Only after proven |

---

## 7. Decisions — made and open

### Made

- No Route; single platform Razorpay account; manual payouts from ops for now.
- Same Razorpay account/keys for main app and ops; separate webhook URLs.
- Refunds stay manual; duplicates flagged/held.
- Two-step registration (register → pay → seat confirmed) stays as is.
- Subscriptions are paid in ops; main app reads plan/usage.
- Contest closed/over is blocked at registration step 2.
- Orgs verify payments via the two-step Look up → Confirm flow.

### Open

1. Late UPI capture after the contest has **started** (pre-deadline payment): confirm + flag (recommended) or refund-needed?
2. Duplicate payments: hold and flag now, refund policy later (recommended)?
3. Commission model (rate; per plan / per org / per contest) and **who bears Razorpay's fee** — org or platform?
4. Hold period: contest end + N days, or settlement + N days?
5. Payout cadence: weekly, N days after contest end, or on request?
6. Refund after payout: carry forward as negative balance (recommended)?
7. Minimum payout amount.
8. Ledger location: finance module in the main app (recommended) vs separate financial service.
9. Payout rail: manual first, then RazorpayX (recommended) — pending Razorpay's written answer (5.1).
10. Legal/tax sign-off from CA before the first real payout.

---

## 8. Checks to run (no code)

- [ ] **Razorpay dashboard → capture settings:** auto-capture ON; late-authorization window (longer = more slow UPI payments captured instead of refunded).
- [ ] **Webhook subscriptions** for both URLs: which events each receives; add `payment.authorized` and `refund.*` when 3.4 ships.
- [ ] **Stale Route reconciliation job in Redis.** `route-transfer.worker` is no longer imported by `backend/src/workers/index.ts`, so the job isn't re-registered on startup — but a repeatable `reconcile-transfers` job registered earlier can still sit in Redis and enqueue jobs that nothing consumes. Check the `route-transfer-queue` repeatables and remove it.
- [ ] Does a `PENDING_PAYMENT` participant count toward contest capacity (holds a seat)?
- [ ] Remaining incident registrations (Mansi, Chetan) verified via Look up → Confirm.
- [ ] Ops worker healthy after the Dockerfile fix: `docker ps` shows `quizbuzz-ops-worker` **Up**; logs show `[ops-message-worker] ready`.
- [ ] Send the Razorpay question in 5.1; get the answer in writing.
- [ ] CA consultation on the payout model, GST on commission, TDS.

---

## 9. Glossary

| Term | Meaning |
|---|---|
| Order | Razorpay object representing the intent to collect an amount; one registration should have one. |
| Payment / attempt | One try to pay an order (a UPI approval, a card charge). An order can have many; at most one succeeds. |
| Authorized | Bank debited the customer; Razorpay holds the money; not ours yet. |
| Captured | We accepted the money; it will be settled to us. |
| Late authorization | Bank confirms after checkout timed out; Razorpay's capture settings decide capture vs auto-refund. |
| Settlement | Razorpay paying captured money into our bank account (typically T+2). |
| RRN / UTR | Bank reference number for a payment / transfer; what customers quote. |
| ARN | Bank reference number for a refund. |
| Route | Razorpay product to split/transfer payments to linked accounts. Not available to us. |
| RazorpayX Payouts | Razorpay product to send money from our RazorpayX balance to bank accounts/UPI. |
| Fund account | RazorpayX record of a payee's bank account/UPI ID, attached to a contact. |
| Penny test | Depositing ₹1 into a bank account to confirm it exists and fetch the holder's name. |
| Idempotency key | A unique key on a request so retries can't create duplicates. |
| Outbox | Writing "to do" side effects in the same DB transaction as the state change, sent afterwards by a worker. |
| Ledger | Append-only list of money movements per organization; balances are sums over it. |
| Reconciliation | Matching our records against Razorpay's and resolving differences. |
