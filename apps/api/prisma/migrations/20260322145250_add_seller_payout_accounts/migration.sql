-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutAccountType" AS ENUM ('UPI', 'BANK_ACCOUNT');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "payoutFailureReason" TEXT,
ADD COLUMN     "payoutInitiatedAt" TIMESTAMP(3),
ADD COLUMN     "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "razorpayPayoutId" TEXT;

-- CreateTable
CREATE TABLE "SellerPayoutAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PayoutAccountType" NOT NULL DEFAULT 'UPI',
    "upiId" TEXT,
    "accountHolderName" TEXT,
    "bankAccountEncrypted" TEXT,
    "razorpayContactId" TEXT,
    "razorpayFundAccountId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerPayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerPayoutAccount_userId_key" ON "SellerPayoutAccount"("userId");

-- AddForeignKey
ALTER TABLE "SellerPayoutAccount" ADD CONSTRAINT "SellerPayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
