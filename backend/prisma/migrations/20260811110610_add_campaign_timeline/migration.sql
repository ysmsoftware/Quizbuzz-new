-- AlterTable
ALTER TABLE "ambassador_campaigns" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "phases" JSONB DEFAULT '[]',
ADD COLUMN     "startDate" TIMESTAMP(3);
