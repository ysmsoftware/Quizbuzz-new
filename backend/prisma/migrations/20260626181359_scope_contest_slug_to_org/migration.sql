-- DropIndex (idempotent)
DROP INDEX IF EXISTS "contests_slug_idx";

-- DropIndex (idempotent)
DROP INDEX IF EXISTS "contests_slug_key";

-- RenameIndex (idempotent — only rename if the old name still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'contests'
      AND indexname = 'contests_organization_id_slug_key'
  ) THEN
    ALTER INDEX "contests_organization_id_slug_key" RENAME TO "contests_organizationId_slug_key";
  END IF;
END
$$;
