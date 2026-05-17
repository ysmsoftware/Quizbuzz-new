/*
  Warnings:

  - You are about to drop the `otp_records` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[organizationId,email]` on the table `contacts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,phone]` on the table `contacts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organizationId` to the `answers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `contacts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `contest_analytics_snapshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `contest_questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `leaderboard_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `message_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `participants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `prizes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `proctoring_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `proctoring_scores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `question_options` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `quiz_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `scheduled_jobs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `submissions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "MessageStatus" ADD VALUE 'PROCESSING';

-- DropForeignKey
ALTER TABLE "otp_records" DROP CONSTRAINT "otp_records_contactId_fkey";

-- DropIndex
DROP INDEX "contacts_email_key";

-- DropIndex
DROP INDEX "contacts_phone_key";

-- AlterTable
ALTER TABLE "answers" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "certificates" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "contest_analytics_snapshots" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "contest_questions" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "leaderboard_entries" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "message_logs" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "prizes" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "proctoring_events" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "proctoring_scores" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "question_options" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "quiz_sessions" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "scheduled_jobs" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- DropTable
DROP TABLE "otp_records";

-- CreateIndex
CREATE INDEX "answers_organizationId_idx" ON "answers"("organizationId");

-- CreateIndex
CREATE INDEX "certificates_organizationId_idx" ON "certificates"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_organizationId_email_key" ON "contacts"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_organizationId_phone_key" ON "contacts"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "contest_analytics_snapshots_organizationId_idx" ON "contest_analytics_snapshots"("organizationId");

-- CreateIndex
CREATE INDEX "contest_questions_organizationId_idx" ON "contest_questions"("organizationId");

-- CreateIndex
CREATE INDEX "leaderboard_entries_organizationId_idx" ON "leaderboard_entries"("organizationId");

-- CreateIndex
CREATE INDEX "message_logs_organizationId_idx" ON "message_logs"("organizationId");

-- CreateIndex
CREATE INDEX "participants_organizationId_idx" ON "participants"("organizationId");

-- CreateIndex
CREATE INDEX "payments_organizationId_idx" ON "payments"("organizationId");

-- CreateIndex
CREATE INDEX "prizes_organizationId_idx" ON "prizes"("organizationId");

-- CreateIndex
CREATE INDEX "proctoring_events_organizationId_idx" ON "proctoring_events"("organizationId");

-- CreateIndex
CREATE INDEX "proctoring_scores_organizationId_idx" ON "proctoring_scores"("organizationId");

-- CreateIndex
CREATE INDEX "question_options_organizationId_idx" ON "question_options"("organizationId");

-- CreateIndex
CREATE INDEX "quiz_sessions_organizationId_idx" ON "quiz_sessions"("organizationId");

-- CreateIndex
CREATE INDEX "scheduled_jobs_organizationId_idx" ON "scheduled_jobs"("organizationId");

-- CreateIndex
CREATE INDEX "submissions_organizationId_idx" ON "submissions"("organizationId");

-- AddForeignKey
ALTER TABLE "prizes" ADD CONSTRAINT "prizes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_questions" ADD CONSTRAINT "contest_questions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proctoring_events" ADD CONSTRAINT "proctoring_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proctoring_scores" ADD CONSTRAINT "proctoring_scores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_analytics_snapshots" ADD CONSTRAINT "contest_analytics_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
