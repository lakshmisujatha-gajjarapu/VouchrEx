import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateUserSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().nullable().optional(),
});

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
