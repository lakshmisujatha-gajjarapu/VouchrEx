import { Platform } from 'react-native';

const sessionHeaderName = 'x-session-token';

export type SessionUser = {
  readonly id: string;
  readonly phone: string;
  readonly name: string;
  readonly email?: string | null;
  readonly status: string;
};

export type OtpRequestResult = {
  readonly phone: string;
  readonly expiresAt: string;
  readonly deliveryChannel: string;
  readonly isNewUser: boolean;
  readonly pendingProfileName?: string;
  readonly debugCode?: string;
};

export type OtpVerifyResult = {
  readonly sessionToken: string;
  readonly expiresAt: string;
  readonly user: SessionUser;
};

export type PayoutAccount = {
  readonly registered: boolean;
  readonly type?: 'UPI' | 'BANK_ACCOUNT';
  readonly upiId?: string;
  readonly accountHolderName?: string;
  readonly kycStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  readonly verifiedAt?: string;
};

export type Brand = {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly avgDiscountPercent: number;
  readonly verificationWindowHours: number;
  readonly logoUrl?: string | null;
};

export type Listing = {
  readonly id: string;
  readonly sellerId: string;
  readonly brandId: string;
  readonly voucherType: string;
  readonly faceValue: number;
  readonly sellingPrice: number;
  readonly discountPercent: number;
  readonly status: string;
  readonly expiryDate: string;
  readonly proofUrl?: string | null;
  readonly createdAt: string;
  readonly brand: Brand;
  readonly order?: {
    readonly id: string;
    readonly status: string;
  } | null;
  readonly seller: Pick<SessionUser, 'id' | 'name'> & { readonly trustTier?: 'gold' | 'silver' | 'bronze' | null };
};

export type Checkout = {
  readonly provider: 'RAZORPAY';
  readonly paymentLinkUrl: string;
  readonly paymentLinkId: string;
};

export type Payment = {
  readonly orderId: string;
  readonly amount: number;
  readonly method: string;
  readonly status: string;
  readonly escrowStatus: string;
  readonly provider: 'RAZORPAY';
  readonly currency: string;
  readonly razorpayOrderId?: string | null;
  readonly razorpayPaymentId?: string | null;
  readonly capturedAt?: string | null;
};

export type Dispute = {
  readonly id: string;
  readonly orderId: string;
  readonly reason: string;
  readonly description: string;
  readonly evidenceUrls: readonly string[];
  readonly status: string;
  readonly resolution?: string | null;
};

export type Order = {
  readonly id: string;
  readonly listingId: string;
  readonly buyerId: string;
  readonly sellerId: string;
  readonly amount: number;
  readonly platformFee: number;
  readonly commission: number;
  readonly sellerPayout: number;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly codeRevealedAt?: string | null;
  readonly verificationDeadline?: string | null;
  readonly confirmedAt?: string | null;
  readonly listing: Listing;
  readonly buyer?: Pick<SessionUser, 'id' | 'name' | 'phone'>;
  readonly seller?: Pick<SessionUser, 'id' | 'name' | 'phone'>;
  readonly payment?: Payment | null;
  readonly dispute?: Dispute | null;
};

export type CreateOrderResult = {
  readonly order: Order;
  readonly checkout: Checkout;
};

export type RevealResult = {
  readonly watermarkedCodeImageUrl: string;
  readonly verificationDeadline: string;
  readonly revealCount: number;
  readonly verificationWindowHours: number;
};

export type NotificationItem = {
  readonly id: string;
  readonly eventType: string;
  readonly title: string;
  readonly message: string;
  readonly channel: string;
  readonly status: string;
  readonly createdAt: string;
  readonly readAt?: string | null;
};

type RequestOptions = {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly sessionToken?: string | null;
  readonly query?: Record<string, string | number | undefined>;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function resolveApiBaseUrl() {
  const rawEnvUrl: unknown = process.env.EXPO_PUBLIC_API_BASE_URL;
  const envUrl = typeof rawEnvUrl === 'string' ? rawEnvUrl.trim() : '';
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3010';
  }

  return 'http://localhost:3010';
}

export const apiBaseUrl = resolveApiBaseUrl();

const REQUEST_TIMEOUT_MS = 15_000;

