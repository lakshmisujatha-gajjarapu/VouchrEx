import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { e164PhonePattern } from '../auth.constants';

const RequestOtpSchema = z.object({
  phone: z
    .string()
    .regex(e164PhonePattern, 'Phone must be in E.164 format (e.g. +919876543210)')
    .describe('Phone number in E.164 format'),
  name: z.string().min(2).optional().describe('Optional name for new users'),
  deviceId: z.string().max(128).optional().describe('Soft device fingerprint for fraud detection')
});

export class RequestOtpDto extends createZodDto(RequestOtpSchema) {}
