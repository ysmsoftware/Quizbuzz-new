import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import logger from "./logger";
import { config } from "../config/index";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Explicit pg.Pool so DB_POOL_MIN, DB_POOL_MAX, DB_QUERY_TIMEOUT from config
// are actually applied. Without this, PrismaPg uses its own internal pool
// with default sizing (10 connections) — ignoring your configured values.
// In production (RDS), the DATABASE_URL contains `sslmode=require`.
// The `pg` driver honours that flag but also tries to verify the server
// certificate against the system CA store.  The Amazon RDS root CA is
// NOT in the default Node.js / Docker CA bundle, which causes:
//   "Error opening a TLS connection: self-signed certificate in certificate chain"
//
// Fix: keep SSL required (so the connection is still encrypted) but tell
// `pg` to skip CA verification (`rejectUnauthorized: false`).
// This is the standard approach for managed RDS inside a private VPC where
// network-level security already guarantees you're talking to the real RDS
// instance.  If you later want full cert verification, mount the RDS CA
// bundle into the image and set `ca: fs.readFileSync('/rds-ca.pem')`.
const pool = new Pool({
  connectionString: config.database.url,
  min: config.database.pool.min,
  max: config.database.pool.max,
  idleTimeoutMillis: config.database.timeout,
  connectionTimeoutMillis: config.timeouts.db,
  ssl: config.app.nodeEnv === "production"
    ? { rejectUnauthorized: false }
    : undefined,
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