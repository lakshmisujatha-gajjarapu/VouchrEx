import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  DEVICE_FINGERPRINT_MAX_LENGTH,
  USER_NAME_MIN_LENGTH,
  e164PhonePattern
} from '../auth.constants';

const RequestOtpSchema = z.object({
  phone: z
    .string()
    .regex(e164PhonePattern, 'Phone must be in E.164 format (e.g. +919876543210)')
    .describe('Phone number in E.164 format'),
  name: z.string().min(USER_NAME_MIN_LENGTH).optional().describe('Optional name for new users'),
  deviceId: z
    .string()
    .max(DEVICE_FINGERPRINT_MAX_LENGTH)
    .optional()
    .describe('Soft device fingerprint for fraud detection')
});

export class RequestOtpDto extends createZodDto(RequestOtpSchema) {}
