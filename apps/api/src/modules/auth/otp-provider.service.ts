import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { createHash } from 'node:crypto';

type OtpProviderName = 'DEV' | 'MSG91_WIDGET';

type Msg91WidgetValidateResponse = {
  readonly type: 'success' | 'error';
  readonly message?: string; // phone number on success, error text on failure
};

@Injectable()
export class OtpProviderService {
  private readonly log = new Logger(OtpProviderService.name);
  private readonly devFixedCode = process.env.OTP_FIXED_CODE ?? '123456';
  private readonly fallbackTtlMinutes = Number(process.env.OTP_TTL_MINUTES ?? 5);

  resolveProvider(): OtpProviderName {
    const configured = (process.env.OTP_PROVIDER ?? '').trim().toUpperCase();
    const isProduction = process.env.NODE_ENV === 'production';

    if (configured === 'DEV' || configured === 'MSG91_WIDGET') {
      if (isProduction && configured === 'DEV') {
        throw new ServiceUnavailableException(
          'OTP_PROVIDER=DEV is not allowed in production. Use MSG91_WIDGET.'
        );
      }
      return configured as OtpProviderName;
    }

    if (isProduction) {
      throw new ServiceUnavailableException(
        'OTP_PROVIDER must be set to MSG91_WIDGET in production.'
      );
    }
    return 'DEV';
  }

  startVerification(phone: string) {
    const provider = this.resolveProvider();
    const expiresAt = new Date(Date.now() + this.fallbackTtlMinutes * 60 * 1000);

    if (provider === 'DEV') {
      return {
        provider,
        codeHash: this.hashOtp(phone, this.devFixedCode),
        expiresAt,
        debugCode: this.devFixedCode
      };
    }

    // MSG91_WIDGET: OTP is sent client-side by the mobile SDK.
    // Backend only stores a placeholder challenge; real verification happens via verifyAccessToken.
    return {
      provider,
      codeHash: this.hashOtp(phone, 'widget-placeholder'),
      expiresAt
    };
  }

  async verifyOtp(input: {
    readonly phone: string;
    readonly provider: string;
    readonly providerRequestId: string | null;
    readonly storedCodeHash: string;
    readonly code: string;
  }) {
    const provider = input.provider.toUpperCase();

    if (provider === 'DEV') {
      return input.storedCodeHash === this.hashOtp(input.phone, input.code);
    }

    if (provider === 'MSG91_WIDGET') {
      // input.code is the JWT access token returned by the mobile SDK after OTP verification
      this.log.debug(`MSG91_WIDGET verifyOtp — code length=${String(input.code.length)} prefix=${input.code.slice(0, 20)}…`);
      return this.verifyMsg91AccessToken(input.code, input.phone);
    }

    throw new ServiceUnavailableException(`Unsupported OTP provider: ${input.provider}.`);
  }

  private async verifyMsg91AccessToken(accessToken: string, expectedPhone: string): Promise<boolean> {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) throw new ServiceUnavailableException('MSG91_AUTH_KEY is not configured.');

    const res = await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ authkey: authKey, 'access-token': accessToken })
    });

    const data = (await res.json()) as Msg91WidgetValidateResponse;

    if (data.type !== 'success' || !data.message) {
      this.log.error(`MSG91 verifyAccessToken failed [status=${String(res.status)}]: ${data.message ?? 'no message'}`);
      throw new ServiceUnavailableException('Failed to validate MSG91 OTP token.');
    }

    // verifyAccessToken returns the phone number (without +) in the `message` field
    const normalizedIdentifier = data.message.startsWith('+') ? data.message : '+' + data.message;
    return normalizedIdentifier === expectedPhone;
  }

  private hashOtp(phone: string, value: string) {
    return createHash('sha256')
      .update(`${phone}:${value}`)
      .digest('hex');
  }
}
