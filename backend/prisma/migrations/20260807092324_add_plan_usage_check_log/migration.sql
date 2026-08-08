-- CreateTable
CREATE TABLE "plan_usage_check_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "limitType" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "limitValue" INTEGER,
    "currentValue" INTEGER NOT NULL,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_usage_check_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_usage_check_logs_organizationId_limitType_createdAt_idx" ON "plan_usage_check_logs"("organizationId", "limitType", "createdAt");

-- CreateIndex
CREATE INDEX "plan_usage_check_logs_outcome_createdAt_idx" ON "plan_usage_check_logs"("outcome", "createdAt");

-- AddForeignKey
ALTER TABLE "plan_usage_check_logs" ADD CONSTRAINT "plan_usage_check_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
