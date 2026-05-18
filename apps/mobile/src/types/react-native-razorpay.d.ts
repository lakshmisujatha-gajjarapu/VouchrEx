// Type shim for react-native-razorpay v3.
// The package ships .js only with no 'types' field; this file provides type
// checking. Metro resolves the real package at runtime.

declare module 'react-native-razorpay' {
  export interface RazorpayOptions {
    readonly key: string;
    readonly amount: number | string;
    readonly currency?: string;
    readonly name?: string;
    readonly description?: string;
    readonly image?: string;
    readonly order_id?: string;
    readonly prefill?: {
      readonly name?: string;
      readonly email?: string;
      readonly contact?: string;
    };
    readonly notes?: Record<string, string>;
    readonly theme?: {
      readonly color?: string;
      readonly hide_topbar?: boolean;
    };
    readonly modal?: {
      readonly backdropclose?: boolean;
      readonly escape?: boolean;
      readonly handleback?: boolean;
      readonly confirm_close?: boolean;
      readonly ondismiss?: () => void;
      readonly animation?: boolean;
    };
    readonly timeout?: number;
    readonly [key: string]: unknown;
  }

  export interface PaymentSuccessData {
    readonly razorpay_payment_id: string;
    readonly razorpay_order_id?: string;
    readonly razorpay_signature?: string;
    readonly [key: string]: unknown;
  }

  export interface PaymentErrorData {
    readonly code: number;
    readonly description: string;
    readonly source?: string;
    readonly step?: string;
    readonly reason?: string;
    readonly metadata?: {
      readonly order_id?: string;
      readonly payment_id?: string;
      readonly [key: string]: unknown;
    };
  }

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<PaymentSuccessData>;
  };

  export default RazorpayCheckout;
}
