-- DropIndex
DROP INDEX "contests_slug_idx";

-- DropIndex
DROP INDEX "contests_slug_key";

-- RenameIndex
ALTER INDEX "contests_organization_id_slug_key" RENAME TO "contests_organizationId_slug_key";
