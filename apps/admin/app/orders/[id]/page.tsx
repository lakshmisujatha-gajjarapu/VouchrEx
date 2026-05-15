import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getOrder } from '@/lib/api';
import { formatCurrency, formatDateTime, formatPhone, formatShortId, getRelativeTime } from '@/lib/utils';
import type { OrderDetail, OrderDetailParty, OrderDetailPayment } from '@/lib/types';
import { OrderActions } from './order-actions';

export const metadata: Metadata = { title: 'Order Detail | VouchrEx Admin' };

interface PageProps {
  params: Promise<{ id: string }>;
}

function statusBadgeStyle(status: string): { bg: string; color: string } {
  if (status === 'ESCROW_ACTIVE') return { bg: 'var(--color-warning-soft)',     color: 'var(--color-warning)' };
  if (status === 'DISPUTED')      return { bg: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' };
  if (status === 'CONFIRMED')     return { bg: 'var(--color-success-soft)',     color: 'var(--color-success)' };
  if (status === 'CANCELLED')     return { bg: 'var(--color-surface-high)',     color: 'var(--color-muted-foreground)' };
  if (status === 'COMPLETED')     return { bg: 'var(--color-success-soft)',     color: 'var(--color-success)' };
  if (status === 'FAILED')        return { bg: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' };
  if (status === 'REFUNDED')      return { bg: 'var(--color-success-soft)',     color: 'var(--color-success)' };
  if (status === 'OPEN')          return { bg: 'var(--color-warning-soft)',     color: 'var(--color-warning)' };
  if (status === 'RESOLVED')      return { bg: 'var(--color-success-soft)',     color: 'var(--color-success)' };
  return                                 { bg: 'var(--color-primary-soft)',     color: 'var(--color-primary)' };
}

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
      <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, mono = false, accent }: { readonly label: string; readonly value: React.ReactNode; readonly mono?: boolean; readonly accent?: 'success' | 'warning' | 'destructive' }) {
  const color = accent === 'success' ? 'var(--color-success)'
    : accent === 'warning' ? 'var(--color-warning)'
    : accent === 'destructive' ? 'var(--color-destructive)'
    : 'var(--color-foreground)';
  const displayed: React.ReactNode = value === null || value === undefined || value === '' ? '—' : value;
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-4 text-sm" style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)' }}>
      <div className="text-xs uppercase tracking-widest pt-0.5" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>{label}</div>
      <div className="break-all" style={{ color, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)' }}>{displayed}</div>
    </div>
  );
}

function Badge({ status }: { readonly status: string }) {
  const s = statusBadgeStyle(status);
  return <span className="status-badge" style={{ backgroundColor: s.bg, color: s.color }}>{status.replace(/_/g, ' ')}</span>;
}

function PartyCard({ role, user }: { readonly role: 'Buyer' | 'Seller'; readonly user: OrderDetailParty }) {
  const strikes = role === 'Seller' ? user.sellerStrikes : user.buyerStrikes;
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>{role}</p>
        <Badge status={user.tier} />
      </div>
      <div>
        <p className="font-semibold" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{user.name ?? 'Unnamed'}</p>
        <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>{user.id}</p>
      </div>
      <div className="text-xs space-y-0.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
        <p>{formatPhone(user.phone)}</p>
        {user.email && <p style={{ color: 'var(--color-muted-foreground)' }}>{user.email}</p>}
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
        <div><p style={{ color: 'var(--color-muted-foreground)' }}>Trust</p><p>{user.trustScore}</p></div>
        <div><p style={{ color: 'var(--color-muted-foreground)' }}>Disputes</p><p>{user.disputeCount}</p></div>
        <div><p style={{ color: 'var(--color-muted-foreground)' }}>Sales</p><p>{user.totalSales ?? 0}</p></div>
        <div><p style={{ color: 'var(--color-muted-foreground)' }}>Strikes</p><p style={{ color: strikes >= 1 ? 'var(--color-destructive)' : 'var(--color-foreground)' }}>{strikes}</p></div>
      </div>
      <div className="flex items-center justify-between text-xs" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-muted-foreground)' }}>
        <span>Status: <span style={{ color: 'var(--color-foreground)' }}>{user.status}</span></span>
        <span>Joined {getRelativeTime(user.createdAt)}</span>
      </div>
      {user.payoutHoldUntil && (
        <div className="text-xs" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-destructive)' }}>
          Payout hold until {formatDateTime(user.payoutHoldUntil)}
        </div>
      )}
      {user.payoutAccount && (
        <div className="rounded-lg p-3 space-y-1 text-xs" style={{ backgroundColor: 'var(--color-surface-high)', fontFamily: 'var(--font-body)' }}>
          <p className="font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>Payout account</p>
          <p>Type: <span style={{ color: 'var(--color-foreground)' }}>{user.payoutAccount.type}</span></p>
          {user.payoutAccount.upiId && <p>UPI: <span style={{ color: 'var(--color-foreground)' }}>{user.payoutAccount.upiId}</span></p>}
          {user.payoutAccount.accountHolderName && <p>Holder: <span style={{ color: 'var(--color-foreground)' }}>{user.payoutAccount.accountHolderName}</span></p>}
          <p>KYC: <span style={{ color: 'var(--color-foreground)' }}>{user.payoutAccount.kycStatus}</span>{user.payoutAccount.verifiedAt && <> (verified {getRelativeTime(user.payoutAccount.verifiedAt)})</>}</p>
          {user.payoutAccount.razorpayContactId && <p style={{ fontFamily: 'var(--font-mono)' }}>contact: {user.payoutAccount.razorpayContactId}</p>}
          {user.payoutAccount.razorpayFundAccountId && <p style={{ fontFamily: 'var(--font-mono)' }}>fund: {user.payoutAccount.razorpayFundAccountId}</p>}
        </div>
      )}
    </div>
  );
}

