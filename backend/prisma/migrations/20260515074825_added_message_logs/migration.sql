/*
  Warnings:

  - The values [REGISTRATION_CONFIRMATION,PAYMENT_CONFIRMATION,REMINDER_24H,REMINDER_1H,CONTEST_STARTED,CONTEST_ENDED,CERTIFICATE_READY] on the enum `MessageTemplate` will be removed. If these variants are still used in the database, this will fail.
  - The values [AUDIO_DETECTED,COPY_PASTE_DETECTED] on the enum `ViolationType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `totalEvents` on the `proctoring_scores` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[participantId,contestId]` on the table `proctoring_scores` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MessageTemplate_new" AS ENUM ('OTP_VERIFICATION_CODE', 'BIRTHDAY_WISHES_YSM', 'FEEDBACK_COLLECTION_MESSAGE', 'CERTIFICATE_ISSUED', 'REGISTRATION_SUCCESSFUL', 'WORKSHOP_REMINDER_MESSAGE', 'PAYMENT_CONFIRMATION_MESSAGE', 'EMAIL_VERIFICATION', 'PASSWORD_RESET', 'ORG_INVITE', 'DISQUALIFICATION_NOTICE', 'RESULTS_PUBLISHED', 'CUSTOM');
ALTER TYPE "MessageTemplate" RENAME TO "MessageTemplate_old";
ALTER TYPE "MessageTemplate_new" RENAME TO "MessageTemplate";
DROP TYPE "public"."MessageTemplate_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ViolationType_new" AS ENUM ('FACE_NOT_DETECTED', 'MULTIPLE_FACES', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'AUDIO_ANOMALY', 'POOR_LIGHTING', 'GAZE_AWAY', 'WINDOW_BLUR', 'SCREEN_RESIZE', 'SNAPSHOT_START', 'SNAPSHOT_MID_POINT', 'SNAPSHOT_RANDOM', 'SNAPSHOT_PRE_SUBMIT');
ALTER TABLE "proctoring_events" ALTER COLUMN "type" TYPE "ViolationType_new" USING ("type"::text::"ViolationType_new");
ALTER TYPE "ViolationType" RENAME TO "ViolationType_old";
ALTER TYPE "ViolationType_new" RENAME TO "ViolationType";
DROP TYPE "public"."ViolationType_old";
COMMIT;

-- DropIndex
DROP INDEX "proctoring_scores_participantId_key";

-- AlterTable
ALTER TABLE "message_logs" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "proctoring_scores" DROP COLUMN "totalEvents",
ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "totalViolations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trustScore" DECIMAL(5,2) NOT NULL DEFAULT 100;

-- CreateIndex
CREATE UNIQUE INDEX "proctoring_scores_participantId_contestId_key" ON "proctoring_scores"("participantId", "contestId");
