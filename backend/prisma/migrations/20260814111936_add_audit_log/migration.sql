-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('ADMIN', 'PARTICIPANT', 'SYSTEM', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('ORGANIZATION', 'ADMIN', 'CONTEST', 'PARTICIPANT', 'PAYMENT', 'SUBMISSION', 'CERTIFICATE', 'QUESTION', 'MESSAGE', 'AUTH', 'SYSTEM');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "organizationId" TEXT,
    "actorId" TEXT,
    "actorType" "AuditActorType" NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" "AuditTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_requestId_idx" ON "audit_logs"("requestId");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
