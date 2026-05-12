-- AlterTable
ALTER TABLE "User" ADD COLUMN     "buyerStrikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payoutHoldUntil" TIMESTAMP(3),
ADD COLUMN     "sellerStrikes" INTEGER NOT NULL DEFAULT 0;
