/*
  Warnings:

  - The values [ACTIVE] on the enum `AmbassadorCampaignStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AmbassadorCampaignStatus_new" AS ENUM ('DRAFT', 'PUBLISHED', 'LIVE', 'ENDED', 'ARCHIVED');
ALTER TABLE "public"."ambassador_campaigns" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ambassador_campaigns" ALTER COLUMN "status" TYPE "AmbassadorCampaignStatus_new" USING ("status"::text::"AmbassadorCampaignStatus_new");
ALTER TYPE "AmbassadorCampaignStatus" RENAME TO "AmbassadorCampaignStatus_old";
ALTER TYPE "AmbassadorCampaignStatus_new" RENAME TO "AmbassadorCampaignStatus";
DROP TYPE "public"."AmbassadorCampaignStatus_old";
ALTER TABLE "ambassador_campaigns" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "ambassador_campaigns" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "wizardStep" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "contestId" DROP NOT NULL,
ALTER COLUMN "ambassadorTypesAllowed" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "rewardConfig" SET DEFAULT '{}',
ALTER COLUMN "status" SET DEFAULT 'DRAFT';
