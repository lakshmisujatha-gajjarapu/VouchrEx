import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';

@Injectable()
export class CodeVaultService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly secret: string;

  constructor() {
    const configuredSecret = process.env.CODE_ENCRYPTION_KEY?.trim();

    if (!configuredSecret) {
      throw new Error('CODE_ENCRYPTION_KEY is required for voucher encryption.');
    }

    this.secret = configuredSecret;
  }

  encrypt(code: string) {
    const iv = randomBytes(12);
    const key = scryptSync(this.secret, 'vouchrex-code-vault', 32);
    const cipher = createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedCode: encrypted.toString('base64'),
      encryptionIv: iv.toString('base64'),
      encryptionTag: authTag.toString('base64'),
      codeHash: this.hash(code)
    };
  }

  decrypt(payload: { encryptedCode: string; encryptionIv: string; encryptionTag: string }) {
    const key = scryptSync(this.secret, 'vouchrex-code-vault', 32);
    const decipher = createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(payload.encryptionIv, 'base64')
    );

    decipher.setAuthTag(Buffer.from(payload.encryptionTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.encryptedCode, 'base64')),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  }

  hash(code: string) {
    return createHash('sha256').update(code).digest('hex');
  }

  renderWatermarkedCodeCard(input: {
    readonly code: string;
    readonly brandName: string;
    readonly buyerName: string;
    readonly buyerPhone: string;
    readonly orderId: string;
    readonly verificationDeadline: Date;
  }) {
    const safeCode = this.escapeHtml(input.code);
    const watermark = this.escapeHtml(
      `${input.buyerName} • ${this.maskPhone(input.buyerPhone)} • ${input.orderId.slice(-8)}`
    );
    const safeBrandName = this.escapeHtml(input.brandName);
    const safeDeadline = this.escapeHtml(input.verificationDeadline.toISOString());
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-label="Voucher code card">
  <defs>
    <linearGradient id="card" x1="0%" x2="100%" y1="0%" y2="100%">
      <stop offset="0%" stop-color="#f6f4ea" />
      <stop offset="100%" stop-color="#f8dfc5" />
    </linearGradient>
    <pattern id="watermark" width="320" height="160" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
      <text x="0" y="80" fill="rgba(31, 41, 55, 0.14)" font-family="monospace" font-size="24">${watermark}</text>
    </pattern>
  </defs>
  <rect width="960" height="540" rx="36" fill="url(#card)" />
  <rect x="30" y="30" width="900" height="480" rx="28" fill="url(#watermark)" stroke="rgba(31, 41, 55, 0.12)" />
  <text x="72" y="112" fill="#92400e" font-family="monospace" font-size="24">VouchrEx escrow reveal</text>
  <text x="72" y="168" fill="#111827" font-family="Arial, sans-serif" font-size="48" font-weight="700">${safeBrandName}</text>
  <text x="72" y="250" fill="#1f2937" font-family="monospace" font-size="56" font-weight="700">${safeCode}</text>
  <text x="72" y="320" fill="#374151" font-family="Arial, sans-serif" font-size="26">Verification deadline: ${safeDeadline}</text>
  <text x="72" y="372" fill="#374151" font-family="Arial, sans-serif" font-size="26">If this image leaks, the buyer watermark is embedded.</text>
  <text x="72" y="452" fill="#7c2d12" font-family="Arial, sans-serif" font-size="24">Use within the buyer verification window.</text>
</svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private maskPhone(phone: string) {
    if (phone.length <= 4) {
      return phone;
    }

    return `${phone.slice(0, Math.max(0, phone.length - 4)).replaceAll(/\d/g, 'x')}${phone.slice(
      -4
    )}`;
  }
}
