import RazorpayCheckout from 'react-native-razorpay';

export type RazorpayOptions = {
  readonly key: string;
  readonly amount: string;
  readonly currency: string;
  readonly order_id: string;
  readonly name: string;
  readonly description: string;
  readonly prefill?: { readonly contact?: string; readonly name?: string };
  readonly theme?: { readonly color?: string };
};

export type RazorpayPaymentResult = {
  readonly razorpay_payment_id: string;
  readonly razorpay_order_id?: string;
  readonly razorpay_signature?: string;
};

export function openRazorpayCheckout(options: RazorpayOptions): Promise<RazorpayPaymentResult> {
  return RazorpayCheckout.open(options) as Promise<RazorpayPaymentResult>;
}
