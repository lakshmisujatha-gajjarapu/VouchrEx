import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const LISTING_FACE_VALUE_SAFETY_CAP = 10_000_000;

const CreateListingSchema = z.object({
  brandId: z.string().optional().describe('Legacy brand ID. Optional if brandName is provided'),
  brandName: z
    .string()
    .optional()
    .describe('Free-text brand name. Existing brands are reused; new names are added'),
  voucherType: z.enum(['gift-card', 'promo-code']).describe('Voucher type'),
  faceValue: z.coerce
    .number()
    .int()
    .min(1)
    .max(LISTING_FACE_VALUE_SAFETY_CAP)
    .describe('Original voucher face value in INR'),
  sellingPrice: z.coerce.number().int().min(1).describe('Resale price in INR'),
  expiryDate: z
    .string()
    .datetime({ offset: true })
    .describe('Voucher expiry in ISO 8601 format'),
  code: z.string().describe('Voucher code. Encrypted before storage'),
  pin: z.string().optional().describe('Optional secondary PIN (e.g. scratch PIN on gift cards). Encrypted before storage'),
  proofUrl: z.string().optional().describe('Optional proof asset URL'),
  minimumOrderValue: z.coerce.number().int().min(1).optional().describe('Minimum cart value required to redeem this voucher in INR'),
  redemptionMode: z.enum(['ONLINE', 'IN_STORE', 'BOTH']).optional().describe('Where this voucher can be redeemed. Auto-set to ONLINE for promo-codes'),
  sellerNotes: z.string().max(500).optional().describe('Seller-written terms and conditions, max 500 characters')
});

export class CreateListingDto extends createZodDto(CreateListingSchema) {}
