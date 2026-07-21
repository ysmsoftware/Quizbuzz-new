# Razorpay Route Payout — Technical Spec

Milestone before Phase 3 (ops billing/audit). Grounded in the actual code at
`Quizbuzz-new` (read on 2026-07-21): `payment.routes/controller/service/repository/types/validator.ts`,
`razorpay.provider.ts`, `container.ts`, `config/index.ts`, `prisma/schema.prisma`, and the org
settings / create-contest frontend pages. Also checked `quizbuzz-ops-next` — it currently reads
`Payment` rows directly via raw SQL for the Billing view and has no payout/linked-account concept,
so nothing here conflicts with Phase 3.

## 1. Decision recap

Org does **not** bring their own Razorpay keys. QuizBuzz keeps collecting payments through its own
Razorpay account; each org is a **Route Linked Account** (a payout recipient), and after a payment is
captured, a **Transfer** moves the org's share to their linked account. Razorpay owns bank/KYC
verification and secrets. QuizBuzz stores only `razorpayLinkedAccountId`, status, and audit metadata.

Product wording: "Payout Setup" / "Connect payouts" / "Enable paid contest payouts". Never "Connect
your Razorpay account".

## 2. Verified SDK surface (razorpay@2.9.6, installed in `backend/node_modules`)

- `razorpay.payments.transfer(paymentId, { transfers: [{ account, amount, currency, notes }] })` — Razorpay Route "Create Transfers from Payments" API (`POST /v1/payments/{payment_id}/transfers`). Binds the transfer directly to the captured `razorpayPaymentId`.
  Works as soon as Route is enabled on the primary account and a valid linked `account_id` exists.
  No partner approval needed for this call.
- `razorpay.accounts.create(...)` — **exists in the SDK but its doc reference is
  `partners/account-onboarding`**, i.e. it's the Partner/sub-merchant onboarding surface, not plain
  Route. In practice this usually requires Razorpay Partner approval on the account, which test-mode
  keys alone don't guarantee.

