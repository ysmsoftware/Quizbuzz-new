-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "planLimitsCache" JSONB,
ADD COLUMN     "planSlug" TEXT,
ADD COLUMN     "planStaus" TEXT;
