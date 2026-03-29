-- AlterTable
ALTER TABLE "OtpChallenge" ADD COLUMN     "clientIp" TEXT,
ADD COLUMN     "deviceId" TEXT;

-- AlterTable
ALTER TABLE "SellerPayoutAccount" ADD COLUMN     "kycStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disputeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalSales" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "OtpChallenge_deviceId_createdAt_idx" ON "OtpChallenge"("deviceId", "createdAt");
