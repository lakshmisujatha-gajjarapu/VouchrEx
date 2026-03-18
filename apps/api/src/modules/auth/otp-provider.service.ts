import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException
} from '@nestjs/common';
import { createHash } from 'node:crypto';

type OtpProviderName = 'DEV' | 'EXOTEL';

type ExotelStartResponse = {
  readonly response: {
    readonly status: string;
    readonly data: {
      readonly verification_id: string;
      readonly expiration_in_seconds?: number;
    } | null;
    readonly error_data?: {
      readonly code?: number;
      readonly description?: string;
      readonly message?: string;
    } | null;
  };
};

type ExotelVerifyResponse = {
  readonly response: {
    readonly status: string;
    readonly data: {
      readonly status?: string;
    } | null;
    readonly error_data?: {
      readonly code?: number;
      readonly description?: string;
      readonly message?: string;
    } | null;
  };
};

@Injectable()
export class OtpProviderService {
  private readonly devFixedCode = process.env.OTP_FIXED_CODE ?? '123456';
  private readonly fallbackTtlMinutes = Number(process.env.OTP_TTL_MINUTES ?? 5);

  resolveProvider(): OtpProviderName {
    const configured = (process.env.OTP_PROVIDER ?? '').trim().toUpperCase();
    const isProduction = process.env.NODE_ENV === 'production';

    if (configured === 'DEV' || configured === 'EXOTEL') {
      if (isProduction && configured === 'DEV') {
        throw new ServiceUnavailableException(
          'OTP_PROVIDER=DEV is not allowed in production. Use EXOTEL.'
        );
      }

      return configured;
    }

    return isProduction ? 'EXOTEL' : 'DEV';
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

    const payload = await this.startExotelVerification(phone);
    const exotelData = payload.response.data;
    const verificationId = exotelData?.verification_id;

    if (!verificationId) {
      throw new ServiceUnavailableException('Exotel did not return a verification ID.');
    }

    const expiresAt = new Date(
      Date.now() + (exotelData.expiration_in_seconds ?? this.fallbackTtlMinutes * 60) * 1000
    );

    return {
      provider,
      providerRequestId: verificationId,
      codeHash: this.hashOtp(phone, verificationId),
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

    if (provider === 'EXOTEL') {
      if (!input.providerRequestId) {
        throw new ServiceUnavailableException('Missing Exotel verification ID for OTP challenge.');
      }

      return this.verifyExotelOtp(input.providerRequestId, input.code);
    }

    throw new ServiceUnavailableException(`Unsupported OTP provider ${input.provider}.`);
  }

  private async startExotelVerification(phone: string) {
    const response = await fetch(
      `https://exoverify.exotel.com/v2/accounts/${this.requireExotelAccountSid()}/verifications/sms`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.requireExotelAppId()}:${this.requireExotelAppSecret()}`
          ).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          application_id: this.requireExotelAppId(),
          phone_number: phone
        })
      }
    );

    const payload = (await response.json()) as ExotelStartResponse;

    if (!response.ok || payload.response.status !== 'success') {
      throw new ServiceUnavailableException(
        payload.response.error_data?.description ?? 'Failed to start Exotel OTP verification.'
      );
    }

    return payload;
  }

  private async verifyExotelOtp(verificationId: string, code: string) {
    const response = await fetch(
      `https://exoverify.exotel.com/v2/accounts/${this.requireExotelAccountSid()}/verifications/sms/${verificationId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.requireExotelAppId()}:${this.requireExotelAppSecret()}`
          ).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          OTP: code
        })
      }
    );

    const payload = (await response.json()) as ExotelVerifyResponse;

    if (response.ok && payload.response.status === 'success') {
      return true;
    }

    const errorCode = payload.response.error_data?.code;
    const description =
      payload.response.error_data?.description ?? 'OTP verification failed with Exotel.';

    if (errorCode === 1210) {
      throw new BadRequestException('OTP has expired. Request a new code.');
    }

    if (errorCode === 1211) {
      return false;
    }

    if (errorCode === 1016) {
      throw new BadRequestException('OTP retry limit reached. Request a new code.');
    }

    throw new ServiceUnavailableException(description);
  }

  private hashOtp(phone: string, value: string) {
    return createHash('sha256')
      .update(`${phone}:${value}`)
      .digest('hex');
  }

  private requireExotelAccountSid() {
    const accountSid = process.env.EXOTEL_ACCOUNT_SID;
    if (!accountSid) {
      throw new ServiceUnavailableException('EXOTEL_ACCOUNT_SID is not configured.');
    }

    return accountSid;
  }

  private requireExotelAppId() {
    const appId = process.env.EXOTEL_APP_ID;
    if (!appId) {
      throw new ServiceUnavailableException('EXOTEL_APP_ID is not configured.');
    }

    return appId;
  }

  private requireExotelAppSecret() {
    const appSecret = process.env.EXOTEL_APP_SECRET;
    if (!appSecret) {
      throw new ServiceUnavailableException('EXOTEL_APP_SECRET is not configured.');
    }

    return appSecret;
  }
}
