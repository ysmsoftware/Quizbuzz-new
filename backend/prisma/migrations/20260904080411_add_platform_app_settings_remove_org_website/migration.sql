/*
  Warnings:

  - You are about to drop the column `website` on the `organizations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "website";

-- CreateTable
CREATE TABLE "platform_app_settings" (
    "id" TEXT NOT NULL DEFAULT 'app_settings_default',
    "appLogoUrl" TEXT,
    "appLogoKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_app_settings_pkey" PRIMARY KEY ("id")
);
