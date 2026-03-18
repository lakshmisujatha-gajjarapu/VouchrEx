import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateOrderSchema = z.object({
  listingId: z.string().describe('Listing ID being purchased')
});

export class CreateOrderDto extends createZodDto(CreateOrderSchema) {}
