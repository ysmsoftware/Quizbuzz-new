-- CreateEnum
CREATE TYPE "CheckpointStatus" AS ENUM ('OK', 'ERROR');

-- CreateTable
CREATE TABLE "job_checkpoints" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "requestId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "stage" TEXT NOT NULL,
    "status" "CheckpointStatus" NOT NULL DEFAULT 'OK',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_checkpoints_jobId_idx" ON "job_checkpoints"("jobId");

-- CreateIndex
CREATE INDEX "job_checkpoints_requestId_idx" ON "job_checkpoints"("requestId");

-- CreateIndex
CREATE INDEX "job_checkpoints_queue_stage_createdAt_idx" ON "job_checkpoints"("queue", "stage", "createdAt");
