-- AlterEnum
ALTER TYPE "DisputeResolution" ADD VALUE 'NO_FAULT';

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "sellerRespondedAt" TIMESTAMP(3);
