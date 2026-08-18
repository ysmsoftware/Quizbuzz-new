-- CreateTable
CREATE TABLE "participant_progress_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "questionOrder" JSONB,
    "currentQuestion" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "violationCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "contestEndTime" TIMESTAMP(3),
    "lastSnapshotAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_progress_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "participant_progress_snapshots_participantId_key" ON "participant_progress_snapshots"("participantId");

-- CreateIndex
CREATE INDEX "participant_progress_snapshots_contestId_idx" ON "participant_progress_snapshots"("contestId");

-- CreateIndex
CREATE INDEX "participant_progress_snapshots_organizationId_idx" ON "participant_progress_snapshots"("organizationId");

-- AddForeignKey
ALTER TABLE "participant_progress_snapshots" ADD CONSTRAINT "participant_progress_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
