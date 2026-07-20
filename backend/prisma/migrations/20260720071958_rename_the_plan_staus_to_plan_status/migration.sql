/*
  Warnings:

  - You are about to drop the column `planStaus` on the `organizations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "planStaus",
ADD COLUMN     "planStatus" TEXT;