async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `${apiBaseUrl}${path}${query.size > 0 ? `?${query.toString()}` : ''}`,
      {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.sessionToken ? { [sessionHeaderName]: options.sessionToken } : {})
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        signal: controller.signal,
      }
    );
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiError('Request timed out. Check your connection and try again.', 408);
    }
    throw new ApiError('Could not reach the server. Check your connection.', 0);
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = (await response.json().catch(() => null)) as
    | { readonly message?: string | readonly string[] }
    | null;

  if (!response.ok) {
    const rawMessage = payload?.message;
    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : Array.isArray(rawMessage)
          ? rawMessage.join(', ')
          : 'Request failed.';
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export const api = {
  requestOtp(input: {
    readonly phone: string;
    readonly name?: string;
    readonly deviceId?: string;
  }) {
    return apiRequest<OtpRequestResult>('/auth/otp/request', {
      method: 'POST',
      body: input
    });
  },
  verifyOtp(input: {
    readonly phone: string;
    readonly code: string;
    readonly name?: string;
    readonly email?: string;
  }) {
    return apiRequest<OtpVerifyResult>('/auth/otp/verify', {
      method: 'POST',
      body: input
    });
  },
  me(sessionToken: string) {
    return apiRequest<SessionUser>('/auth/me', {
      sessionToken
    });
  },
  logout(sessionToken: string) {
    return apiRequest<{ readonly success: true }>('/auth/logout', {
      method: 'POST',
      sessionToken
    });
  },
  listBrands(input?: {
    readonly q?: string;
    readonly limit?: number;
  }) {
    return apiRequest<readonly Brand[]>('/brands', {
      query: input
    });
  },
  listListings(input: {
    readonly q?: string;
    readonly category?: string;
    readonly sort?: string;
    readonly maxPrice?: number;
    readonly minDiscount?: number;
  }) {
    return apiRequest<readonly Listing[]>('/listings', {
      query: input
    });
  },
  getListing(id: string) {
    return apiRequest<Listing>(`/listings/${id}`);
  },
  createListing(
    sessionToken: string,
    input: {
      readonly brandId?: string;
      readonly brandName?: string;
      readonly voucherType: string;
      readonly faceValue: number;
      readonly sellingPrice: number;
      readonly expiryDate: string;
      readonly code: string;
      readonly proofUrl?: string;
    }
  ) {
    return apiRequest<Listing>('/listings', {
      method: 'POST',
      sessionToken,
      body: input
    });
  },
  listMyListings(sessionToken: string) {
    return apiRequest<readonly Listing[]>('/listings/seller/inventory', {
      sessionToken
    });
  },
  updateListing(
    sessionToken: string,
    id: string,
    input: {
      readonly brandId?: string;
      readonly brandName?: string;
      readonly voucherType?: string;
      readonly faceValue?: number;
      readonly sellingPrice?: number;
      readonly expiryDate?: string;
      readonly code?: string;
      readonly proofUrl?: string;
    }
  ) {
    return apiRequest<Listing>(`/listings/${id}`, {
      method: 'PATCH',
      sessionToken,
      body: input
    });
  },
  deleteListing(sessionToken: string, id: string) {
    return apiRequest<{ readonly success: true }>(`/listings/${id}`, {
      method: 'DELETE',
      sessionToken
    });
  },
  listOrders(sessionToken: string) {
    return apiRequest<readonly Order[]>('/orders', {
      sessionToken
    });
  },
  getOrder(sessionToken: string, id: string) {
    return apiRequest<Order>(`/orders/${id}`, {
      sessionToken
    });
  },
  createOrder(sessionToken: string, listingId: string) {
    return apiRequest<CreateOrderResult>('/orders', {
      method: 'POST',
      sessionToken,
      body: {
        listingId
      }
    });
  },
  prepareCheckout(sessionToken: string, orderId: string) {
    return apiRequest<CreateOrderResult>(`/orders/${orderId}/checkout`, {
      method: 'POST',
      sessionToken
    });
  },
  verifyPayment(
    sessionToken: string,
    orderId: string,
    input: {
      readonly method: string;
      readonly razorpayOrderId?: string;
      readonly razorpayPaymentId?: string;
      readonly razorpaySignature?: string;
    }
  ) {
    return apiRequest<Order>(`/orders/${orderId}/payments/verify`, {
      method: 'POST',
      sessionToken,
      body: input
    });
  },
  syncPayment(sessionToken: string, orderId: string) {
    return apiRequest<{ readonly synced: boolean; readonly status: string }>(`/orders/${orderId}/payments/sync`, {
      method: 'POST',
      sessionToken
    });
  },
  revealCode(sessionToken: string, orderId: string) {
    return apiRequest<RevealResult>(`/orders/${orderId}/reveal`, {
      method: 'POST',
      sessionToken
    });
  },
  confirmOrder(sessionToken: string, orderId: string) {
    return apiRequest<Order>(`/orders/${orderId}/confirm`, {
      method: 'POST',
      sessionToken
    });
  },
  createDispute(
    sessionToken: string,
    orderId: string,
    input: {
      readonly reason: string;
      readonly description: string;
      readonly evidenceUrls?: readonly string[];
    }
  ) {
    return apiRequest<Dispute>(`/orders/${orderId}/disputes`, {
      method: 'POST',
      sessionToken,
      body: input
    });
  },
  getPayoutAccount(sessionToken: string) {
    return apiRequest<PayoutAccount>('/payout-accounts/me', { sessionToken });
  },
  registerPayoutAccount(sessionToken: string, input: { readonly type: 'UPI'; readonly upiId: string }) {
    return apiRequest<PayoutAccount>('/payout-accounts', {
      method: 'POST',
      sessionToken,
      body: input
    });
  },
  listNotifications(sessionToken: string) {
    return apiRequest<readonly NotificationItem[]>('/notifications', {
      sessionToken
    });
  },
  markAllNotificationsRead(sessionToken: string) {
    return apiRequest<undefined>('/notifications/read-all', { method: 'POST', sessionToken });
  },
  clearAllNotifications(sessionToken: string) {
    return apiRequest<undefined>('/notifications', { method: 'DELETE', sessionToken });
  },
  markNotificationRead(sessionToken: string, notificationId: string) {
    return apiRequest<NotificationItem>(`/notifications/${notificationId}/read`, {
      method: 'POST',
      sessionToken
    });
  }
};
