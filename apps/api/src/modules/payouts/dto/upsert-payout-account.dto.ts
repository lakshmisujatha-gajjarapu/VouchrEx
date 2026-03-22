import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const upiIdPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z]{2,}$/;
const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * Flat schema used for the NestJS DTO class (createZodDto doesn't support
 * discriminated unions as a base class). Cross-field validation is enforced
 * via superRefine.
 */
const UpsertPayoutAccountSchema = z
  .object({
    type: z.enum(['UPI', 'BANK_ACCOUNT']),
    upiId: z
      .string()
      .regex(upiIdPattern, 'UPI ID must be in format handle@bank (e.g. 9876543210@ybl)')
      .optional(),
    accountHolderName: z.string().min(2).optional(),
    accountNumber: z.string().min(8).max(18).optional(),
    ifsc: z.string().regex(ifscPattern, 'Invalid IFSC code format').optional()
  })
  .superRefine((data, ctx) => {
    if (data.type === 'UPI' && !data.upiId) {
      ctx.addIssue({ code: 'custom', path: ['upiId'], message: 'upiId is required for UPI accounts' });
    }
    if (data.type === 'BANK_ACCOUNT') {
      if (!data.accountHolderName) {
        ctx.addIssue({ code: 'custom', path: ['accountHolderName'], message: 'accountHolderName is required for bank accounts' });
      }
      if (!data.accountNumber) {
        ctx.addIssue({ code: 'custom', path: ['accountNumber'], message: 'accountNumber is required for bank accounts' });
      }
      if (!data.ifsc) {
        ctx.addIssue({ code: 'custom', path: ['ifsc'], message: 'ifsc is required for bank accounts' });
      }
    }
  });

export type UpsertPayoutAccountInput = z.infer<typeof UpsertPayoutAccountSchema>;

export class UpsertPayoutAccountDto extends createZodDto(UpsertPayoutAccountSchema) {}
