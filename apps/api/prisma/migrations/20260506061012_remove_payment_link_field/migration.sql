/*
  Warnings:

  - You are about to drop the column `razorpayPaymentLinkId` on the `Payment` table. All the data in the column will be lost.
  - Made the column `codeHash` on table `OtpChallenge` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "OtpChallenge" ALTER COLUMN "codeHash" SET NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "razorpayPaymentLinkId";
