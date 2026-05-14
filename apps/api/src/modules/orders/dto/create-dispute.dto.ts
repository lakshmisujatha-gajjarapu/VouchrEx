import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateDisputeSchema = z.object({
  reason: z.string().min(3).describe('Short dispute reason code or label'),
  description: z
    .string()
    .max(1000)
    .optional()
    .default('')
    .describe('Optional issue description from the buyer'),
});

export class CreateDisputeDto extends createZodDto(CreateDisputeSchema) {}
