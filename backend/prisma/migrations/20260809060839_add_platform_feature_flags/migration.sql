-- CreateTable
CREATE TABLE "platform_feature_flags" (
    "key" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "organization_feature_flag_overrides" (
    "key" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_feature_flag_overrides_pkey" PRIMARY KEY ("key","organizationId")
);

-- CreateIndex
CREATE INDEX "organization_feature_flag_overrides_key_organizationId_idx" ON "organization_feature_flag_overrides"("key", "organizationId");
