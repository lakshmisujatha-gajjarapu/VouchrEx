declare module 'react-native-razorpay' {
  type RazorpayOptions = {
    readonly key: string;
    readonly amount: string;
    readonly currency: string;
    readonly order_id: string;
    readonly name: string;
    readonly description?: string;
    readonly image?: string;
    readonly prefill?: {
      readonly name?: string;
      readonly email?: string;
      readonly contact?: string;
    };
    readonly theme?: {
      readonly color?: string;
    };
    readonly modal?: {
      readonly ondismiss?: () => void;
    };
  };

  type RazorpaySuccess = {
    readonly razorpay_payment_id: string;
    readonly razorpay_order_id: string;
    readonly razorpay_signature: string;
  };

  export type RazorpayError = {
    readonly code: number;
    readonly description: string;
  };

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccess>;
  };

  export default RazorpayCheckout;
}
