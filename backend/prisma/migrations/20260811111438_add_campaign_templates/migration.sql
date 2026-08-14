-- AlterTable
ALTER TABLE "ambassador_campaigns" ADD COLUMN     "sourceTemplateId" TEXT;

-- CreateTable
CREATE TABLE "ambassador_campaign_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ambassadorTypesAllowed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rewardConfig" JSONB NOT NULL DEFAULT '{}',
    "shareTemplates" JSONB NOT NULL DEFAULT '{}',
    "groups" JSONB NOT NULL DEFAULT '[]',
    "sourceCampaignId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambassador_campaign_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ambassador_campaign_templates_organizationId_idx" ON "ambassador_campaign_templates"("organizationId");

-- AddForeignKey
ALTER TABLE "ambassador_campaign_templates" ADD CONSTRAINT "ambassador_campaign_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
