import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DisputeResolution } from '@prisma/client';

const ResolveDisputeSchema = z.object({
  resolution: z.nativeEnum(DisputeResolution).describe('Manual dispute decision'),
  adminNotes: z.string().max(2000).optional().describe('Optional context recorded in audit log (required for NO_FAULT)')
});

export class ResolveDisputeDto extends createZodDto(ResolveDisputeSchema) {}
