import { Platform } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RegisterPushTokenSchema = z.object({
  deviceId: z
    .string()
    .min(1)
    .max(128)
    .describe('Soft device fingerprint that identifies this install of the app'),
  token: z
    .string()
    .min(1)
    .describe('Expo push token returned by expo-notifications on the client'),
  platform: z
    .nativeEnum(Platform)
    .describe('Device OS platform — IOS / ANDROID / WEB')
});

export class RegisterPushTokenDto extends createZodDto(RegisterPushTokenSchema) {}
