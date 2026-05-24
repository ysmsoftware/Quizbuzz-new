-- AlterTable
ALTER TABLE "leaderboard_entries" ADD COLUMN     "isPassed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "isPassed" BOOLEAN;
