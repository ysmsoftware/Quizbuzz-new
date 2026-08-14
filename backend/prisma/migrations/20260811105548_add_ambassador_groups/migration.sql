-- CreateTable
CREATE TABLE "ambassador_groups" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "groupType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ambassadorTarget" INTEGER,
    "registrationTarget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambassador_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ambassador_groups_campaignId_idx" ON "ambassador_groups"("campaignId");

-- AddForeignKey
ALTER TABLE "ambassador_groups" ADD CONSTRAINT "ambassador_groups_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ambassador_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
