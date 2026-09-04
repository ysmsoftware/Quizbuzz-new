-- CreateTable
CREATE TABLE "ambassador_refresh_tokens" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambassador_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ambassador_refresh_tokens_tokenHash_key" ON "ambassador_refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "ambassador_refresh_tokens_ambassadorId_idx" ON "ambassador_refresh_tokens"("ambassadorId");

-- CreateIndex
CREATE INDEX "ambassador_refresh_tokens_tokenHash_idx" ON "ambassador_refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "ambassador_refresh_tokens_expiresAt_idx" ON "ambassador_refresh_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "ambassador_refresh_tokens" ADD CONSTRAINT "ambassador_refresh_tokens_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "ambassadors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
