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

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.Razorpay !== 'undefined') { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => { resolve(); };
    script.onerror = () => { reject(new Error('Failed to load Razorpay checkout script.')); };
    document.head.appendChild(script);
  });
}

export async function openRazorpayCheckout(options: RazorpayOptions): Promise<RazorpayPaymentResult> {
  await loadRazorpayScript();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      ...options,
      handler: (response: RazorpayPaymentResult) => { resolve(response); },
      modal: {
        ondismiss: () => { reject(new Error('Payment cancelled.')); },
      },
    });
    rzp.open();
  });
}
