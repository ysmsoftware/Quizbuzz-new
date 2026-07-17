-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('NOT_STARTED', 'IDENTITY', 'USE_CASE', 'ATTRIBUTION', 'CONTACT_LOCALE', 'PLAN_SELECTION', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OrgPrimaryUseCase" AS ENUM ('EDUCATIONAL_INSTITUTION', 'COACHING_INSTITUTE', 'CORPORATE_TRAINING', 'RECRUITMENT_ASSESSMENT', 'INDIVIDUAL_EDUCATOR', 'COMMUNITY_CLUB', 'PERSONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "OrgSizeBucket" AS ENUM ('SIZE_1', 'SIZE_2_10', 'SIZE_11_50', 'SIZE_51_200', 'SIZE_200_PLUS');

-- CreateEnum
CREATE TYPE "ExpectedContestVolume" AS ENUM ('RANGE_1_4', 'RANGE_5_20', 'RANGE_20_PLUS', 'UNSURE');

-- CreateEnum
CREATE TYPE "ExpectedParticipantVolume" AS ENUM ('RANGE_UNDER_100', 'RANGE_100_500', 'RANGE_500_2000', 'RANGE_2000_PLUS', 'UNSURE');

-- CreateEnum
CREATE TYPE "HeardAboutSource" AS ENUM ('GOOGLE_SEARCH', 'SOCIAL_MEDIA', 'LINKEDIN', 'WORD_OF_MOUTH', 'REFERRAL', 'ADVERTISEMENT', 'EVENT_CONFERENCE', 'OTHER');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingStep" "OnboardingStep" NOT NULL DEFAULT 'NOT_STARTED';

-- CreateTable
CREATE TABLE "organization_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "primaryUseCase" "OrgPrimaryUseCase",
    "useCaseOther" TEXT,
    "sizeBucket" "OrgSizeBucket",
    "expectedContestsPerMonth" "ExpectedContestVolume" NOT NULL DEFAULT 'UNSURE',
    "expectedParticipants" "ExpectedParticipantVolume" NOT NULL DEFAULT 'UNSURE',
    "heardAboutSource" "HeardAboutSource",
    "heardAboutOther" TEXT,
    "primaryContactName" TEXT,
    "primaryContactPhone" TEXT,
    "primaryContactEmail" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "timezone" TEXT,
    "preferredCurrency" TEXT NOT NULL DEFAULT 'INR',
    "gstNumber" TEXT,
    "billingAddress" TEXT,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_profiles_organizationId_key" ON "organization_profiles"("organizationId");

-- CreateIndex
CREATE INDEX "organization_profiles_primaryUseCase_idx" ON "organization_profiles"("primaryUseCase");

-- CreateIndex
CREATE INDEX "organization_profiles_sizeBucket_idx" ON "organization_profiles"("sizeBucket");

-- CreateIndex
CREATE INDEX "organization_profiles_heardAboutSource_idx" ON "organization_profiles"("heardAboutSource");

-- CreateIndex
CREATE INDEX "organizations_onboardingCompleted_idx" ON "organizations"("onboardingCompleted");

-- AddForeignKey
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
