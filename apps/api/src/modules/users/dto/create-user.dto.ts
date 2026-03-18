import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { e164PhonePattern } from '../../auth/auth.constants';

const CreateUserSchema = z.object({
  phone: z
    .string()
    .regex(e164PhonePattern, 'Phone must be in E.164 format (e.g. +919876543210)')
    .describe('Phone number in E.164 format'),
  name: z.string().min(2).describe('Display name for the buyer or seller'),
  email: z.string().email().optional().describe('Optional contact email')
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
