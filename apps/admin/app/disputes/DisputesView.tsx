'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Dispute } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const router = useRouter();
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const resolve = (resolution: 'RELEASE_TO_SELLER' | 'REFUND_BUYER') => {
    if (!selected) return;
    setError('');

    startTransition(async () => {
      try {
        const res = await fetch(`/api/disputes/${selected.id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution }),
        });

        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setError(d.error ?? 'Failed to resolve dispute.');
          return;
        }

        setSelected(null);
        router.refresh();
      } catch {
        setError('Network error. Please try again.');
      }
    });
  };

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
    <>
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
                      <button
                        onClick={() => { setSelected(d); }}
                        className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                        style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <Dialog open onOpenChange={() => { setSelected(null); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'var(--font-headline)', fontWeight: 800 }}>
                Dispute {formatShortId(selected.id)}
              </DialogTitle>
              <DialogDescription style={{ fontFamily: 'var(--font-body)' }}>
                Review the dispute details and resolve.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Buyer</p>
                  <p className="font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{formatPhone(selected.order.buyer.phone)}</p>
                </div>
                <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Seller</p>
                  <p className="font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{formatPhone(selected.order.seller.phone)}</p>
                </div>
              </div>

              <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Brand &amp; Order</p>
                <p className="font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{selected.order.listing.brand.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Order {formatShortId(selected.orderId)}</p>
              </div>

              <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Buyer&apos;s Reason</p>
                <p className="font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{selected.reason}</p>
              </div>

              {selected.sellerResponse && (
                <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Seller&apos;s Response</p>
                  <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>{selected.sellerResponse}</p>
                </div>
              )}

              {selected.resolution && (
                <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-success-soft)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-body)' }}>Resolution</p>
                  <p className="font-semibold" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-success)' }}>
                    {selected.resolution === 'REFUND_BUYER' ? 'Buyer refunded' : 'Released to seller'}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3">
                {(() => { const s = statusStyle(selected.status); return (
                  <span className="status-badge" style={{ backgroundColor: s.bg, color: s.color }}>
                    {selected.status.replace('_', ' ')}
                  </span>
                ); })()}
                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                  Opened {getRelativeTime(selected.createdAt)}
                </span>
              </div>

              {error && (
                <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setSelected(null); }} disabled={isPending}>
                {selected.status === 'RESOLVED' ? 'Close' : 'Cancel'}
              </Button>
              {selected.status !== 'RESOLVED' && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => { resolve('REFUND_BUYER'); }}
                    disabled={isPending}
                  >
                    Refund Buyer
                  </Button>
                  <Button
                    variant="success"
                    onClick={() => { resolve('RELEASE_TO_SELLER'); }}
                    disabled={isPending}
                  >
                    Release to Seller
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
