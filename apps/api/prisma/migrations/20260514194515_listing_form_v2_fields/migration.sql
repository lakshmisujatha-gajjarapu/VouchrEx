-- CreateEnum
CREATE TYPE "RedemptionMode" AS ENUM ('ONLINE', 'IN_STORE', 'BOTH');

-- AlterTable
ALTER TABLE "CodeVault" ADD COLUMN     "encryptedPin" TEXT,
ADD COLUMN     "encryptionPinIv" TEXT,
ADD COLUMN     "encryptionPinTag" TEXT;

-- AlterTable
ALTER TABLE "VoucherListing" ADD COLUMN     "minimumOrderValue" INTEGER,
ADD COLUMN     "redemptionMode" "RedemptionMode",
ADD COLUMN     "sellerNotes" TEXT;
