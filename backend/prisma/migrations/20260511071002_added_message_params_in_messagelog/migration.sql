/*
  Warnings:

  - Changed the type of `template` on the `message_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "message_logs" ADD COLUMN     "params" JSONB,
DROP COLUMN "template",
ADD COLUMN     "template" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "message_logs_contestId_template_idx" ON "message_logs"("contestId", "template");
