# Payout Manual Onboarding — UX & Messaging Plan

Companion doc to `quizbuzz-ops-next/docs/ops-dashboard-billing-and-audit-log-plan.md` §2.1/§3.2.1.
That doc covers the ops-dashboard side of the decision made 2026-07-21: Razorpay Linked Account
onboarding stays **human-mediated** ("Approach A") — a billing admin collects KYC over phone/email
and creates the account directly in Razorpay's Dashboard, rather than the org self-serving through
either a form that relays KYC data through our servers ("Approach B") or a Razorpay-hosted redirect
flow ("Approach C" — real, but gated behind Razorpay Technology Partner approval we don't have; see
that doc's §2.1 for the full three-way comparison and reasoning).

This doc covers what that decision requires changing in **this** repo: the org-facing UI in
`frontend/app/org/settings/page.tsx` currently implies a self-serve flow that doesn't actually work,
and the backend is missing one field needed to communicate verification failures back to the org.

## 1. The current UX gap

Read `PayoutsTabContent` in `frontend/app/org/settings/page.tsx` end to end. Today:

1. Org admin fills "Payout Contact & Account Details" (name, email, phone) → `POST /payout-accounts/setup`
   → row created, `status: PENDING`.
2. The page immediately shows a second card: "Razorpay Linked Account ID — Attach your Razorpay
   Linked Account ID (`acc_...`) from your Razorpay Dashboard (Route → Linked Accounts)."

Step 2 is the problem. It's written as if the org admin can go create their own Route Linked Account
and come back with an ID — but per the product's own design (`razorpay-route-payout-spec.md` §1),
**orgs don't have a Razorpay account or dashboard access at all.** Only QuizBuzz's Razorpay account
can create Linked Accounts under it. So every org that reaches step 2 hits a dead end: there is no
`acc_...` for them to have, and the UI never tells them that, or what actually happens next. This is
the exact gap flagged in review — the current flow is neither fully manual (no queue, no visibility
for billing ops, no "we'll contact you" messaging) nor fully self-serve (can't actually complete
KYC in the app).

## 2. Required frontend changes (`frontend/app/org/settings/page.tsx`)

### 2.1 Rewrite the "Payout Contact & Account Details" form copy

This is a **request**, not a self-serve connection. Change:

- Card description from "Enter primary business details for receiving Route transfers" to
  something like: *"Tell us who to contact to set up payouts. Our billing team will reach out to
  complete verification with Razorpay — you won't need to do anything else here."*
- Submit button copy from "Save Details" to **"Request Payout Setup"** — sets the right expectation
  that this triggers a human process, not an instant activation.

### 2.2 Add real status-specific messaging

Replace the current two-state (`isActive` / not) status card with one branch per
`PayoutAccountStatus`:

- **`PENDING` (just submitted, most common state):**
  *"Your request has been received. Our billing team will contact you at `{accountEmail}` /
  `{contactNumber}` within 1–2 business days to collect the remaining details Razorpay requires
  (business KYC, bank account) and complete verification. You don't need to do anything further —
  we'll email you once payouts are active."*
  This is the single most important copy change in this doc — it's the direct answer to "will the
  user just see nothing and wonder what happened," which is the actual current behavior.

- **`VERIFICATION_FAILED`:**
  Show `account.statusReason` if present (§3 below adds this field); fall back to:
  *"We couldn't verify your payout account. Our billing team will contact you shortly to resolve
  this — or reach out to `support@quizbuzz.com` if you'd like to follow up sooner."*
  Never expose raw Razorpay error payloads here — `statusReason` should be the human-written reason
  a billing admin typed into the ops dashboard's status-change form (`api-payouts.md` #5's `reason`
  field), not a raw API error string.

- **`DISABLED`:**
  *"Payouts are currently disabled for your organization. Contact `support@quizbuzz.com` for
  details."* Keep this distinct from a suspended-organization message — disabling payouts doesn't
  mean the org itself is suspended (per the existing ops guide's own note that these are
  independent flags).

- **`ACTIVE`:** unchanged, already correct.

### 2.3 Remove the self-serve "Attach & Activate" box from the default view

The "Razorpay Linked Account ID" card (lines ~882–905 today) should not be a normal part of the org
admin's flow, since under Approach A they will never independently have an `acc_...` id to paste —
the billing admin attaches it from the ops dashboard instead (already planned in the ops-next repo's
`payouts.repository`/`link` endpoint work). Two options, pick one:

- **(Recommended) Remove it entirely from this page.** The ops-side `PATCH .../payout-account/link`
  endpoint is the real path now; there's no legitimate reason for an org admin to have an
  `acc_...` id in hand under the manual model. Keep the org-facing `PATCH /payout-accounts/link`
  backend endpoint itself intact (harmless, and avoids an unnecessary breaking API change), just
  drop the frontend entry point.
- **(Alternative, if you want to keep an escape hatch)** Move it behind a collapsed "Advanced" /
  "I already have a Linked Account ID" disclosure, off by default, for the edge case of an org that
  was onboarded some other way. Only worth doing if you expect that case to actually happen.

