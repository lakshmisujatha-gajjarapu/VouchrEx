'use client';

import type { AdminListing } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface ListingsViewProps {
  listings: AdminListing[];
}

function verificationStyle(v: string): { bg: string; color: string } {
  if (v === 'APPROVED')      return { bg: 'var(--color-success-soft)',     color: 'var(--color-success)' };
  if (v === 'REJECTED')      return { bg: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' };
  if (v === 'MANUAL_REVIEW') return { bg: 'var(--color-warning-soft, #fef3c7)', color: 'var(--color-warning, #b45309)' };
  return { bg: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)' };
}

function listingStatusStyle(s: string): { bg: string; color: string } {
  if (s === 'ACTIVE')    return { bg: 'var(--color-success-soft)',              color: 'var(--color-success)' };
  if (s === 'SOLD')      return { bg: 'var(--color-primary-soft)',              color: 'var(--color-primary)' };
  if (s === 'RESERVED')  return { bg: 'var(--color-warning-soft, #fef3c7)',     color: 'var(--color-warning, #b45309)' };
  return { bg: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)' };
}

function redemptionLabel(mode: string | null): string {
  if (mode === 'ONLINE')   return 'Online';
  if (mode === 'IN_STORE') return 'In-store';
  if (mode === 'BOTH')     return 'Both';
  return '—';
}

export default function ListingsView({ listings }: ListingsViewProps) {
  if (listings.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-semibold"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-foreground)' }}>
          No listings found
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-surface-raised)' }}>
              {['Brand', 'Type', 'Face Val.', 'Price', 'Disc.', 'Redeem', 'Seller', 'Status', 'Verification', 'Listed'].map((h) => (
                <th key={h}
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
                  style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => {
              const vs = verificationStyle(l.verificationStatus);
              const ls = listingStatusStyle(l.status);
              return (
                <tr
                  key={l.id}
                  className="transition-opacity hover:opacity-80 cursor-pointer"
                  style={{ borderTop: '1px solid var(--color-surface-high)' }}
                  onClick={() => { window.location.href = `/listings/${l.id}`; }}
                >
                  <td className="px-5 py-3.5 font-medium whitespace-nowrap"
                    style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                    {l.brand.name}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-semibold uppercase tracking-wide"
                      style={{ fontFamily: 'var(--font-body)', color: 'var(--color-muted-foreground)' }}>
                      {l.voucherType === 'gift-card' ? 'Gift card' : 'Promo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-foreground)' }}>
                    ₹{l.faceValue.toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-3.5 tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-foreground)' }}>
                    ₹{l.sellingPrice.toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-3.5 tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
                    {Math.round(l.discountPercent)}%
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap"
                    style={{ fontFamily: 'var(--font-body)', color: 'var(--color-muted-foreground)', fontSize: '0.8rem' }}>
                    {redemptionLabel(l.redemptionMode)}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap"
                    style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                    <div>{l.seller.name ?? '—'}</div>
                    <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{l.seller.phone}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="status-badge" style={{ backgroundColor: ls.bg, color: ls.color }}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="status-badge" style={{ backgroundColor: vs.bg, color: vs.color }}>
                      {l.verificationStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap"
                    style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    {formatDate(l.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
