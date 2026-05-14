import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getListing } from '@/lib/api';
import { formatCurrency, formatDateTime, formatPhone, formatShortId, getRelativeTime } from '@/lib/utils';
import type { AdminListingDetail, OrderDetailAuditLog } from '@/lib/types';

export const metadata: Metadata = { title: 'Listing Detail | VouchrEx Admin' };

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

function Row({ label, value, mono = false, accent }: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly mono?: boolean;
  readonly accent?: 'success' | 'warning' | 'destructive';
}) {
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

function Badge({ label, style }: { readonly label: string; readonly style?: React.CSSProperties }) {
  return (
    <span className="status-badge" style={style}>{label.replace(/_/g, ' ')}</span>
  );
}

function verificationStyle(v: string): React.CSSProperties {
  if (v === 'APPROVED')      return { backgroundColor: 'var(--color-success-soft)',              color: 'var(--color-success)' };
  if (v === 'REJECTED')      return { backgroundColor: 'var(--color-destructive-soft)',           color: 'var(--color-destructive)' };
  if (v === 'MANUAL_REVIEW') return { backgroundColor: 'var(--color-warning-soft, #fef3c7)',      color: 'var(--color-warning, #b45309)' };
  return { backgroundColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)' };
}

function listingStatusStyle(s: string): React.CSSProperties {
  if (s === 'ACTIVE')    return { backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' };
  if (s === 'SOLD')      return { backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' };
  if (s === 'RESERVED')  return { backgroundColor: 'var(--color-warning-soft, #fef3c7)', color: 'var(--color-warning, #b45309)' };
  return { backgroundColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)' };
}

function SellerCard({ seller }: { readonly seller: AdminListingDetail['seller'] }) {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Seller</p>
        <span className="status-badge" style={{ backgroundColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)' }}>{seller.tier}</span>
      </div>
      <div>
        <p className="font-semibold" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{seller.name ?? 'Unnamed'}</p>
        <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>{seller.id}</p>
      </div>
      <div className="text-xs space-y-0.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
        <p>{formatPhone(seller.phone)}</p>
        {seller.email && <p style={{ color: 'var(--color-muted-foreground)' }}>{seller.email}</p>}
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
        <div><p style={{ color: 'var(--color-muted-foreground)' }}>Trust</p><p>{seller.trustScore}</p></div>
        <div><p style={{ color: 'var(--color-muted-foreground)' }}>Disputes</p><p>{seller.disputeCount}</p></div>
        <div><p style={{ color: 'var(--color-muted-foreground)' }}>Sales</p><p>{seller.totalSales}</p></div>
        <div>
          <p style={{ color: 'var(--color-muted-foreground)' }}>Strikes</p>
          <p style={{ color: seller.sellerStrikes >= 1 ? 'var(--color-destructive)' : 'var(--color-foreground)' }}>{seller.sellerStrikes}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-muted-foreground)' }}>
        <span>Status: <span style={{ color: 'var(--color-foreground)' }}>{seller.status}</span></span>
        <span>Joined {getRelativeTime(seller.createdAt)}</span>
      </div>
      {seller.payoutAccount && (
        <div className="text-xs pt-1 border-t" style={{ borderColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
          KYC: <span style={{ color: 'var(--color-foreground)' }}>{seller.payoutAccount.kycStatus}</span>
          {seller.payoutAccount.upiId && <span> · {seller.payoutAccount.upiId}</span>}
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry }: { readonly entry: OrderDetailAuditLog }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 text-xs py-2" style={{ borderTop: '1px solid var(--color-surface-high)', fontFamily: 'var(--font-body)' }}>
      <div style={{ color: 'var(--color-muted-foreground)' }}>{formatDateTime(entry.createdAt)}</div>
      <div>
        <span className="font-mono text-xs" style={{ color: 'var(--color-foreground)' }}>{entry.action}</span>
        {entry.actorId && <span style={{ color: 'var(--color-muted-foreground)' }}> · {entry.actorId}</span>}
      </div>
    </div>
  );
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;

  let listing: AdminListingDetail;
  try {
    listing = await getListing(id);
  } catch {
    notFound();
  }

  const redemptionLabel = listing.redemptionMode === 'ONLINE' ? 'Online'
    : listing.redemptionMode === 'IN_STORE' ? 'In-store'
    : listing.redemptionMode === 'BOTH' ? 'Both'
    : null;

  return (
    <div className="p-8 animate-slide-up max-w-5xl">
      {/* Back + header */}
      <div className="mb-6">
        <Link href="/listings" className="text-sm hover:underline" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
          ← Listings
        </Link>
      </div>

      <header className="mb-8 flex items-start gap-4 flex-wrap">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)' }}>
              {listing.brand.name}
            </h1>
            <Badge label={listing.status} style={listingStatusStyle(listing.status)} />
            <Badge label={listing.verificationStatus} style={verificationStyle(listing.verificationStatus)} />
          </div>
          <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
            {formatShortId(listing.id)} · listed {getRelativeTime(listing.createdAt)}
          </p>
        </div>
      </header>

      <div className="space-y-5">
        {/* Listing details */}
        <Section title="Listing">
          <Row label="Brand"        value={`${listing.brand.name} (${listing.brand.category})`} />
          <Row label="Type"         value={listing.voucherType === 'gift-card' ? 'Gift card' : 'Promo code'} />
          <Row label="Face value"   value={formatCurrency(listing.faceValue)} mono />
          <Row label="Selling price" value={formatCurrency(listing.sellingPrice)} mono accent="success" />
          <Row label="Discount"     value={`${String(Math.round(listing.discountPercent))}%`} mono />
          <Row label="Expiry"       value={formatDateTime(listing.expiryDate)} />
          <Row label="Redeem via"   value={redemptionLabel} />
          <Row label="Min. spend"   value={listing.minimumOrderValue ? formatCurrency(listing.minimumOrderValue) : null} mono />
          <Row label="Seller notes" value={listing.sellerNotes} />
          <Row label="Proof URL"    value={listing.proofUrl ? (
            <a href={listing.proofUrl} target="_blank" rel="noopener noreferrer"
              className="underline underline-offset-2"
              style={{ color: 'var(--color-primary)' }}>
              View proof
            </a>
          ) : null} />
        </Section>

        {/* Seller */}
        <Section title="Seller">
          <SellerCard seller={listing.seller} />
        </Section>

        {/* Code vault */}
        <Section title="Code vault">
          {listing.codeVault ? (
            <>
              <Row label="Vault ID"      value={listing.codeVault.id} mono />
              <Row label="Code hash"     value={listing.codeVault.codeHash} mono />
              <Row label="PIN stored"    value={listing.codeVault.encryptedPin ? 'Yes' : 'No'} />
              <Row label="View count"    value={String(listing.codeVault.viewCount)} mono />
              <Row label="First viewed"  value={listing.codeVault.firstViewedAt ? formatDateTime(listing.codeVault.firstViewedAt) : null} />
              <Row label="Last viewed"   value={listing.codeVault.lastViewedAt ? formatDateTime(listing.codeVault.lastViewedAt) : null} />
              <Row label="Vault created" value={formatDateTime(listing.codeVault.createdAt)} />
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>No vault attached.</p>
          )}
        </Section>

        {/* Linked order */}
        {listing.order && (
          <Section title="Order">
            <Row label="Order ID" value={
              <Link href={`/orders/${listing.order.id}`} className="underline underline-offset-2"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                {formatShortId(listing.order.id)}
              </Link>
            } />
            <Row label="Status"  value={listing.order.status} />
            <Row label="Buyer"   value={`${listing.order.buyer.name ?? '—'} · ${formatPhone(listing.order.buyer.phone)}`} />
            <Row label="Ordered" value={formatDateTime(listing.order.createdAt)} />
          </Section>
        )}

        {/* Audit log */}
        {listing.auditLog.length > 0 && (
          <Section title="Audit log">
            <div>
              {listing.auditLog.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
