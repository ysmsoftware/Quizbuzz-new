/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,slug]` on the table `contests` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "contests_slug_idx";

-- DropIndex
DROP INDEX "contests_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "contests_organizationId_slug_key" ON "contests"("organizationId", "slug");
