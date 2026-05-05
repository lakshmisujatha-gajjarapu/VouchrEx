const WIDGET_ID = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID ?? '';
const TOKEN_AUTH = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH ?? '';

type Msg91Response = {
  readonly type: 'success' | 'error';
  readonly message?: string;
};

async function msg91Post(endpoint: string, body: Record<string, string>): Promise<Msg91Response> {
  const res = await fetch(`https://control.msg91.com/api/v5/widget/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ widgetId: WIDGET_ID, tokenAuth: TOKEN_AUTH, ...body }),
  });
  return res.json() as Promise<Msg91Response>;
}

// No-op — direct HTTP needs no SDK initialization.
export function initMsg91() {}

export async function msg91SendOtp(phone: string): Promise<string> {
  const identifier = phone.replace(/^\+/, '');
  const result = await msg91Post('sendOtpMobile', { identifier });
  // MSG91 sendOTP stores reqId in the `message` field on success
  if (result.type !== 'success' || !result.message) {
    throw new Error(result.message ?? 'Failed to send OTP. Please try again.');
  }
  return result.message;
}

export async function msg91VerifyOtp(reqId: string, otp: string): Promise<string> {
  const result = await msg91Post('verifyOtp', { reqId, otp });
  // MSG91 verifyOTP stores the JWT access token in the `message` field on success
  if (result.type !== 'success' || !result.message) {
    throw new Error('OTP verification failed. Please try again.');
  }
  return result.message;
}
