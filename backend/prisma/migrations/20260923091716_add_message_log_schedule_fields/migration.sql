-- AlterTable
ALTER TABLE "message_logs" ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ADD COLUMN     "statusReason" TEXT;
