/*
  Warnings:

  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PayoutAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'VERIFICATION_FAILED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PayoutOnboardingMode" AS ENUM ('MANUAL', 'API');

-- CreateEnum
CREATE TYPE "RouteTransferStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'REVERSED');

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_contactId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_contestId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_participantId_fkey";

-- DropTable
DROP TABLE "Payment";

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpayStatus" TEXT,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "failureReason" TEXT,
    "webhookConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_payout_accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "razorpayLinkedAccountId" TEXT,
    "accountName" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "contactNumber" TEXT,
    "status" "PayoutAccountStatus" NOT NULL DEFAULT 'PENDING',
    "onboardingMode" "PayoutOnboardingMode" NOT NULL DEFAULT 'MANUAL',
    "activatedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_route_transfers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT NOT NULL,
    "razorpayTransferId" TEXT,
    "razorpayLinkedAccountId" TEXT,
    "grossAmount" INTEGER NOT NULL,
    "platformFeeAmount" INTEGER NOT NULL,
    "transferAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "RouteTransferStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_route_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_participantId_key" ON "payments"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpayOrderId_key" ON "payments"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpayPaymentId_key" ON "payments"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "payments_organizationId_idx" ON "payments"("organizationId");

-- CreateIndex
CREATE INDEX "payments_contactId_idx" ON "payments"("contactId");

-- CreateIndex
CREATE INDEX "payments_organizationId_contactId_idx" ON "payments"("organizationId", "contactId");

-- CreateIndex
CREATE INDEX "payments_participantId_idx" ON "payments"("participantId");

-- CreateIndex
CREATE INDEX "payments_contestId_status_idx" ON "payments"("contestId", "status");

-- CreateIndex
CREATE INDEX "payments_contestId_createdAt_idx" ON "payments"("contestId", "createdAt");

-- CreateIndex
CREATE INDEX "payments_razorpayOrderId_idx" ON "payments"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "payments_razorpayPaymentId_idx" ON "payments"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "organization_payout_accounts_organizationId_key" ON "organization_payout_accounts"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_payout_accounts_razorpayLinkedAccountId_key" ON "organization_payout_accounts"("razorpayLinkedAccountId");

-- CreateIndex
CREATE INDEX "organization_payout_accounts_status_idx" ON "organization_payout_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_route_transfers_paymentId_key" ON "payment_route_transfers"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_route_transfers_razorpayTransferId_key" ON "payment_route_transfers"("razorpayTransferId");

-- CreateIndex
CREATE INDEX "payment_route_transfers_organizationId_idx" ON "payment_route_transfers"("organizationId");

-- CreateIndex
CREATE INDEX "payment_route_transfers_status_idx" ON "payment_route_transfers"("status");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_payout_accounts" ADD CONSTRAINT "organization_payout_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_route_transfers" ADD CONSTRAINT "payment_route_transfers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_route_transfers" ADD CONSTRAINT "payment_route_transfers_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
