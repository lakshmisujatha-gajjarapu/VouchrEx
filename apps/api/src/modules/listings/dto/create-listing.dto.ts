import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Static safety cap to reject obviously absurd input at the schema layer.
// The authoritative business cap is `listing_max_price_inr` in AppConfig and
// enforced in ListingsService — clients should call GET /config to discover it
// rather than relying on this Swagger-exposed number, which is intentionally loose.
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
  proofUrl: z.string().optional().describe('Optional proof asset URL')
});

export class CreateListingDto extends createZodDto(CreateListingSchema) {}
