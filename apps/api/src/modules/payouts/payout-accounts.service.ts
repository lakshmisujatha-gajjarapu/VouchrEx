import { Injectable, Logger } from '@nestjs/common';
import { PayoutAccountType } from '@prisma/client';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { type UpsertPayoutAccountInput } from './dto/upsert-payout-account.dto';

const encAlgorithm = 'aes-256-gcm';

@Injectable()
export class PayoutAccountsService {
  private readonly logger = new Logger(PayoutAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService
  ) {}

  async upsert(userId: string, dto: UpsertPayoutAccountInput) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, phone: true }
    });

    // Reuse existing Razorpay Contact if already created for this seller
    const existing = await this.prisma.sellerPayoutAccount.findUnique({
      where: { userId }
    });

    const contactId = existing?.razorpayContactId
      ? existing.razorpayContactId
      : await this.paymentsService.createRazorpayContact(user.name, user.phone);

    let fundAccountId: string;

    if (dto.type === 'UPI') {
      const upiId = dto.upiId!;
      fundAccountId = await this.paymentsService.createRazorpayFundAccountUpi(
        contactId,
        upiId
      );

      const account = await this.prisma.sellerPayoutAccount.upsert({
        where: { userId },
        update: {
          type: PayoutAccountType.UPI,
          upiId,
          razorpayContactId: contactId,
          razorpayFundAccountId: fundAccountId,
          verifiedAt: new Date(),
          accountHolderName: null,
          bankAccountEncrypted: null
        },
        create: {
          userId,
          type: PayoutAccountType.UPI,
          upiId,
          razorpayContactId: contactId,
          razorpayFundAccountId: fundAccountId,
          verifiedAt: new Date()
        }
      });

      this.logger.log(
        `UPI payout account registered: userId=${userId} upiId=${upiId} fundAccountId=${fundAccountId}`
      );
      return account;
    }

    // BANK_ACCOUNT
    const accountNumber = dto.accountNumber!;
    const ifsc = dto.ifsc!;
    const accountHolderName = dto.accountHolderName!;
    const encrypted = this.encryptBankDetails(accountNumber, ifsc);
    fundAccountId = await this.paymentsService.createRazorpayFundAccountBank(
      contactId,
      accountHolderName,
      accountNumber,
      ifsc
    );

    const account = await this.prisma.sellerPayoutAccount.upsert({
      where: { userId },
      update: {
        type: PayoutAccountType.BANK_ACCOUNT,
        accountHolderName,
        bankAccountEncrypted: encrypted,
        razorpayContactId: contactId,
        razorpayFundAccountId: fundAccountId,
        verifiedAt: new Date(),
        upiId: null
      },
      create: {
        userId,
        type: PayoutAccountType.BANK_ACCOUNT,
        accountHolderName,
        bankAccountEncrypted: encrypted,
        razorpayContactId: contactId,
        razorpayFundAccountId: fundAccountId,
        verifiedAt: new Date()
      }
    });

    this.logger.log(
      `Bank payout account registered: userId=${userId} holder=${accountHolderName} fundAccountId=${fundAccountId}`
    );
    return account;
  }

  findByUserId(userId: string) {
    return this.prisma.sellerPayoutAccount.findUnique({ where: { userId } });
  }

  /**
   * AES-256-GCM encrypt bank details.
   * Key sourced from CODE_ENCRYPTION_KEY env var (same key used for CodeVault).
   */
  private encryptBankDetails(accountNumber: string, ifsc: string): string {
    const key = this.requireEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(encAlgorithm, key, iv);
    const plaintext = JSON.stringify({ accountNumber, ifsc });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decryptBankDetails(encrypted: string): { accountNumber: string; ifsc: string } {
    const key = this.requireEncryptionKey();
    const [ivHex, tagHex, dataHex] = encrypted.split(':');
    const decipher = createDecipheriv(encAlgorithm, key, Buffer.from(ivHex!, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex!, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex!, 'hex')),
      decipher.final()
    ]);
    return JSON.parse(decrypted.toString('utf8')) as { accountNumber: string; ifsc: string };
  }

  private requireEncryptionKey(): Buffer {
    const key = process.env.CODE_ENCRYPTION_KEY;
    if (!key || key.length < 32) {
      throw new Error('CODE_ENCRYPTION_KEY must be at least 32 characters.');
    }
    return Buffer.from(key.slice(0, 32), 'utf8');
  }
}
