// Type shim for @msg91comm/sendotp-react-native.
// TypeScript uses this file for type checking; Metro bundler resolves the real package at runtime.
// sendOTP/verifyOTP return undefined if the widget was not initialized first.

export declare const OTPWidget: {
  initializeWidget(widgetId: string, tokenAuth: string): void;
  sendOTP(data: { readonly identifier: string }): Promise<{
    type: 'success' | 'error';
    message: string | undefined; // reqId on success
    'access-token'?: string;
  } | undefined>;
  verifyOTP(data: { readonly reqId: string; readonly otp: string }): Promise<{
    type: 'success' | 'error';
    message: string | undefined; // JWT on success, error text on failure
    'access-token'?: string;     // fallback field, prefer message
  } | undefined>;
};
