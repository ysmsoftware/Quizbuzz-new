-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "certificate_templates_organizationId_idx" ON "certificate_templates"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_templates_organizationId_name_key" ON "certificate_templates"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
