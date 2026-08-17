/*
  Warnings:

  - You are about to drop the column `appliedAt` on the `ambassadors` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `ambassadors` table. All the data in the column will be lost.
  - You are about to drop the column `rejectionReason` on the `ambassadors` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedAt` on the `ambassadors` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedById` on the `ambassadors` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `ambassadors` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `ambassadors` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `ambassador_campaign_enrollments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ambassadors" DROP CONSTRAINT "ambassadors_organizationId_fkey";

-- DropIndex
DROP INDEX "ambassadors_organizationId_email_key";

-- DropIndex
DROP INDEX "ambassadors_organizationId_status_idx";

-- AlterTable
ALTER TABLE "ambassador_campaign_enrollments" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "AmbassadorStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ambassadors" DROP COLUMN "appliedAt",
DROP COLUMN "organizationId",
DROP COLUMN "rejectionReason",
DROP COLUMN "reviewedAt",
DROP COLUMN "reviewedById",
DROP COLUMN "status";

-- CreateIndex
CREATE INDEX "ambassador_campaign_enrollments_campaignId_status_idx" ON "ambassador_campaign_enrollments"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ambassadors_email_key" ON "ambassadors"("email");
