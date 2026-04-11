-- Truncate stale sessions — safe because sessions are ephemeral and these rows reference the old schema
TRUNCATE "UserSession";

-- Drop old columns
ALTER TABLE "UserSession" DROP COLUMN "tokenHash";
ALTER TABLE "UserSession" DROP COLUMN "expiresAt";

-- Drop old index
DROP INDEX IF EXISTS "UserSession_expiresAt_idx";

-- Add new columns
ALTER TABLE "UserSession" ADD COLUMN "accessTokenHash" TEXT NOT NULL;
ALTER TABLE "UserSession" ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "UserSession" ADD COLUMN "refreshTokenHash" TEXT NOT NULL;
ALTER TABLE "UserSession" ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "UserSession" ADD COLUMN "refreshTokenConsumedAt" TIMESTAMP(3);
ALTER TABLE "UserSession" ADD COLUMN "deviceId" TEXT;

-- Add unique constraints
CREATE UNIQUE INDEX "UserSession_accessTokenHash_key" ON "UserSession"("accessTokenHash");
CREATE UNIQUE INDEX "UserSession_refreshTokenHash_key" ON "UserSession"("refreshTokenHash");

-- Add new indexes
CREATE INDEX "UserSession_accessTokenExpiresAt_idx" ON "UserSession"("accessTokenExpiresAt");
CREATE INDEX "UserSession_refreshTokenExpiresAt_idx" ON "UserSession"("refreshTokenExpiresAt");
