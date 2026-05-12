export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  qBy?: string;
  status?: string;
}

export interface AdminMetrics {
  orders: {
    total: number;
    escrowActive: number;
  };
  disputes: {
    open: number;
    underReview: number;
  };
  payments: {
    totalCapturedInr: number;
    totalRefundedInr: number;
  };
  refunds: {
    processing: number;
    failed: number;
  };
  listings: {
    active: number;
  };
  users: {
    total: number;
  };
  generatedAt: string;
}

export interface Brand {
  id: string;
  name: string;
  category: string;
}

export interface UserSummary {
  id: string;
  name: string | null;
  phone: string;
}

export type RefundStatus = 'NOT_APPLICABLE' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  razorpayPaymentId: string | null;
  escrowStatus: 'PENDING' | 'ACTIVE' | 'RELEASED' | 'REFUNDED' | 'CANCELLED';
  payoutStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  payoutFailureReason: string | null;
  payoutCompletedAt: string | null;
  refundStatus: RefundStatus;
  razorpayRefundId: string | null;
  refundInitiatedAt: string | null;
  refundCompletedAt: string | null;
  refundFailureReason: string | null;
  refundAttempts: number;
}

export interface VoucherListing {
  id: string;
  brand: Brand;
  faceValue: number;
  askPrice: number;
}

export interface Order {
  id: string;
  status: string;
  sellerPayout: number;
  createdAt: string;
  buyer: UserSummary;
  seller: UserSummary;
  listing: VoucherListing;
  payment: Payment | null;
  dispute: Dispute | null;
}

export interface DisputePartyUser {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  tier: string;
  trustScore: number;
  status: string;
  disputeCount: number;
  totalSales: number;
  createdAt: string;
  sellerStrikes?: number;
  buyerStrikes?: number;
  payoutHoldUntil?: string | null;
  payoutAccount?: { kycStatus: string; upiId: string | null } | null;
  _count?: {
    purchases: number;
    disputes: number;
  };
}

export interface DisputeOrder extends Omit<Order, 'buyer' | 'seller'> {
  buyer: DisputePartyUser;
  seller: DisputePartyUser;
  codeRevealedAt: string | null;
  verificationDeadline: string | null;
}

export interface Dispute {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  sellerResponse: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  adminAlertedAt: string | null;
  createdAt: string;
  order: DisputeOrder;
  raisedBy: { id: string; name: string | null };
}

export interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  tier: string;
  trustScore: number;
  status: string;
  disputeCount: number;
  totalSales: number;
  createdAt: string;
  sellerStrikes: number;
  buyerStrikes: number;
  payoutHoldUntil: string | null;
  payoutAccount: { kycStatus: string; upiId: string | null } | null;
}

// PendingPayout is an Order with a non-null payment (sellerPayout lives on Order)
export interface PendingPayout extends Order {
  payment: Payment;
}

// PendingRefund is an Order whose payment is in PROCESSING/FAILED refundStatus.
export interface PendingRefund extends Order {
  payment: Payment;
}

export interface AdminMe {
  id: string | null;
  name: string;
  email: string | null;
  role: 'ADMIN' | 'SUPER_ADMIN';
  kind: 'session' | 'bootstrap';
}

export interface AdminTeamMember {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  active: boolean;
  createdAt: string;
}
