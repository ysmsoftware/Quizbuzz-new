-- AlterTable
ALTER TABLE "platform_colleges" ADD COLUMN     "city" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "state" TEXT;

-- CreateIndex
CREATE INDEX "platform_colleges_state_idx" ON "platform_colleges"("state");
