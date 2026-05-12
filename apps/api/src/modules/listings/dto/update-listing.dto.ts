import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { LISTING_MAX_PRICE_INR } from '../listings.constants';

const UpdateListingSchema = z.object({
  brandId: z.string().optional().describe('Optional existing brand ID'),
  brandName: z.string().optional().describe('Optional free-text brand name'),
  voucherType: z.enum(['gift-card', 'promo-code']).optional().describe('Voucher type'),
  faceValue: z.coerce.number().int().min(1).max(LISTING_MAX_PRICE_INR).optional().describe('Original voucher face value in INR'),
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
