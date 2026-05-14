import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateDisputeSchema = z.object({
  reason: z.string().min(3).describe('Short dispute reason code or label'),
  description: z
    .string()
    .min(10)
    .max(1000)
    .describe('Detailed issue description from the buyer'),
});

export class CreateDisputeDto extends createZodDto(CreateDisputeSchema) {}
