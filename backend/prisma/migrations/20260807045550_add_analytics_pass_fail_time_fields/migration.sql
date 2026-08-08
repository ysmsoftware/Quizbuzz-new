-- AlterTable
ALTER TABLE "contest_analytics_snapshots" ADD COLUMN     "failingCount" INTEGER,
ADD COLUMN     "fastestTimeSecs" INTEGER,
ADD COLUMN     "passingCount" INTEGER,
ADD COLUMN     "slowestTimeSecs" INTEGER;
