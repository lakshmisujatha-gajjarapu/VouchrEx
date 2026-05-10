'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PendingPayout } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatShortId, formatCurrency, formatDate, formatPhone } from '@/lib/utils';

interface PayoutsViewProps {
  payouts: PendingPayout[];
}

type ActionType = 'mark-paid' | 'retry';

export default function PayoutsView({ payouts }: PayoutsViewProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<{ payout: PendingPayout; action: ActionType } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleAction = () => {
    if (!confirm) return;
    setError('');

    startTransition(async () => {
      try {
        const endpoint =
          confirm.action === 'retry'
            ? `/api/orders/${confirm.payout.id}/retry-payout`
            : `/api/orders/${confirm.payout.id}/complete-payout`;

        const res = await fetch(endpoint, { method: 'POST' });

        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setError(d.error ?? 'Action failed.');
          return;
        }

        setConfirm(null);
        router.refresh();
      } catch {
        setError('Network error.');
      }
    });
  };

  if (payouts.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-semibold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-foreground)' }}>
          No pending payouts
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
          All seller payouts have been processed.
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
                {['Order ID', 'Seller', 'Brand', 'Payout', 'Status', 'Confirmed At', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => {
                const isFailed = p.payment.payoutStatus === 'FAILED';
                return (
                  <tr key={p.id} className="transition-opacity hover:opacity-90"
                    style={{ borderTop: '1px solid var(--color-surface-high)' }}>
                    <td className="px-5 py-3.5 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
                      {formatShortId(p.id)}
                    </td>
                    <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {formatPhone(p.seller.phone)}
                    </td>
                    <td className="px-5 py-3.5 font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {p.listing.brand.name}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                      {formatCurrency(p.sellerPayout)}
                    </td>
                    <td className="px-5 py-3.5">
                      {isFailed ? (
                        <div>
                          <span className="status-badge" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' }}>
                            FAILED
                          </span>
                          {p.payment.payoutFailureReason && (
                            <p className="text-xs mt-1 max-w-[160px] truncate" title={p.payment.payoutFailureReason}
                              style={{ color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
                              {p.payment.payoutFailureReason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="status-badge" style={{ backgroundColor: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5">
                        {isFailed && (
                          <button
                            onClick={() => { setConfirm({ payout: p, action: 'retry' }); }}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                            style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)' }}
                          >
                            Retry
                          </button>
                        )}
                        <button
                          onClick={() => { setConfirm({ payout: p, action: 'mark-paid' }); }}
                          className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                          style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', fontFamily: 'var(--font-body)' }}
                        >
                          Mark Paid
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && (
        <Dialog open onOpenChange={() => { setConfirm(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'var(--font-headline)', fontWeight: 800 }}>
                {confirm.action === 'retry' ? 'Retry Razorpay Payout' : 'Mark Payout Complete'}
              </DialogTitle>
              <DialogDescription style={{ fontFamily: 'var(--font-body)' }}>
                {confirm.action === 'retry'
                  ? <>Re-attempt automatic payout for order {formatShortId(confirm.payout.id)} via Razorpay. Seller: {formatPhone(confirm.payout.seller.phone)} — <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', fontWeight: 600 }}>{formatCurrency(confirm.payout.sellerPayout)}</span></>
                  : <>Mark payout for order {formatShortId(confirm.payout.id)} as manually completed. Seller: {formatPhone(confirm.payout.seller.phone)} — <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', fontWeight: 600 }}>{formatCurrency(confirm.payout.sellerPayout)}</span></>
                }
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setConfirm(null); }} disabled={isPending}>
                Cancel
              </Button>
              <Button variant="success" onClick={handleAction} disabled={isPending}>
                {isPending ? 'Processing…' : confirm.action === 'retry' ? 'Retry Payout' : 'Mark Paid'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