This is the one real unknown in this plan: we don't yet know if your Razorpay test account has
Partner/Route account-creation API access enabled, only that you have test keys. Everything below is
designed so that uncertainty doesn't block anything — Linked Account creation defaults to a
**manual/dashboard** path, and only the **transfer** step (which we're fairly confident works) is
automated behind the webhook.

## 3. Prisma schema additions

Two new models, following the existing conventions (`ulid()` ids, `Int` paise amounts, `Json?`
metadata, `@@map` snake_case tables):

```prisma
enum PayoutAccountStatus {
  PENDING
  ACTIVE
  VERIFICATION_FAILED
  DISABLED
}

enum PayoutOnboardingMode {
  MANUAL   // admin creates Linked Account in Razorpay Dashboard, we just store the id
  API      // we call accounts.create() directly (only if Partner access is confirmed working)
}

enum RouteTransferStatus {
  PENDING
  PROCESSED
  FAILED
  REVERSED
}

model OrganizationPayoutAccount {
  id                      String                @id @default(ulid())
  organizationId          String                @unique
  razorpayLinkedAccountId String?                @unique
  accountName             String
  accountEmail            String
  contactNumber           String?
  status                  PayoutAccountStatus   @default(PENDING)
  onboardingMode          PayoutOnboardingMode  @default(MANUAL)
  activatedAt             DateTime?
  metadata                Json?
  createdAt               DateTime              @default(now())
  updatedAt               DateTime              @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([status])
  @@map("organization_payout_accounts")
}

model PaymentRouteTransfer {
  id                      String               @id @default(ulid())
  organizationId          String
  paymentId               String               @unique  // one transfer attempt per payment (idempotency)
  razorpayPaymentId       String
  razorpayTransferId      String?              @unique
  razorpayLinkedAccountId String
  grossAmount             Int                  // paise
  platformFeeAmount       Int                  // paise
  transferAmount          Int                  // paise
  currency                String               @default("INR")
  status                  RouteTransferStatus  @default(PENDING)
  failureReason           String?
  processedAt             DateTime?
  metadata                Json?
  createdAt               DateTime             @default(now())
  updatedAt               DateTime             @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  payment      Payment      @relation(fields: [paymentId], references: [id])

  @@index([organizationId])
  @@index([status])
  @@map("payment_route_transfers")
}
```

Add relations to existing models:

```prisma
model Organization {
  // ...existing fields...
  payoutAccount   OrganizationPayoutAccount?
  routeTransfers  PaymentRouteTransfer[]
}

model Payment {
  // ...existing fields...
  routeTransfer   PaymentRouteTransfer?
}
```

Migration: `npx prisma migrate dev --name add_razorpay_route_payout`.

## 4. Config additions (`backend/src/config/index.ts`)

New env vars, added to `envSchema` next to the existing `PAYMENT` block:

```ts
RAZORPAY_ROUTE_ENABLED: z.coerce.boolean().default(false),
RAZORPAY_ROUTE_ONBOARDING_MODE: z.enum(["MANUAL", "API"]).default("MANUAL"),
PLATFORM_COMMISSION_PERCENT: z.coerce.number().min(0).max(100).default(10),
```

Exported as:

```ts
payout: {
  enabled: env.RAZORPAY_ROUTE_ENABLED,
  onboardingMode: env.RAZORPAY_ROUTE_ONBOARDING_MODE,
  commissionPercent: env.PLATFORM_COMMISSION_PERCENT,
},
```

No hardcoded commission or feature-flag values in service code — matches the QuizBuzz rule against
magic numbers.

## 5. Backend module: `backend/src/modules/payout/`

Mirrors the `payment` module's shape exactly:

```
payout.routes.ts
payout.controller.ts
payout.service.ts
payout.repository.ts          -- OrganizationPayoutAccount CRUD
route-transfer.repository.ts  -- PaymentRouteTransfer CRUD
payout.types.ts
payout.validator.ts
```

### Routes (`payout.routes.ts`), mounted as `apiRouter.use("/payout-accounts", payoutRouter)` in `routes.ts`

```
POST   /payout-accounts/setup              authenticatedOrgMiddleware, idempotency  -> setupPayoutAccount
GET    /payout-accounts/:orgId             authenticatedOrgMiddleware               -> getPayoutAccount
PATCH  /payout-accounts/:orgId/link        authenticatedOrgMiddleware               -> attachLinkedAccount
GET    /payout-accounts/:orgId/transfers   authenticatedOrgMiddleware               -> listTransfers
```

Same lazy `function ctrl() { return require("../../container").payoutController; }` pattern used by
`payment.routes.ts`, for the same circular-import reason documented there.

### Service logic

- `setupPayoutAccount(organizationId, input)`: upserts `OrganizationPayoutAccount` with status
  `PENDING`. If `config.payout.onboardingMode === "API"` and Route API access is confirmed to work
  (see testing plan, step 1), attempt `razorpay.createLinkedAccount(...)` and store the returned id;
  otherwise leave `razorpayLinkedAccountId` null and status `PENDING`, waiting on step below.
- `attachLinkedAccount(organizationId, razorpayLinkedAccountId)`: the manual-mode escape hatch —
  once someone (you, as admin, for now) creates the Linked Account in the Razorpay Dashboard, this
  endpoint records the id and flips status to `ACTIVE`. This is what unblocks paid contests in the
  MANUAL path.
- `getPayoutStatus(organizationId)`
- `createRouteTransferForPayment(payment: Payment)`: called from `PaymentService.handleWebhook` right
  after a payment is marked `SUCCESS`. Idempotent via the `paymentId @unique` constraint on
  `PaymentRouteTransfer` — a second call for the same payment is a no-op.
  - If no `ACTIVE` payout account exists for `payment.organizationId`: write a `PENDING`
    `PaymentRouteTransfer` row with `failureReason: "no_active_payout_account"` and return. **Does not
    throw** — the webhook must still return 200 to Razorpay regardless.
  - Otherwise: `grossAmount = payment.amount`, `platformFeeAmount = round(grossAmount *
    commissionPercent / 100)`, `transferAmount = grossAmount - platformFeeAmount`. Call
    `razorpay.createTransfer({ razorpayPaymentId, account: linkedAccountId, amount: transferAmount,
    currency, notes: { paymentId, organizationId } })`. Store `PROCESSED` with `razorpayTransferId` on
    success, `FAILED` with `failureReason` on error (network/API errors are caught, logged, and leave
    the row `PENDING` so a retry job can pick it up later — not designed in this pass, noted as a gap).

### `RazorpayProvider` extension (`providers/razorpay.provider.ts`)

Two new methods added to the existing class (not a new provider — keeps one Razorpay surface, per
existing pattern):

```ts
async createLinkedAccount(params: {
  email: string; phone: string; legal_business_name: string; business_type: string;
  contact_name: string; profile: Accounts.Profile;
}) {
  return this.client.accounts.create(params);
}

async createPaymentTransfer(params: {
  razorpayPaymentId: string;
  account: string;
  amount: number;
  currency: string;
  notes?: Record<string, string | number>;
}) {
  return this.client.payments.transfer(params.razorpayPaymentId, {
    transfers: [
      {
        account: params.account,
        amount: params.amount,
        currency: params.currency,
        ...(params.notes && { notes: params.notes }),
      },
    ],
  });
}
```

### Contest publish gate (tweak to existing `ContestService`)

When `paymentEnabled: true` on contest create/update, check the org's payout account status is
`ACTIVE`; if not, throw `BadRequestError("Set up payouts before enabling paid registration for this contest")`.
This is the one behavior change to the *existing* payment-adjacent flow — everything else about
`payment.service.ts` (`createOrder`, `verifyPayment`, `retryPayment`, `cancelPayment`) is untouched.
Only `handleWebhook`'s `payment.captured` branch gets one new line calling
`payoutService.createRouteTransferForPayment(payment)`.

## 6. Frontend

### Org Settings — new "Payouts" tab

`frontend/app/org/settings/page.tsx` currently has a 3-column `TabsList` (General / Profile Details /
Appearance). Add a 4th tab, same `Card`-based layout as the existing tabs:

- Status badge: `PENDING` (gray), `ACTIVE` (green), `VERIFICATION_FAILED` (red), `DISABLED` (gray).
- Form fields: account name, account email, contact number (matches `OrganizationPayoutAccount`).
- Copy: "Payout Setup" header, "Add payout account" button, helper text: "We'll set up secure payouts
  to your bank account through Razorpay. QuizBuzz never sees your bank details." No mention of
  "Razorpay account" or API keys anywhere in the UI.
- New hook `usePayout(orgId)` in `lib/hooks/`, following the same shape as `useOrganization`
  (`org`, `loading`, `error`, mutation objects using the existing query-client pattern already used
  by `updateOrgMutation`).

### Create Contest — Step 3 (Pricing & Prizes)

`frontend/app/org/contests/create/page.tsx`, right above the "Enable Paid Registration" `Switch`
(around line 782): if payout status isn't `ACTIVE`, show an inline `Alert` — "Set up payouts before
enabling paid registration" with a link to `/org/settings?tab=payouts` — and disable the switch. This
mirrors the backend gate so the org isn't surprised by a 400 on submit.

## 7. Testing plan (you have Razorpay test-mode keys)

1. **Confirm which onboarding mode actually works.** In the Razorpay Dashboard (test mode), check
   Settings → Route / Linked Accounts. If you can create a Linked Account there manually, that
   confirms Route is enabled on the test account — proceed with `MANUAL` mode for now regardless
   (safest default). Separately, try calling `accounts.create()` against the test key from a scratch
   script; if it succeeds, `API` mode is viable later.
2. Create one test Linked Account (via Dashboard) for a test organization, note its `acc_...` id.
3. Run the migration, wire the module, deploy locally with `MOCK_PAYMENT` off and real test keys.
4. Call `PATCH /payout-accounts/:orgId/link` with that `acc_...` id → confirm status flips to `ACTIVE`.
5. Create a paid contest for that org (now unblocked since payout is `ACTIVE`).
6. Register a participant, pay with a Razorpay test card/UPI.
7. Confirm existing behavior is unchanged: `Payment.status → SUCCESS`, participant
   `PENDING_PAYMENT → REGISTERED`, confirmation email enqueued.
8. Confirm a new `PaymentRouteTransfer` row appears with `status: PROCESSED` and a real
   `razorpayTransferId`.
9. Idempotency check: manually replay the same `payment.captured` webhook payload — no duplicate
   transfer should be created (unique `paymentId` constraint should reject/no-op it).
10. Failure path: repeat steps 5–7 for an org with no `ACTIVE` payout account (should be blocked at
    step 5 by the contest-publish gate — also directly unit-test `createRouteTransferForPayment`
    against an org with `PENDING` status to confirm it writes a `PENDING` transfer row and doesn't throw).
11. Refunds/reversals: explicitly deferred to Phase 3 (billing depth / audit trail), not in this
    milestone.

## 8. Open questions / risks

- Whether `accounts.create()` works on your test key without additional Razorpay Partner approval —
  won't know until step 1 of testing. Doesn't block anything since `MANUAL` mode is the default.
- `PLATFORM_COMMISSION_PERCENT` is currently modeled as one global config value, not per-org. Flag if
  you need per-org negotiated commission rates — that would move the field onto
  `OrganizationPayoutAccount` instead of config.
- Retry/backoff for a `FAILED` transfer (e.g. Razorpay API timeout) isn't designed here — worth a
  BullMQ job in Phase 3 once ops-side audit trail exists to drive manual re-triggers.
- Currency is assumed INR throughout (matches Razorpay's own restriction — Route only supports INR).
