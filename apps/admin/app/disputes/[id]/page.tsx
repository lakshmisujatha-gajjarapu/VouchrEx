import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDispute } from '@/lib/api';
import { formatShortId, formatCurrency, formatDateTime, formatPhone, getRelativeTime } from '@/lib/utils';
import type { Dispute, DisputePartyUser } from '@/lib/types';
import { DisputeTimeline } from '@/components/dispute-timeline';
import { BuyerHistoryPanel } from '@/components/buyer-history-panel';
import { DisputeActions } from './dispute-actions';

export const metadata: Metadata = { title: 'Dispute Detail | VouchrEx Admin' };

interface PageProps {
  params: Promise<{ id: string }>;
}

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
      <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, mono = false }: { readonly label: string; readonly value: React.ReactNode; readonly mono?: boolean }) {
  const displayed: React.ReactNode = value === null || value === undefined || value === '' ? '—' : value;
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-4 text-sm">
      <div className="text-xs uppercase tracking-widest pt-0.5" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>{label}</div>
      <div className="break-all" style={{ color: 'var(--color-foreground)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)' }}>{displayed}</div>
    </div>
  );
}

function statusStyle(status: string): { bg: string; color: string } {
  if (status === 'OPEN')         return { bg: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' };
  if (status === 'UNDER_REVIEW') return { bg: 'var(--color-warning-soft)',     color: 'var(--color-warning)' };
  if (status === 'RESOLVED')     return { bg: 'var(--color-success-soft)',     color: 'var(--color-success)' };
  return                                { bg: 'var(--color-surface-high)',      color: 'var(--color-muted-foreground)' };
}

function PartyCard({ role, user }: { readonly role: 'Buyer' | 'Seller'; readonly user: DisputePartyUser }) {
  const strikes = (role === 'Seller' ? user.sellerStrikes : user.buyerStrikes) ?? 0;
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>{role}</p>
        <span className="status-badge" style={{ backgroundColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)' }}>{user.tier}</span>
      </div>
      <div>
        <p className="font-semibold" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{user.name ?? 'Unnamed'}</p>
        <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>{formatShortId(user.id)}</p>
      </div>
      <div className="text-xs space-y-0.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
        <p>{formatPhone(user.phone)}</p>
        {user.email && <p style={{ color: 'var(--color-muted-foreground)' }}>{user.email}</p>}
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
        <div><p style={{ color: 'var(--color-muted-foreground)' }}>Trust</p><p>{user.trustScore}</p></div>
        <div><p style={{ color: 'var(--color-muted-foreground)' }}>Disputes</p><p>{user.disputeCount}</p></div>
        <div><p style={{ color: 'var(--color-muted-foreground)' }}>Sales</p><p>{user.totalSales}</p></div>
        <div>
          <p style={{ color: 'var(--color-muted-foreground)' }}>Strikes</p>
          <p style={{ color: strikes >= 1 ? 'var(--color-destructive)' : 'var(--color-foreground)' }}>{strikes}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-muted-foreground)' }}>
        <span>Status: <span style={{ color: 'var(--color-foreground)' }}>{user.status}</span></span>
        <span>Joined {getRelativeTime(user.createdAt)}</span>
      </div>
      {user.payoutAccount && (
        <div className="text-xs pt-1 border-t" style={{ borderColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
          KYC: <span style={{ color: 'var(--color-foreground)' }}>{user.payoutAccount.kycStatus}</span>
          {user.payoutAccount.upiId && <span> · UPI: {user.payoutAccount.upiId}</span>}
        </div>
      )}
    </div>
  );
}

export default async function DisputeDetailPage({ params }: PageProps) {
  const { id } = await params;

  let dispute: Dispute;
  try {
    dispute = await getDispute(id);
  } catch {
    notFound();
  }

  const s = statusStyle(dispute.status);
  const listing = dispute.order.listing;

  const redemptionLabel = listing.redemptionMode === 'ONLINE' ? 'Online'
    : listing.redemptionMode === 'IN_STORE' ? 'In-store'
    : listing.redemptionMode === 'BOTH' ? 'Both'
    : null;

  return (
    <div className="p-8 animate-slide-up max-w-5xl">
      <div className="mb-6">
        <Link href="/disputes" className="text-sm hover:underline" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
          ← Disputes
        </Link>
      </div>

      <header className="mb-8">
        <div className="flex items-center gap-3 flex-wrap mb-1">
          <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)' }}>
            Dispute {formatShortId(dispute.id)}
          </h1>
          <span className="status-badge" style={{ backgroundColor: s.bg, color: s.color }}>
            {dispute.status.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
          Opened {getRelativeTime(dispute.createdAt)}
          {dispute.resolvedAt && ` · Resolved ${getRelativeTime(dispute.resolvedAt)}`}
        </p>
      </header>

      <div className="space-y-5">
        {/* Parties */}
        <Section title="Parties">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PartyCard role="Buyer" user={dispute.order.buyer} />
            <PartyCard role="Seller" user={dispute.order.seller} />
          </div>
        </Section>

        {/* Buyer history */}
        <Section title="Buyer history">
          <BuyerHistoryPanel
            purchases={dispute.order.buyer._count?.purchases ?? 0}
            disputesRaised={dispute.order.buyer._count?.disputes ?? 0}
            buyerStrikes={dispute.order.buyer.buyerStrikes ?? 0}
          />
        </Section>

        {/* Timeline */}
        <Section title="Timeline">
          <DisputeTimeline
            orderCreatedAt={dispute.order.createdAt}
            codeRevealedAt={dispute.order.codeRevealedAt}
            disputeRaisedAt={dispute.createdAt}
            verificationDeadline={dispute.order.verificationDeadline}
          />
        </Section>

        {/* Listing */}
        <Section title="Listing">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="font-semibold" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                {listing.brand.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                {listing.voucherType === 'gift-card' ? 'Gift card' : 'Promo code'}
                {' · Order '}{formatShortId(dispute.orderId)}
              </p>
            </div>
            <Link
              href={`/listings/${listing.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold whitespace-nowrap hover:underline"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-body)' }}
            >
              View listing →
            </Link>
          </div>
          <Row label="Selling price" value={formatCurrency(listing.sellingPrice)} mono />
          <Row label="Discount"      value={`${String(Math.round(listing.discountPercent))}% off ${formatCurrency(listing.faceValue)}`} mono />
          {redemptionLabel && <Row label="Redeem via" value={redemptionLabel} />}
          {listing.minimumOrderValue && <Row label="Min. spend" value={formatCurrency(listing.minimumOrderValue)} mono />}
          {listing.sellerNotes && <Row label="Seller notes" value={listing.sellerNotes} />}
          <Row label="Expiry" value={formatDateTime(dispute.order.verificationDeadline ?? dispute.order.createdAt)} />
        </Section>

        {/* Buyer's reason */}
        <Section title="Buyer's reason">
          <p className="font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{dispute.reason}</p>
          {dispute.description && (
            <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>{dispute.description}</p>
          )}
        </Section>

        {/* Seller's response */}
        {dispute.sellerResponse && (
          <Section title="Seller's response">
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{dispute.sellerResponse}</p>
          </Section>
        )}

        {/* Resolution */}
        {dispute.resolution && (
          <section className="rounded-2xl p-6" style={{ backgroundColor: 'var(--color-success-soft)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-body)' }}>Resolution</p>
            <p className="font-semibold" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-success)' }}>
              {dispute.resolution === 'REFUND_BUYER' ? 'Buyer refunded' : 'Released to seller'}
            </p>
            {dispute.resolvedAt && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-body)' }}>
                {formatDateTime(dispute.resolvedAt)}
              </p>
            )}
          </section>
        )}

        {/* Client island: evidence + resolve actions */}
        <DisputeActions dispute={dispute} />
      </div>
    </div>
  );
}
