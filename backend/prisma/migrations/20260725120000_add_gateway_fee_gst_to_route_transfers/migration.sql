-- AlterTable
ALTER TABLE "payment_route_transfers" ADD COLUMN "gatewayFeeAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payment_route_transfers" ADD COLUMN "gstAmount" INTEGER NOT NULL DEFAULT 0;
