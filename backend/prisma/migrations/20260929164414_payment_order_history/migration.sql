-- CreateTable
CREATE TABLE "payment_orders" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "razorpayPaymentId" TEXT,
    "method" TEXT,
    "failureReason" TEXT,
    "errorCode" TEXT,
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_razorpayOrderId_key" ON "payment_orders"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "payment_orders_paymentId_idx" ON "payment_orders"("paymentId");

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every payment's current order becomes its first history row.
-- (Orders already overwritten by past retries are gone from our DB; the
-- webhook/reconcile fallback on notes.participantId re-links them if they
-- ever resurface.)
INSERT INTO "payment_orders" ("id", "paymentId", "razorpayOrderId", "amount", "status", "razorpayPaymentId", "failureReason", "createdAt", "updatedAt")
SELECT
    'po_' || p."id",
    p."id",
    p."razorpayOrderId",
    p."amount",
    CASE WHEN p."status" IN ('SUCCESS', 'FAILED') THEN p."status" ELSE 'CREATED'::"PaymentStatus" END,
    p."razorpayPaymentId",
    p."failureReason",
    CASE WHEN p."attempts" > 1 THEN p."updatedAt" ELSE p."createdAt" END,
    p."updatedAt"
FROM "payments" p
WHERE p."razorpayOrderId" IS NOT NULL;
