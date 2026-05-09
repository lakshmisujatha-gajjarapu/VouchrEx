-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NOT_APPLICABLE', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Payment"
  ADD COLUMN "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN "razorpayRefundId" TEXT,
  ADD COLUMN "refundInitiatedAt" TIMESTAMP(3),
  ADD COLUMN "refundFailureReason" TEXT,
  ADD COLUMN "refundAttempts" INTEGER NOT NULL DEFAULT 0;

-- Backfill: existing payments with status=REFUNDED are treated as completed refunds
UPDATE "Payment" SET "refundStatus" = 'COMPLETED' WHERE "status" = 'REFUNDED';

-- AlterTable
ALTER TABLE "Dispute"
  ADD COLUMN "resolvedById" TEXT,
  ADD COLUMN "adminAlertedAt" TIMESTAMP(3);
