-- CreateEnum
CREATE TYPE "AmbassadorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AmbassadorCampaignStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "referredByEnrollmentId" TEXT;

-- CreateTable
CREATE TABLE "ambassadors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "ambassadorType" TEXT NOT NULL,
    "applicationData" JSONB NOT NULL DEFAULT '{}',
    "status" "AmbassadorStatus" NOT NULL DEFAULT 'PENDING',
    "proofStorageKey" TEXT NOT NULL,
    "proofUrl" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambassadors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambassador_campaigns" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ambassadorTypesAllowed" TEXT[],
    "rewardConfig" JSONB NOT NULL,
    "shareTemplates" JSONB NOT NULL DEFAULT '{}',
    "sourceCampaignId" TEXT,
    "status" "AmbassadorCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambassador_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambassador_campaign_enrollments" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambassador_campaign_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ambassador_types" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "proofFieldLabel" TEXT NOT NULL,
    "applicationFields" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_ambassador_types_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "organization_ambassador_type_access" (
    "organizationId" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_ambassador_type_access_pkey" PRIMARY KEY ("organizationId","typeKey")
);

-- CreateIndex
CREATE INDEX "ambassadors_organizationId_status_idx" ON "ambassadors"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ambassadors_organizationId_email_key" ON "ambassadors"("organizationId", "email");

-- CreateIndex
CREATE INDEX "ambassador_campaigns_organizationId_status_idx" ON "ambassador_campaigns"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ambassador_campaigns_contestId_key" ON "ambassador_campaigns"("contestId");

-- CreateIndex
CREATE UNIQUE INDEX "ambassador_campaign_enrollments_referralCode_key" ON "ambassador_campaign_enrollments"("referralCode");

-- CreateIndex
CREATE INDEX "ambassador_campaign_enrollments_referralCode_idx" ON "ambassador_campaign_enrollments"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "ambassador_campaign_enrollments_campaignId_ambassadorId_key" ON "ambassador_campaign_enrollments"("campaignId", "ambassadorId");

-- CreateIndex
CREATE INDEX "participants_referredByEnrollmentId_idx" ON "participants"("referredByEnrollmentId");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_referredByEnrollmentId_fkey" FOREIGN KEY ("referredByEnrollmentId") REFERENCES "ambassador_campaign_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassadors" ADD CONSTRAINT "ambassadors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassador_campaigns" ADD CONSTRAINT "ambassador_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassador_campaigns" ADD CONSTRAINT "ambassador_campaigns_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassador_campaign_enrollments" ADD CONSTRAINT "ambassador_campaign_enrollments_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ambassador_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassador_campaign_enrollments" ADD CONSTRAINT "ambassador_campaign_enrollments_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "ambassadors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_ambassador_type_access" ADD CONSTRAINT "organization_ambassador_type_access_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
