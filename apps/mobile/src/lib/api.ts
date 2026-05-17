import { Platform } from 'react-native';
import { AUTH, BRANDS, CONFIG, LISTINGS, NOTIFICATIONS, ORDERS, PAYOUTS, USERS } from './routes';

const sessionHeaderName = 'x-session-token';

export type SessionUser = {
  readonly id: string;
  readonly phone: string;
  readonly name: string;
  readonly email?: string | null;
  readonly status: string;
  readonly tier: 'GOLD' | 'SILVER' | 'BRONZE';
  readonly totalSales: number;
  readonly totalEarned: number;
  readonly totalSaved: number;
};

export type UserStats = {
  readonly trustScore: number;
  readonly tier: 'GOLD' | 'SILVER' | 'BRONZE' | 'BLOCKED';
  readonly nextTierAt: number | null;
  readonly totalSales: number;
  readonly totalEarned: number;
  readonly totalSaved: number;
  readonly purchases: number;
  readonly disputesAgainst: number;
  readonly disputesRaised: number;
  readonly sellerStrikes: number;
  readonly buyerStrikes: number;
  readonly payoutHoldUntil: string | null;
};

export type BrandAlert = {
  readonly id: string;
  readonly userId: string;
  readonly brandId: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly brand: Brand;
};

