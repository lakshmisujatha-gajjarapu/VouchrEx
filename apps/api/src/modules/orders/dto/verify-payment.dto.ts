import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const VerifyPaymentSchema = z.object({
  razorpayPaymentId: z
    .string()
    .optional()
    .describe('Gateway payment identifier. Optional for the mock provider'),
  razorpayOrderId: z
    .string()
    .optional()
    .describe('Gateway order identifier returned when checkout was created'),
  razorpaySignature: z
    .string()
    .optional()
    .describe('Razorpay signature used to verify the payment callback'),
  method: z.string().describe('Payment method used to fund escrow')
});

export class VerifyPaymentDto extends createZodDto(VerifyPaymentSchema) {}
