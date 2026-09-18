-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "disqualificationReason" TEXT,
ADD COLUMN     "disqualifiedAt" TIMESTAMP(3);
