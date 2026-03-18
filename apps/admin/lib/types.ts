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

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  escrowStatus: 'PENDING' | 'ACTIVE' | 'RELEASED' | 'REFUNDED' | 'CANCELLED';
  payoutCompletedAt: string | null;
  refundCompletedAt: string | null;
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

export interface Dispute {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  sellerResponse: string | null;
  resolution: string | null;
  createdAt: string;
  order: Order;
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
  createdAt: string;
}

// PendingPayout is an Order with a non-null payment (sellerPayout lives on Order)
export interface PendingPayout extends Order {
  payment: Payment;
}
