-- DropIndex
DROP INDEX "ambassador_campaigns_contestId_key";

-- CreateIndex
CREATE INDEX "ambassador_campaigns_contestId_idx" ON "ambassador_campaigns"("contestId");
