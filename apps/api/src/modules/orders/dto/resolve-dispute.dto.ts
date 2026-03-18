import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DisputeResolution } from '@prisma/client';

const ResolveDisputeSchema = z.object({
  resolution: z.nativeEnum(DisputeResolution).describe('Manual dispute decision')
});

export class ResolveDisputeDto extends createZodDto(ResolveDisputeSchema) {}
