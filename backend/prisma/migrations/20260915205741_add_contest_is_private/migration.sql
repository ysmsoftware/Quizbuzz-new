-- AlterTable
ALTER TABLE "contests" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "contests_isDeleted_isPrivate_status_idx" ON "contests"("isDeleted", "isPrivate", "status");
