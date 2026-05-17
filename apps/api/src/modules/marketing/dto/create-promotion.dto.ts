import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreatePromotionSchema = z.object({
  name: z.string().min(1),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  category: z.string().optional(),
  minInventory: z.number().int().min(1).default(2),
  pushMessage: z.string().min(1),
  active: z.boolean().default(true)
});

export class CreatePromotionDto extends createZodDto(CreatePromotionSchema) {}
