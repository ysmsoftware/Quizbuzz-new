-- AlterTable
ALTER TABLE "contests" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "contests_organizationId_isArchived_idx" ON "contests"("organizationId", "isArchived");
