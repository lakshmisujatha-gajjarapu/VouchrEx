import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SubmitSellerDisputeResponseSchema = z.object({
  response: z
    .string()
    .min(10)
    .max(2000)
    .describe('Seller response or evidence explanation (10–2000 characters)'),
  evidenceUrls: z.array(z.string()).optional().describe('Optional additional evidence URLs')
});

export class SubmitSellerDisputeResponseDto extends createZodDto(SubmitSellerDisputeResponseSchema) {}