function MoneyBreakdown({ order, payment }: { readonly order: OrderDetail; readonly payment: OrderDetailPayment | null }) {
  const paid = payment?.amount ?? null;
  const refunded = payment?.refundStatus === 'COMPLETED' ? payment.amount : (payment?.refundStatus === 'PROCESSING' ? payment.amount : 0);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Row label="Listing price"       value={formatCurrency(order.amount)} />
      <Row label="Platform fee (buyer)"  value={formatCurrency(order.platformFee)} />
      <Row label="Buyer paid (gross)"    value={paid !== null ? formatCurrency(paid) : '—'} accent="success" />
      <Row label="Commission (seller)"   value={formatCurrency(order.commission)} />
      <Row label="Seller payout (net)"   value={formatCurrency(order.sellerPayout)} accent={payment?.payoutStatus === 'COMPLETED' ? 'success' : undefined} />
      <Row label="Refunded"              value={refunded ? formatCurrency(refunded) : '—'} accent={refunded ? 'destructive' : undefined} />
    </div>
  );
}

function JsonBlock({ value }: { readonly value: unknown }) {
  if (value === null || value === undefined) return <span style={{ color: 'var(--color-muted-foreground)' }}>—</span>;
  return (
    <pre className="text-xs rounded-lg p-2 overflow-x-auto" style={{ backgroundColor: 'var(--color-surface-high)', fontFamily: 'var(--font-mono)', color: 'var(--color-foreground)' }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  let order: OrderDetail;
  try {
    order = await getOrder(id);
  } catch {
    notFound();
  }
  const { listing, buyer, seller, payment, dispute, notifications, auditLog } = order;

  return (
    <div className="p-8 animate-slide-up space-y-6 max-w-6xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/orders" className="text-xs underline" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>← All orders</Link>
          <h1 className="mt-2" style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)' }}>
            Order {formatShortId(order.id)}
          </h1>
          <p className="text-xs mt-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>{order.id}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge status={order.status} />
          {dispute && (
            <Link href={`/disputes?status=${dispute.status}`} className="text-xs underline" style={{ color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
              dispute {dispute.status.toLowerCase().replace('_', ' ')}
            </Link>
          )}
          <p className="text-xs" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-muted-foreground)' }}>
            Created {formatDateTime(order.createdAt)} · Updated {getRelativeTime(order.updatedAt)}
          </p>
        </div>
      </header>

      <Section title="Money breakdown">
        <MoneyBreakdown order={order} payment={payment} />
      </Section>

      <Section title="Order">
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Order ID"               value={order.id} mono />
          <Row label="Status"                 value={<Badge status={order.status} />} />
          <Row label="Listing ID"             value={order.listingId} mono />
          <Row label="Buyer ID"               value={order.buyerId} mono />
          <Row label="Seller ID"              value={order.sellerId} mono />
          <Row label="Code revealed at"       value={order.codeRevealedAt ? formatDateTime(order.codeRevealedAt) : '—'} />
          <Row label="Verification deadline"  value={order.verificationDeadline ? formatDateTime(order.verificationDeadline) : '—'} />
          <Row label="Confirmed at"           value={order.confirmedAt ? formatDateTime(order.confirmedAt) : '—'} />
          <Row label="Created at"             value={formatDateTime(order.createdAt)} />
          <Row label="Updated at"             value={formatDateTime(order.updatedAt)} />
        </div>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Buyer">
          <PartyCard role="Buyer" user={buyer} />
        </Section>
        <Section title="Seller">
          <PartyCard role="Seller" user={seller} />
        </Section>
      </div>

      <Section title="Listing">
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Listing ID"            value={listing.id} mono />
          <Row label="Brand"                 value={`${listing.brand.name} (${listing.brand.category})`} />
          <Row label="Brand ID"              value={listing.brandId} mono />
          <Row label="Voucher type"          value={listing.voucherType} />
          <Row label="Face value"            value={formatCurrency(listing.faceValue)} />
          <Row label="Selling price"         value={formatCurrency(listing.sellingPrice)} />
          <Row label="Discount %"            value={`${listing.discountPercent.toFixed(1)}%`} />
          <Row label="Status"                value={<Badge status={listing.status} />} />
          <Row label="Verification status"   value={<Badge status={listing.verificationStatus} />} />
          <Row label="Expiry"                value={formatDateTime(listing.expiryDate)} />
          <Row label="Proof URL"             value={listing.proofUrl ? <a href={listing.proofUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--color-primary)' }}>view</a> : '—'} />
          <Row label="Redemption mode"       value={listing.redemptionMode ?? '—'} />
          <Row label="Min. spend"            value={listing.minimumOrderValue ? formatCurrency(listing.minimumOrderValue) : '—'} />
          <Row label="Seller notes"          value={listing.sellerNotes ?? '—'} />
          <Row label="Buyer ID"              value={listing.buyerId ?? '—'} mono />
          <Row label="Sold at"               value={listing.soldAt ? formatDateTime(listing.soldAt) : '—'} />
          <Row label="Created"               value={formatDateTime(listing.createdAt)} />
          <Row label="Updated"               value={formatDateTime(listing.updatedAt)} />
        </div>
        {listing.codeVault && (
          <div className="rounded-xl p-4 mt-2 space-y-2" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Code vault</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Row label="Vault ID"      value={listing.codeVault.id} mono />
              <Row label="Code hash"     value={listing.codeVault.codeHash} mono />
              <Row label="View count"    value={listing.codeVault.viewCount} />
              <Row label="First viewed"  value={listing.codeVault.firstViewedAt ? formatDateTime(listing.codeVault.firstViewedAt) : '—'} />
              <Row label="Last viewed"   value={listing.codeVault.lastViewedAt ? formatDateTime(listing.codeVault.lastViewedAt) : '—'} />
              <Row label="Vault created" value={formatDateTime(listing.codeVault.createdAt)} />
              <Row label="PIN stored"    value={listing.codeVault.encryptedPin ? 'Yes' : 'No'} />
            </div>
          </div>
        )}
      </Section>

      <Section title="Payment">
        {!payment ? (
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>No payment record (order never paid).</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Row label="Payment ID"        value={payment.id} mono />
            <Row label="Status"            value={<Badge status={payment.status} />} />
            <Row label="Amount"            value={formatCurrency(payment.amount)} accent="success" />
            <Row label="Method"            value={payment.method} />
            <Row label="Provider"          value={payment.provider} />
            <Row label="Currency"          value={payment.currency} />
            <Row label="Razorpay payment"  value={payment.razorpayPaymentId} mono />
            <Row label="Razorpay order"    value={payment.razorpayOrderId} mono />
            <Row label="Razorpay sig"      value={payment.razorpaySignature} mono />
            <Row label="Captured at"       value={payment.capturedAt ? formatDateTime(payment.capturedAt) : '—'} />
            <Row label="Escrow status"     value={<Badge status={payment.escrowStatus} />} />
            <Row label="Payout status"     value={<Badge status={payment.payoutStatus} />} />
            <Row label="Payout initiated"  value={payment.payoutInitiatedAt ? formatDateTime(payment.payoutInitiatedAt) : '—'} />
            <Row label="Payout completed"  value={payment.payoutCompletedAt ? formatDateTime(payment.payoutCompletedAt) : '—'} />
            <Row label="Payout failure"    value={payment.payoutFailureReason} accent={payment.payoutFailureReason ? 'destructive' : undefined} />
            <Row label="Refund status"     value={<Badge status={payment.refundStatus} />} />
            <Row label="Refund attempts"   value={payment.refundAttempts} />
            <Row label="Razorpay refund"   value={payment.razorpayRefundId} mono />
            <Row label="Refund initiated"  value={payment.refundInitiatedAt ? formatDateTime(payment.refundInitiatedAt) : '—'} />
            <Row label="Refund completed"  value={payment.refundCompletedAt ? formatDateTime(payment.refundCompletedAt) : '—'} />
            <Row label="Refund failure"    value={payment.refundFailureReason} accent={payment.refundFailureReason ? 'destructive' : undefined} />
            <Row label="Created"           value={formatDateTime(payment.createdAt)} />
            <Row label="Updated"           value={formatDateTime(payment.updatedAt)} />
          </div>
        )}
      </Section>

      {dispute && (
        <Section title="Dispute">
          <div className="grid gap-3 sm:grid-cols-2">
            <Row label="Dispute ID"       value={dispute.id} mono />
            <Row label="Status"           value={<Badge status={dispute.status} />} />
            <Row label="Reason"           value={dispute.reason} />
            <Row label="Raised by"        value={`${dispute.raisedBy.name ?? 'Unnamed'} · ${formatPhone(dispute.raisedBy.phone)}`} />
            <Row label="Raised by ID"     value={dispute.raisedById} mono />
            <Row label="Resolution"       value={dispute.resolution ? <Badge status={dispute.resolution} /> : '—'} />
            <Row label="Resolved at"      value={dispute.resolvedAt ? formatDateTime(dispute.resolvedAt) : '—'} />
            <Row label="Resolved by"      value={dispute.resolvedById} mono />
            <Row label="Admin alerted"    value={dispute.adminAlertedAt ? formatDateTime(dispute.adminAlertedAt) : '—'} />
            <Row label="Created"          value={formatDateTime(dispute.createdAt)} />
            <Row label="Updated"          value={formatDateTime(dispute.updatedAt)} />
          </div>
          <div className="space-y-2">
            <Row label="Description"      value={<span className="whitespace-pre-wrap">{dispute.description}</span>} />
            <Row label="Seller response"  value={dispute.sellerResponse ? <span className="whitespace-pre-wrap">{dispute.sellerResponse}</span> : '—'} />
            {dispute.evidenceUrls.length > 0 && (
              <Row label="Evidence" value={
                <ul className="space-y-1">
                  {dispute.evidenceUrls.map((u) => (
                    <li key={u}><a href={u} target="_blank" rel="noreferrer" className="underline break-all" style={{ color: 'var(--color-primary)' }}>{u}</a></li>
                  ))}
                </ul>
              } />
            )}
          </div>
        </Section>
      )}

      <OrderActions orderId={order.id} status={order.status} />

      <Section title="Notifications">
        {notifications.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>No notifications.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'var(--color-surface-raised)', fontFamily: 'var(--font-body)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold" style={{ color: 'var(--color-foreground)' }}>{n.title}</span>
                  <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                    <Badge status={n.channel} />
                    <Badge status={n.status} />
                    <span>{formatDateTime(n.createdAt)}</span>
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-mono)' }}>
                  {n.eventType} · user {n.userId ?? '—'} · sent {n.sentAt ? formatDateTime(n.sentAt) : '—'} · read {n.readAt ? formatDateTime(n.readAt) : '—'}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-foreground)' }}>{n.message}</p>
                {n.metadata !== null && n.metadata !== undefined ? <JsonBlock value={n.metadata} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Audit log">
        {auditLog.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>No audit log entries.</p>
        ) : (
          <ul className="space-y-2">
            {auditLog.map((a) => (
              <li key={a.id} className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'var(--color-surface-raised)', fontFamily: 'var(--font-body)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono text-xs" style={{ color: 'var(--color-foreground)' }}>{a.action}</span>
                  <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{formatDateTime(a.createdAt)}</span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-mono)' }}>
                  {a.entityType}/{a.entityId} · actor {a.actorId ?? 'system'}
                </p>
                {a.metadata !== null && a.metadata !== undefined ? <JsonBlock value={a.metadata} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Raw record">
        <details>
          <summary className="cursor-pointer text-xs uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Expand full JSON</summary>
          <JsonBlock value={order} />
        </details>
      </Section>
    </div>
  );
}