export type SellerPublicStats = {
  readonly trustScore: number;
  readonly tier: 'GOLD' | 'SILVER' | 'BRONZE' | 'BLOCKED';
  readonly nextTierAt: number | null;
  readonly totalSales: number;
  readonly disputesAgainst: number;
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
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: string;
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
  readonly minimumOrderValue?: number | null;
  readonly redemptionMode?: 'ONLINE' | 'IN_STORE' | 'BOTH' | null;
  readonly sellerNotes?: string | null;
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
  readonly razorpayOrderId: string;
  readonly amountPaise: number;
  readonly currency: string;
  readonly keyId: string;
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
  readonly evidenceDeadline: string | null;
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
  readonly voucherCode: string;
  readonly pin?: string | null;
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
      `${apiBaseUrl}${path}${query.toString() ? `?${query.toString()}` : ''}`,
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
    return apiRequest<OtpRequestResult>(AUTH.OTP_REQUEST, {
      method: 'POST',
      body: input
    });
  },
  verifyOtp(input: {
    readonly phone: string;
    readonly code: string;
    readonly name?: string;
    readonly email?: string;
    readonly deviceId?: string;
  }) {
    return apiRequest<OtpVerifyResult>(AUTH.OTP_VERIFY, {
      method: 'POST',
      body: input
    });
  },
  refreshTokens(refreshToken: string) {
    return apiRequest<Omit<OtpVerifyResult, 'user'>>(AUTH.TOKEN_REFRESH, {
      method: 'POST',
      body: { refreshToken }
    });
  },
  me(sessionToken: string) {
    return apiRequest<SessionUser>(AUTH.ME, {
      sessionToken
    });
  },
  logout(sessionToken: string) {
    return apiRequest<{ readonly success: true }>(AUTH.LOGOUT, {
      method: 'POST',
      sessionToken
    });
  },
  listBrands(input?: {
    readonly q?: string;
    readonly limit?: number;
  }) {
    return apiRequest<readonly Brand[]>(BRANDS.LIST, {
      query: input
    });
  },
  getPublicConfig() {
    return apiRequest<{
      readonly buyerFeeRate: number;
      readonly sellerCommissionRate: number;
      readonly listingMaxPriceInr: number;
    }>(CONFIG.PUBLIC);
  },
  listListings(
    input: {
      readonly q?: string;
      readonly category?: string;
      readonly sort?: string;
      readonly maxPrice?: number;
      readonly minDiscount?: number;
    },
    sessionToken?: string | null
  ) {
    return apiRequest<readonly Listing[]>(LISTINGS.LIST, {
      query: input,
      ...(sessionToken ? { sessionToken } : {}),
    });
  },
  getDealOfDay() {
    return apiRequest<Listing | null>(LISTINGS.DEAL_OF_DAY);
  },
  getListing(id: string) {
    return apiRequest<Listing>(LISTINGS.BY_ID(id));
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
      readonly pin?: string;
      readonly minimumOrderValue?: number;
      readonly redemptionMode?: 'ONLINE' | 'IN_STORE' | 'BOTH';
      readonly sellerNotes?: string;
    }
  ) {
    return apiRequest<Listing>(LISTINGS.CREATE, {
      method: 'POST',
      sessionToken,
      body: input
    });
  },
  listMyListings(sessionToken: string) {
    return apiRequest<readonly Listing[]>(LISTINGS.SELLER_INVENTORY, {
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
      readonly pin?: string;
      readonly minimumOrderValue?: number;
      readonly redemptionMode?: 'ONLINE' | 'IN_STORE' | 'BOTH';
      readonly sellerNotes?: string;
    }
  ) {
    return apiRequest<Listing>(LISTINGS.BY_ID(id), {
      method: 'PATCH',
      sessionToken,
      body: input
    });
  },
  deleteListing(sessionToken: string, id: string) {
    return apiRequest<{ readonly success: true }>(LISTINGS.BY_ID(id), {
      method: 'DELETE',
      sessionToken
    });
  },
  listOrders(sessionToken: string) {
    return apiRequest<readonly Order[]>(ORDERS.LIST, {
      sessionToken
    });
  },
  getOrder(sessionToken: string, id: string) {
    return apiRequest<Order>(ORDERS.BY_ID(id), {
      sessionToken
    });
  },
  createOrder(sessionToken: string, listingId: string) {
    return apiRequest<CreateOrderResult>(ORDERS.CREATE, {
      method: 'POST',
      sessionToken,
      body: {
        listingId
      }
    });
  },
  prepareCheckout(sessionToken: string, orderId: string) {
    return apiRequest<CreateOrderResult>(ORDERS.CHECKOUT(orderId), {
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
    return apiRequest<Order>(ORDERS.PAYMENTS_VERIFY(orderId), {
      method: 'POST',
      sessionToken,
      body: input
    });
  },
  syncPayment(sessionToken: string, orderId: string) {
    return apiRequest<{ readonly synced: boolean; readonly status: string }>(ORDERS.PAYMENTS_SYNC(orderId), {
      method: 'POST',
      sessionToken
    });
  },
  revealCode(sessionToken: string, orderId: string) {
    return apiRequest<RevealResult>(ORDERS.REVEAL(orderId), {
      method: 'POST',
      sessionToken
    });
  },
  confirmOrder(sessionToken: string, orderId: string) {
    return apiRequest<Order>(ORDERS.CONFIRM(orderId), {
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
    }
  ) {
    return apiRequest<Dispute>(ORDERS.DISPUTES(orderId), {
      method: 'POST',
      sessionToken,
      body: input
    });
  },
  async uploadDisputeEvidence(
    sessionToken: string,
    orderId: string,
    localUri: string,
    mimeType: string
  ): Promise<{ key: string; totalCount: number; deadlineAt: string | null }> {
    const filename = localUri.split('/').pop() ?? 'evidence.jpg';
    const formData = new FormData();
    formData.append('file', { uri: localUri, name: filename, type: mimeType } as unknown as Blob);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, 30_000);
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/orders/${orderId}/dispute-evidence`, {
        method: 'POST',
        headers: { 'x-session-token': sessionToken },
        body: formData,
        signal: controller.signal,
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new ApiError('Upload timed out. Check your connection.', 408);
      }
      throw new ApiError('Could not reach the server.', 0);
    } finally {
      clearTimeout(timeoutId);
    }

    const payload = (await response.json().catch(() => null)) as
      | { key: string; totalCount: number; deadlineAt: string | null; message?: string }
      | null;

    if (!response.ok) {
      throw new ApiError(payload?.message ?? 'Upload failed.', response.status);
    }

    return payload as { key: string; totalCount: number; deadlineAt: string | null };
  },
  getPayoutAccount(sessionToken: string) {
    return apiRequest<PayoutAccount>(PAYOUTS.ME, { sessionToken });
  },
  registerPayoutAccount(sessionToken: string, input: { readonly type: 'UPI'; readonly upiId: string }) {
    return apiRequest<PayoutAccount>(PAYOUTS.REGISTER, {
      method: 'POST',
      sessionToken,
      body: input
    });
  },
  listNotifications(sessionToken: string) {
    return apiRequest<readonly NotificationItem[]>(NOTIFICATIONS.LIST, {
      sessionToken
    });
  },
  markAllNotificationsRead(sessionToken: string) {
    return apiRequest<undefined>(NOTIFICATIONS.READ_ALL, { method: 'POST', sessionToken });
  },
  clearAllNotifications(sessionToken: string) {
    return apiRequest<undefined>(NOTIFICATIONS.CLEAR_ALL, { method: 'DELETE', sessionToken });
  },
  markNotificationRead(sessionToken: string, notificationId: string) {
    return apiRequest<NotificationItem>(NOTIFICATIONS.BY_ID_READ(notificationId), {
      method: 'POST',
      sessionToken
    });
  },
  updateMe(sessionToken: string, input: { readonly name?: string; readonly email?: string | null }) {
    return apiRequest<SessionUser>(USERS.ME, {
      method: 'PATCH',
      sessionToken,
      body: input,
    });
  },
  getMyStats(sessionToken: string) {
    return apiRequest<UserStats>(USERS.ME_STATS, { sessionToken });
  },
  getSellerPublicStats(sellerId: string) {
    return apiRequest<SellerPublicStats>(USERS.SELLER_PUBLIC_STATS(sellerId));
  },
  registerPushToken(
    sessionToken: string,
    input: {
      readonly deviceId: string;
      readonly token: string;
      readonly platform: 'IOS' | 'ANDROID' | 'WEB';
    }
  ) {
    return apiRequest<unknown>(USERS.PUSH_TOKENS, {
      method: 'POST',
      sessionToken,
      body: input,
    });
  },
  async unregisterPushToken(sessionToken: string, deviceId: string) {
    return apiRequest<unknown>(USERS.PUSH_TOKEN_BY_DEVICE(deviceId), {
      method: 'DELETE',
      sessionToken,
    });
  },

  // ─── Watchlist / Alerts ───────────────────────────────────────────────────

  async listAlerts(sessionToken: string) {
    return apiRequest<BrandAlert[]>('/alerts', { sessionToken });
  },

  async createAlert(sessionToken: string, brandId: string) {
    return apiRequest<BrandAlert>(`/alerts/${brandId}`, {
      method: 'POST',
      sessionToken,
    });
  },

  async removeAlert(sessionToken: string, brandId: string) {
    return apiRequest<unknown>(`/alerts/${brandId}`, {
      method: 'DELETE',
      sessionToken,
    });
  },
};
