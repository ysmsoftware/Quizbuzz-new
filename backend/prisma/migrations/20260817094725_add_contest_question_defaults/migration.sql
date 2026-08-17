-- AlterTable
ALTER TABLE "contests" ADD COLUMN     "defaultQuestionMarks" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "defaultQuestionNegativeMark" DECIMAL(4,2) NOT NULL DEFAULT 1.00;
