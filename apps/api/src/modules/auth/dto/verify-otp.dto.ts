import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  DEVICE_FINGERPRINT_MAX_LENGTH,
  OTP_CODE_MAX_LENGTH,
  OTP_CODE_MIN_LENGTH,
  USER_NAME_MAX_LENGTH,
  USER_NAME_MIN_LENGTH,
  e164PhonePattern
} from '../auth.constants';

const VerifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(e164PhonePattern, 'Phone must be in E.164 format (e.g. +919876543210)')
    .describe('Phone number in E.164 format'),
  code: z
    .string()
    .min(OTP_CODE_MIN_LENGTH)
    .max(OTP_CODE_MAX_LENGTH)
    .describe('Six-digit OTP (DEV provider) or JWT access token (MSG91_WIDGET provider)'),
  name: z
    .string()
    .min(USER_NAME_MIN_LENGTH)
    .max(USER_NAME_MAX_LENGTH)
    .optional()
    .describe('Optional display name for the user profile'),
  email: z.string().email().optional().describe('Optional contact email for the user profile'),
  deviceId: z
    .string()
    .max(DEVICE_FINGERPRINT_MAX_LENGTH)
    .optional()
    .describe('Soft device fingerprint for session scoping')
});

export class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}
