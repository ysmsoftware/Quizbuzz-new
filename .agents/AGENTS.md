# Workspace Rules

- **Database Migrations**: NEVER manually create Prisma migration folders or `migration.sql` files directly. Migration folders and SQL files must ALWAYS be generated strictly via Prisma CLI commands (`npx prisma migrate dev`).
