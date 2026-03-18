import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RevealCodeSchema = z.object({
  viewerUserId: z.string().describe('Buyer user ID requesting the reveal')
});

export class RevealCodeDto extends createZodDto(RevealCodeSchema) {}
