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
  sellingPrice: number;
  discountPercent: number;
  voucherType: string;
  minimumOrderValue: number | null;
  redemptionMode: 'ONLINE' | 'IN_STORE' | 'BOTH' | null;
  sellerNotes: string | null;
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
  description: string;
  evidenceUrls: string[];
  evidenceDeadline: string | null;
  sellerResponse: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  adminAlertedAt: string | null;
  createdAt: string;
  order: DisputeOrder;
  raisedBy: { id: string; name: string | null };
}

export interface OrderDetailParty {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  tier: string;
  trustScore: number;
  status: string;
  disputeCount: number;
  buyerStrikes: number;
  sellerStrikes: number;
  payoutHoldUntil?: string | null;
  totalSales?: number;
  createdAt: string;
  payoutAccount?: {
    id: string;
    type: string;
    upiId: string | null;
    accountHolderName: string | null;
    kycStatus: string;
    verifiedAt: string | null;
    razorpayContactId: string | null;
    razorpayFundAccountId: string | null;
  } | null;
}

export interface OrderDetailListing {
  id: string;
  sellerId: string;
  brandId: string;
  voucherType: string;
  faceValue: number;
  sellingPrice: number;
  discountPercent: number;
  status: string;
  verificationStatus: string;
  expiryDate: string;
  proofUrl: string | null;
  minimumOrderValue: number | null;
  redemptionMode: 'ONLINE' | 'IN_STORE' | 'BOTH' | null;
  sellerNotes: string | null;
  buyerId: string | null;
  soldAt: string | null;
  createdAt: string;
  updatedAt: string;
  brand: { id: string; name: string; category: string; logoUrl: string | null };
  codeVault: {
    id: string;
    codeHash: string;
    viewCount: number;
    firstViewedAt: string | null;
    lastViewedAt: string | null;
    createdAt: string;
    encryptedPin: string | null;
  } | null;
}

export interface OrderDetailPayment extends Payment {
  method: string;
  provider: string;
  currency: string;
  razorpayOrderId: string | null;
  razorpaySignature: string | null;
  capturedAt: string | null;
  payoutInitiatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetailDispute {
  id: string;
  orderId: string;
  raisedById: string;
  reason: string;
  description: string;
  evidenceUrls: string[];
  evidenceDeadline: string | null;
  sellerResponse: string | null;
  resolution: string | null;
  status: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  adminAlertedAt: string | null;
  createdAt: string;
  updatedAt: string;
  raisedBy: { id: string; name: string | null; phone: string };
}

export interface OrderDetailNotification {
  id: string;
  eventType: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  userId: string | null;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
  metadata: unknown;
}

export interface OrderDetailAuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  platformFee: number;
  commission: number;
  sellerPayout: number;
  status: string;
  codeRevealedAt: string | null;
  verificationDeadline: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  listing: OrderDetailListing;
  buyer: OrderDetailParty;
  seller: OrderDetailParty;
  payment: OrderDetailPayment | null;
  dispute: OrderDetailDispute | null;
  notifications: OrderDetailNotification[];
  auditLog: OrderDetailAuditLog[];
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

export interface PayoutsSellerSummary extends UserSummary {
  payoutAccount: { kycStatus: string; upiId: string | null } | null;
}

// PendingPayout is an Order with a non-null payment (sellerPayout lives on Order)
export interface PendingPayout extends Omit<Order, 'seller'> {
  payment: Payment;
  seller: PayoutsSellerSummary;
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

export interface AdminListingDetail {
  id: string;
  voucherType: string;
  faceValue: number;
  sellingPrice: number;
  discountPercent: number;
  status: string;
  verificationStatus: string;
  expiryDate: string;
  proofUrl: string | null;
  minimumOrderValue: number | null;
  redemptionMode: 'ONLINE' | 'IN_STORE' | 'BOTH' | null;
  sellerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  brand: { id: string; name: string; category: string; logoUrl: string | null };
  seller: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    tier: string;
    trustScore: number;
    status: string;
    totalSales: number;
    disputeCount: number;
    sellerStrikes: number;
    createdAt: string;
    payoutAccount: { kycStatus: string; upiId: string | null } | null;
  };
  codeVault: {
    id: string;
    codeHash: string;
    viewCount: number;
    firstViewedAt: string | null;
    lastViewedAt: string | null;
    createdAt: string;
    encryptedPin: string | null;
  } | null;
  order: {
    id: string;
    status: string;
    createdAt: string;
    buyer: { id: string; name: string | null; phone: string };
  } | null;
  auditLog: OrderDetailAuditLog[];
}

export interface AdminListing {
  id: string;
  voucherType: string;
  faceValue: number;
  sellingPrice: number;
  discountPercent: number;
  status: string;
  verificationStatus: string;
  expiryDate: string;
  proofUrl: string | null;
  minimumOrderValue: number | null;
  redemptionMode: 'ONLINE' | 'IN_STORE' | 'BOTH' | null;
  sellerNotes: string | null;
  createdAt: string;
  brand: { id: string; name: string; category: string };
  seller: { id: string; name: string | null; phone: string };
}

export interface AppConfigRow {
  key: string;
  value: string;
  valueType: 'number' | 'string' | 'boolean' | 'json';
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
}
