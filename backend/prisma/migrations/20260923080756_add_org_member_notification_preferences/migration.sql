-- CreateTable
CREATE TABLE "org_member_notification_preferences" (
    "id" TEXT NOT NULL,
    "orgMemberId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "email" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_member_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_member_notification_preferences_orgMemberId_type_key" ON "org_member_notification_preferences"("orgMemberId", "type");

-- AddForeignKey
ALTER TABLE "org_member_notification_preferences" ADD CONSTRAINT "org_member_notification_preferences_orgMemberId_fkey" FOREIGN KEY ("orgMemberId") REFERENCES "org_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
