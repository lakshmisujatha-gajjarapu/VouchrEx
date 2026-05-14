'use client';

import type { Dispute } from '@/lib/types';
import { formatShortId, getRelativeTime, formatPhone } from '@/lib/utils';

interface DisputesViewProps {
  disputes: Dispute[];
}

function statusStyle(status: string): { bg: string; color: string } {
  if (status === 'OPEN')         return { bg: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' };
  if (status === 'UNDER_REVIEW') return { bg: 'var(--color-warning-soft)',     color: 'var(--color-warning)' };
  if (status === 'RESOLVED')     return { bg: 'var(--color-success-soft)',     color: 'var(--color-success)' };
  return                                { bg: 'var(--color-surface-high)',      color: 'var(--color-muted-foreground)' };
}

export default function DisputesView({ disputes }: DisputesViewProps) {
  if (disputes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-semibold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-foreground)' }}>
          No disputes found
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
          All disputes have been resolved.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-surface-raised)' }}>
              {['ID', 'Brand', 'Buyer', 'Seller', 'Reason', 'Seller Resp.', 'Age', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
                  style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {disputes.map((d) => {
              const s = statusStyle(d.status);
              return (
                <tr key={d.id} className="transition-colors hover:opacity-90"
                  style={{ borderTop: '1px solid var(--color-surface-high)' }}>
                  <td className="px-5 py-3.5 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
                    {formatShortId(d.id)}
                  </td>
                  <td className="px-5 py-3.5 font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                    {d.order.listing.brand.name}
                  </td>
                  <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                    {formatPhone(d.order.buyer.phone)}
                  </td>
                  <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                    {formatPhone(d.order.seller.phone)}
                  </td>
                  <td className="px-5 py-3.5 max-w-[180px] truncate" title={d.reason}
                    style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                    {d.reason}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {d.sellerResponse ? (
                      <span className="font-bold" style={{ color: 'var(--color-success)' }}>✓</span>
                    ) : (
                      <span style={{ color: 'var(--color-muted-foreground)' }}>✗</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    {getRelativeTime(d.createdAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="status-badge" style={{ backgroundColor: s.bg, color: s.color }}>
                      {d.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <a
                      href={`/disputes/${d.id}`}
                      className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)' }}
                    >
                      View
                    </a>
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
