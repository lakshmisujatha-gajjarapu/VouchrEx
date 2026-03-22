-- Update any existing MOCK payments to RAZORPAY before removing the enum value
UPDATE "Payment" SET "provider" = 'RAZORPAY' WHERE "provider" = 'MOCK';

-- AlterEnum - remove MOCK, keep only RAZORPAY
-- PostgreSQL requires recreating the enum type
ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY');
ALTER TABLE "Payment" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "provider" TYPE "PaymentProvider" USING ("provider"::text::"PaymentProvider");
ALTER TABLE "Payment" ALTER COLUMN "provider" SET DEFAULT 'RAZORPAY';
DROP TYPE "PaymentProvider_old";
