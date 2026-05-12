import test from 'node:test';
import assert from 'node:assert/strict';

import { CodeVaultService } from '../src/modules/listings/services/code-vault.service';

test('CodeVaultService encrypts and decrypts voucher codes', () => {
  const originalKey = process.env.CODE_ENCRYPTION_KEY;
  process.env.CODE_ENCRYPTION_KEY = 'test_vouchrex_secret';

  const service = new CodeVaultService();
  const encrypted = service.encrypt('AMZN-9X2M-47QP');
  const decrypted = service.decrypt(encrypted);

  assert.equal(decrypted, 'AMZN-9X2M-47QP');
  assert.match(encrypted.codeHash, /^[a-f0-9]{64}$/u);

  process.env.CODE_ENCRYPTION_KEY = originalKey;
});

test('CodeVaultService renders a watermarked SVG data URL', () => {
  const originalKey = process.env.CODE_ENCRYPTION_KEY;
  process.env.CODE_ENCRYPTION_KEY = 'test_vouchrex_secret';

  const service = new CodeVaultService();
  const dataUrl = service.renderWatermarkedCodeCard({
    code: 'AMZN-9X2M-47QP',
    brandName: 'Amazon',
    buyerName: 'Priya',
    buyerPhone: '+919876543210',
    orderId: 'ord_12345678',
    verificationDeadline: new Date('2026-03-16T10:00:00.000Z')
  });

  assert.match(dataUrl, /^data:image\/svg\+xml;base64,/u);

  const svg = Buffer.from(dataUrl.split(',')[1], 'base64').toString('utf8');
  assert.match(svg, /Amazon/u);
  assert.match(svg, /AMZN-9X2M-47QP/u);
  assert.match(svg, /Priya/u);

  process.env.CODE_ENCRYPTION_KEY = originalKey;
});