Recommendation: remove it (first option) — simpler, and consistent with "orgs don't bring their own
Razorpay account" being a hard product decision, not a soft default.

## 3. Backend change: `statusReason` field

`OrganizationPayoutAccount` currently has no field for *why* a status changed — only `status` itself.
The ops dashboard's `PATCH .../payout-account/status` endpoint (per `api-payouts.md` #5) already
accepts a `reason` in its request body, but that reason today only lands in ops's own
`PlatformAuditLog.metadata` — it never reaches this app's database, so §2.2's `VERIFICATION_FAILED`
messaging has nothing real to read.

### 3.1 Schema change — done 2026-07-21

```prisma
model OrganizationPayoutAccount {
  // ...existing fields...
  statusReason String?   // human-readable reason for current status, set on VERIFICATION_FAILED/DISABLED
}
```

Migration applied locally: `20260721161901_add_payout_account_status_reason`. Also updated
`payout.types.ts`'s `PayoutAccountResponse` interface to include `statusReason: string | null` for
type accuracy (the controller already returned it automatically — no allowlist/pick anywhere in
`payout.repository.ts` — this was just a stale type, not a behavior gap).

### 3.2 Grant coordination with ops — done 2026-07-21

Landed as an actual runnable script in the ops repo:
`quizbuzz-ops-next/prisma/grants/001_quizbuzz_ops_reader.sql`. Tested against a local copy of this
database — `statusReason` is included in the `organization_payout_accounts` `UPDATE` grant alongside
`status`/`razorpayLinkedAccountId`/`activatedAt`, verified column-by-column via
`information_schema.column_privileges`. Still needs to be run against the real (non-local) database
by whoever holds superuser credentials there.

One incidental find while wiring this up: `quizbuzz-ops-next`'s own docs previously flagged the
`planStaus` column-name typo as an unresolved open decision — it's already fixed here (the column is
`planStatus`). No action needed in this repo; noted so the ops-side docs get corrected too.

### 3.3 Expose it in the response — confirmed, no change needed

`GET /payout-accounts/account` (`payout.service.ts:getPayoutAccount`) returns the full `account` row
from Prisma — the column comes through automatically now that it exists in the schema.

## 4. Non-goals for this round

- Real-time sync of "billing admin has already called this org" back into the main app. That state
  lives in ops's own `OrganizationNote` (ops DB, not shared with the main app) — per the ops-next
  plan's §3.2.1, and per this product's DB-ownership boundary (main app doesn't read `quizbuzz_ops`).
  The `PENDING` copy in §2.2 is written to be accurate whether or not contact has already happened,
  so this isn't needed for correctness, just for a slightly richer status. Skip it.
- Building Approach B or C (§2.1 of the ops-next doc). Not in scope here.
- Any change to `payout.service.ts`'s `API`-mode code path (the field-completeness bugs flagged
  separately) — unrelated to this UX work, since `MANUAL` mode never executes that code.

## 5. Implementation order — all done 2026-07-21

1. ~~Prisma migration for `statusReason`~~ — done (§3.1).
2. ~~Coordinate the grant addition with the ops-next team~~ — done (§3.2), script written and tested,
   real-database application still pending on infra access.
3. ~~Frontend copy changes (§2.1, §2.2)~~ — done. `PayoutsTabContent` in
   `frontend/app/org/settings/page.tsx` now branches on all four `PayoutAccountStatus` values with
   the copy drafted in §2.2 ("Request Payout Setup" / "we'll contact you" language for `PENDING`,
   `statusReason`-aware messaging for `VERIFICATION_FAILED`, dedicated `DISABLED` state).
4. ~~Remove the Attach & Activate box~~ — done (§2.3). Removed from the page entirely, including its
   `linkedAccountIdInput` state and submit handler; the `PATCH /payout-accounts/link` backend
   endpoint itself was left untouched, still reachable directly, per the "keep the escape hatch"
   reasoning in §2.3.

`npx tsc --noEmit` clean on both `frontend/` and `backend/` after all changes — no new type errors
introduced.

## 6. Testing

Typecheck-verified; UI not yet exercised in a browser against a real org session (would need an org
admin login flow, out of scope for this pass — the ops-next side of this work *was* browser-verified,
see the companion doc §6 in that repo).

Still to do when someone has an org session available:
- Manual: submit the setup form as a fresh org, confirm the new `PENDING` copy renders with the
  submitted email/phone interpolated correctly.
- Manual: use the ops dashboard's status-change endpoint (once `server/features/payouts/` is built —
  see the companion doc's §6 item 3) to set `VERIFICATION_FAILED` with a `reason`, confirm it
  round-trips to `statusReason` in the main DB and renders in this app's Settings page.
- Confirm the org-facing `PATCH /payout-accounts/link` endpoint still works if hit directly (e.g.
  via API client / Postman) even though its UI entry point is removed — it shouldn't 404 or break,
  just no longer be reachable from the default page flow.
