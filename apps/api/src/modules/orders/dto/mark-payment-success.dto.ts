import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MarkPaymentSuccessSchema = z.object({
  razorpayPaymentId: z.string().optional().describe('Gateway payment identifier, if available'),
  method: z.string().describe('Payment method used to fund escrow')
});

export class MarkPaymentSuccessDto extends createZodDto(MarkPaymentSuccessSchema) {}
