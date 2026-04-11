import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RefreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1)
    .describe('Refresh token issued at login or last token rotation')
});

export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}
