-- AlterTable
ALTER TABLE "contests" ADD COLUMN     "certificateTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_certificateTemplateId_fkey" FOREIGN KEY ("certificateTemplateId") REFERENCES "certificate_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
