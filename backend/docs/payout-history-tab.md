# Main App — Organization Payout History Tab

Repo: `Quizbuzz-new`
Audience: engineer implementing this in the org-facing app.

## Context

Confirmed flow: an org must link a Razorpay account (via Settings → Payouts → "Request Payout Setup") before it can run a paid contest — unpaid/free contests work regardless. Once billing ops manually links the account and flips status to `ACTIVE`, the org can accept payments and the queue-based reserve transfer starts moving money to them per payment. Right now the org has **no way to see any of that history** — no transaction list, no amounts, no fee breakdown, nothing. This doc covers closing that specific gap. It does not touch the account-setup/status UI, which already works.

Everything below is additive to code that already exists — the data is already recorded (`PaymentRouteTransfer` rows with full fee breakdown), it just isn't returned or rendered anywhere on the org side.

## 1. Database migration

`backend/prisma/schema.prisma` — `PaymentRouteTransfer` model currently has:
```prisma
@@index([organizationId])
@@index([status])
```
Replace with:
```prisma
@@index([organizationId, createdAt])
@@index([status, createdAt])
```
Every list view (org history, ops ledger) filters then sorts by `createdAt` — the current indexes don't cover the sort. Run as a standard additive migration (`prisma migrate dev` → generates a new migration file under `backend/prisma/migrations/`). Safe online, no data change, no downtime.

## 2. Backend changes (`backend/src/modules/payout/`)

**`payout.types.ts`**
Add a response type for a single transfer row that includes the full breakdown (not just net amount):
```ts
export interface PayoutTransferItem {
  id: string;
  contestTitle: string;
  grossAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  gatewayFeePercent: number;
  gatewayFeeAmount: number;
  gstPercent: number;
  gstAmount: number;
  totalDeducted: number;
  transferAmount: number; // net amount received
  currency: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'REVERSED';
  failureReason: string | null;
  razorpayTransferId: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface PayoutTransferSummary {
  processed: number;
  pending: number;
  failed: number;
  totalReceivedAllTime: number;
  currency: string;
}
```

**`payout.validator.ts`**
Add a query schema for the list endpoint:
```ts
export const listTransfersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(config.payout.maxPageSize).default(20),
  status: z.enum(['all', 'PENDING', 'PROCESSED', 'FAILED', 'REVERSED']).default('all'),
});
```
Add `maxPageSize` (e.g. `PAYOUT_MAX_PAGE_SIZE`) to `config.payout` in `backend/src/config/index.ts`, sourced from env — do not hardcode the cap inline per the project's config rules.

**`payout.repository.ts`**
Change `listTransfersByOrgId` from a flat `take: limit` to paginated + filtered:
```ts
async listTransfersByOrgId(
  organizationId: string,
  params: { page: number; limit: number; status: string }
): Promise<{ rows: PaymentRouteTransfer[]; total: number }> {
  const where = {
    organizationId,
    ...(params.status !== 'all' && { status: params.status as RouteTransferStatus }),
  };
  const [rows, total] = await Promise.all([
    prisma.paymentRouteTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: { payment: { include: { contest: { select: { title: true } } } } },
    }),
    prisma.paymentRouteTransfer.count({ where }),
  ]);
  return { rows, total };
}
```
Add `getTransferSummaryByOrgId(organizationId)` — same aggregate pattern as the ops repository's `getOrganizationTransferSummary` (COUNT by status, SUM of `transferAmount` where `status = 'PROCESSED'`), just querying via Prisma instead of raw SQL since this lives in the main app.

**`payout.service.ts`**
- `listTransfers(organizationId, params)` — calls the repo, maps each row to `PayoutTransferItem`. Reconstruct the percentages from stored amounts and `config.payout.*Percent` (same values `computeFeeBreakdown` already uses), so the UI can show "Commission (8%): ₹40" not just "₹40".
- Add `getTransferSummary(organizationId)` — wraps the new repo method, returns `PayoutTransferSummary`.

**`payout.controller.ts`**
- Update `listTransfers` to pass `req.query` through the new validator and paginated service call.
- Add `getTransferSummary` controller method.

**`payout.routes.ts`**
```ts
payoutRouter.get("/transfers", authenticatedOrgMiddleware, (req, res, next) => ctrl().listTransfers(req, res, next));
payoutRouter.get("/summary", authenticatedOrgMiddleware, (req, res, next) => ctrl().getTransferSummary(req, res, next));
```
No change to auth — `organizationId` continues to come from `req.user`, never from the request. This is already correct; don't let the new query params introduce an org id override.

## 3. Frontend changes

**`frontend/lib/api/payout.api.ts`**
```ts
export async function listPayoutTransfers(params: { page: number; limit: number; status: string }): Promise<ApiResponse<PayoutTransferItem[]>> {
  return get(`/payout-accounts/transfers?page=${params.page}&limit=${params.limit}&status=${params.status}`);
}
export async function getPayoutSummary(): Promise<ApiResponse<PayoutTransferSummary>> {
  return get('/payout-accounts/summary');
}
```

**`frontend/lib/hooks/use-payout.ts`**
- Change `transfersQuery` to accept `{ page, status }` args and pass through to `listPayoutTransfers` (it currently calls the old unparameterized endpoint and is never consumed — that's exactly what you're fixing).
- Add a `summaryQuery` using `getPayoutSummary`.

**`frontend/app/org/settings/page.tsx` → `PayoutsTabContent`**
Below the existing "Payout Account Status" card, add:
1. **KPI row** (4 cards, same visual pattern as the rest of the settings page): Total Received, Processed, Pending, Failed — from `summaryQuery`. Only render once `hasAccount && isActive` (or has at least one transfer) — an org that never linked an account has nothing to show here.
2. **Ledger table**: columns Date, Contest, Gross, Commission, Gateway Fee, GST, **Net Received**, Status, Transfer ID. Status badge styling can reuse the same color mapping already used for account status (`ACTIVE` green / `PENDING` amber / `FAILED` rose). Show `failureReason` under the status badge for failed rows, in plain language.
3. **Status filter dropdown** + **pagination controls** (page/limit), wired to `transfersQuery`.
4. **Empty state**: "No payouts yet — this will populate once your first paid contest closes registrations and a transfer is processed."

This table is a near-direct port of `OrgPayoutAccountTab.tsx` from the ops-next repo (same columns, same data shape, same status coloring) — that component already exists and works, so treat it as the reference implementation rather than designing from scratch.

## 4. Acceptance criteria

- An org with `ACTIVE` payout status and at least one processed transfer can see, without contacting support: the exact amount received per payment, the commission/gateway fee/GST deducted, the transfer status, and the transfer ID.
- An org with no linked account yet still sees the setup/status flow exactly as today (no regression), plus an empty payout history state.
- Pagination and status filtering work correctly past 20+ transfer rows (seed test data).
- An org authenticated as Org A cannot retrieve Org B's transfers or summary via the new endpoints (negative test — confirm `organizationId` is never accepted from query/body).

## 5. Out of scope for this doc

Anything in the ops dashboard (account-linking queue, cross-org ledger, queue health) — see the companion doc for `quizbuzz-ops-next`.
