import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Static safety cap; see comment in create-listing.dto.ts. Real cap lives in
// AppConfig (`listing_max_price_inr`) and is enforced in ListingsService.
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
  proofUrl: z.string().optional().describe('Optional proof asset URL')
});

export class UpdateListingDto extends createZodDto(UpdateListingSchema) {}
