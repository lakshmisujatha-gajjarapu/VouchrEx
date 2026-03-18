import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateListingSchema = z.object({
  brandId: z.string().optional().describe('Optional existing brand ID'),
  brandName: z.string().optional().describe('Optional free-text brand name'),
  voucherType: z.string().optional().describe('Voucher category within the selected brand'),
  faceValue: z.coerce.number().int().min(1).optional().describe('Original voucher face value in INR'),
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
