import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { e164PhonePattern } from '../auth.constants';

const VerifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(e164PhonePattern, 'Phone must be in E.164 format (e.g. +919876543210)')
    .describe('Phone number in E.164 format'),
  code: z
    .string()
    .regex(/^\d{6}$/, 'OTP must be exactly six digits')
    .describe('Six-digit OTP sent to the phone number'),
  name: z.string().min(2).max(80).optional().describe('Optional display name for the user profile'),
  email: z.string().email().optional().describe('Optional contact email for the user profile')
});

export class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}
