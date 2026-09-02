-- AlterTable
ALTER TABLE "contests" ADD COLUMN     "registrationFields" JSONB;

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "customFields" JSONB;

-- AlterTable
ALTER TABLE "prizes" ADD COLUMN     "goodieCashEquivalent" DECIMAL(10,2),
ADD COLUMN     "goodieLabel" TEXT;
