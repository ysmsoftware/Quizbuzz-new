-- DropIndex
DROP INDEX "payment_route_transfers_organizationId_idx";

-- DropIndex
DROP INDEX "payment_route_transfers_status_idx";

-- CreateIndex
CREATE INDEX "payment_route_transfers_organizationId_createdAt_idx" ON "payment_route_transfers"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_route_transfers_status_createdAt_idx" ON "payment_route_transfers"("status", "createdAt");
