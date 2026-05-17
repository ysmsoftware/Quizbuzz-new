import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import logger from "./logger";
import { config } from "../config/index";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Explicit pg.Pool so DB_POOL_MIN, DB_POOL_MAX, DB_QUERY_TIMEOUT from config
// are actually applied. Without this, PrismaPg uses its own internal pool
// with default sizing (10 connections) — ignoring your configured values.
const pool = new Pool({
  connectionString: config.database.url,
  min: config.database.pool.min,
  max: config.database.pool.max,
  idleTimeoutMillis: config.database.timeout,
  connectionTimeoutMillis: config.timeouts.db,
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log:
      config.app.nodeEnv === "production"
        ? ["error"]
        : ["error", "warn"],
  });

if (config.app.nodeEnv !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function connectDB() {
  try {
    await prisma.$connect();
    logger.info(
      `Prisma connected to PostgreSQL (pool min=${config.database.pool.min} max=${config.database.pool.max})`
    );
  } catch (error) {
    logger.error("Prisma connection failed", error);
    throw error;
  }
}