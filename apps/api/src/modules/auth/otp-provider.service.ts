import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException
} from '@nestjs/common';
import { createHash } from 'node:crypto';

type OtpProviderName = 'DEV' | 'MSG91_WIDGET';

type Msg91WidgetSendResponse = {
  readonly type: 'success' | 'error';
  readonly message?: string;
  readonly reqId?: string;
};

type Msg91WidgetVerifyResponse = {
  readonly type: 'success' | 'error';
  readonly message?: string;
  readonly 'access-token'?: string;
};

type Msg91WidgetValidateResponse = {
  readonly type: 'success' | 'error';
  readonly message?: string;
  readonly data?: {
    readonly user?: {
      readonly identifier?: string;
    };
  };
};

@Injectable()
export class OtpProviderService {
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

  async startVerification(phone: string) {
    const provider = this.resolveProvider();

    if (provider === 'DEV') {
      const expiresAt = new Date(Date.now() + this.fallbackTtlMinutes * 60 * 1000);
      return {
        provider,
        codeHash: this.hashOtp(phone, this.devFixedCode),
        expiresAt,
        debugCode: this.devFixedCode
      };
    }

    // MSG91_WIDGET
    const { reqId } = await this.sendMsg91WidgetOtp(phone);
    const expiresAt = new Date(Date.now() + this.fallbackTtlMinutes * 60 * 1000);
    return {
      provider,
      providerRequestId: reqId,
      codeHash: this.hashOtp(phone, reqId),
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
      if (!input.providerRequestId) {
        throw new ServiceUnavailableException('Missing MSG91 widget reqId for OTP challenge.');
      }
      return this.verifyMsg91WidgetOtp(input.providerRequestId, input.code, input.phone);
    }

    throw new ServiceUnavailableException(`Unsupported OTP provider: ${input.provider}.`);
  }

  private async sendMsg91WidgetOtp(phone: string): Promise<{ reqId: string }> {
    const authKey = process.env.MSG91_AUTH_KEY;
    const widgetId = process.env.MSG91_WIDGET_ID;

    if (!authKey) throw new ServiceUnavailableException('MSG91_AUTH_KEY is not configured.');
    if (!widgetId) throw new ServiceUnavailableException('MSG91_WIDGET_ID is not configured.');

    const strippedPhone = phone.replace(/^\+/, '');
    const response = await fetch('https://control.msg91.com/api/v5/widget/sendOtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: authKey },
      body: JSON.stringify({ widgetId, identifier: strippedPhone })
    });

    const data = (await response.json()) as Msg91WidgetSendResponse;

    if (data.type !== 'success' || !data.reqId) {
      throw new ServiceUnavailableException('OTP delivery failed');
    }

    return { reqId: data.reqId };
  }

  private async verifyMsg91WidgetOtp(reqId: string, otp: string, phone: string): Promise<boolean> {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) throw new ServiceUnavailableException('MSG91_AUTH_KEY is not configured.');

    const verifyRes = await fetch('https://control.msg91.com/api/v5/widget/verifyOtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: authKey },
      body: JSON.stringify({ reqId, otp })
    });

    const verifyData = (await verifyRes.json()) as Msg91WidgetVerifyResponse;

    if (verifyData.type !== 'success') {
      const msg = (verifyData.message ?? '').toLowerCase();
      if (msg.includes('expir')) {
        throw new BadRequestException('OTP has expired. Request a new code.');
      }
      if (msg.includes('attempt') || msg.includes('limit')) {
        throw new BadRequestException('OTP retry limit reached. Request a new code.');
      }
      return false;
    }

    const accessToken = verifyData['access-token'];
    if (!accessToken) throw new ServiceUnavailableException('MSG91 did not return an access token.');

    return this.validateMsg91WidgetToken(accessToken, phone);
  }

  private async validateMsg91WidgetToken(accessToken: string, expectedPhone: string): Promise<boolean> {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) throw new ServiceUnavailableException('MSG91_AUTH_KEY is not configured.');

    const validateRes = await fetch('https://control.msg91.com/api/v5/widget/validateAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: authKey },
      body: JSON.stringify({ 'access-token': accessToken })
    });

    const validateData = (await validateRes.json()) as Msg91WidgetValidateResponse;

    if (validateData.type !== 'success' || !validateData.data?.user?.identifier) {
      throw new ServiceUnavailableException('Failed to validate MSG91 OTP token.');
    }

    const identifier = validateData.data.user.identifier;
    const normalizedIdentifier = identifier.startsWith('+') ? identifier : '+' + identifier;
    return normalizedIdentifier === expectedPhone;
  }

  private hashOtp(phone: string, value: string) {
    return createHash('sha256')
      .update(`${phone}:${value}`)
      .digest('hex');
  }
}
