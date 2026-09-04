-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "collegeId" TEXT,
ADD COLUMN     "departmentId" TEXT;

-- CreateTable
CREATE TABLE "platform_colleges" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_colleges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_departments" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_departments_collegeId_idx" ON "platform_departments"("collegeId");

-- CreateIndex
CREATE INDEX "contacts_collegeId_idx" ON "contacts"("collegeId");
