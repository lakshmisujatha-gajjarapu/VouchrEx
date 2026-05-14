import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const LISTING_FACE_VALUE_SAFETY_CAP = 10_000_000;

const UpdateListingSchema = z.object({
  brandId: z.string().optional().describe('Optional existing brand ID'),
  brandName: z.string().optional().describe('Optional free-text brand name'),
  voucherType: z.enum(['gift-card', 'promo-code']).optional().describe('Voucher type'),
  faceValue: z.coerce.number().int().min(1).max(LISTING_FACE_VALUE_SAFETY_CAP).optional().describe('Original voucher face value in INR'),
  sellingPrice: z.coerce.number().int().min(1).optional().describe('Resale price in INR'),
  expiryDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe('Voucher expiry in ISO 8601 format'),
  code: z.string().optional().describe('Optional replacement voucher code'),
  pin: z.string().optional().describe('Optional replacement PIN'),
  proofUrl: z.string().optional().describe('Optional proof asset URL'),
  minimumOrderValue: z.coerce.number().int().min(1).optional().describe('Minimum cart value in INR'),
  redemptionMode: z.enum(['ONLINE', 'IN_STORE', 'BOTH']).optional().describe('Redemption mode'),
  sellerNotes: z.string().max(500).optional().describe('Seller terms, max 500 characters')
});

export class UpdateListingDto extends createZodDto(UpdateListingSchema) {}
