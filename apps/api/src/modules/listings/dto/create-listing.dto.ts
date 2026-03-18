import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateListingSchema = z.object({
  brandId: z.string().optional().describe('Legacy brand ID. Optional if brandName is provided'),
  brandName: z
    .string()
    .optional()
    .describe('Free-text brand name. Existing brands are reused; new names are added'),
  voucherType: z.string().describe('Voucher category within the selected brand'),
  faceValue: z.coerce
    .number()
    .int()
    .min(1)
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
