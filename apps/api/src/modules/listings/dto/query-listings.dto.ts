import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const listingSortOptions = ['latest', 'best-discount', 'expiring', 'price-low'] as const;

const QueryListingsSchema = z.object({
  q: z.string().optional().describe('Free-text search across brand name and voucher type'),
  brandId: z.string().optional().describe('Filter by a specific brand'),
  category: z.string().optional().describe('Filter by the brand category'),
  minDiscount: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Minimum discount percentage'),
  maxPrice: z.coerce.number().int().min(1).optional().describe('Maximum listing price in INR'),
  sort: z
    .enum(listingSortOptions)
    .optional()
    .describe('Sort active listings for buyer browsing'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum number of listings to return')
});

export class QueryListingsDto extends createZodDto(QueryListingsSchema) {}
export type ListingSort = (typeof listingSortOptions)[number];
