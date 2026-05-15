'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PendingRefund } from '@/lib/types';
import { clientFetch } from '@/lib/client-fetch';
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

interface RefundsViewProps {
  refunds: PendingRefund[];
}

type ActionType = 'mark-paid' | 'retry';

export default function RefundsView({ refunds }: RefundsViewProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<{ refund: PendingRefund; action: ActionType } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleAction = () => {
    if (!confirm) return;
    setError('');

    startTransition(async () => {
      try {
        const endpoint =
          confirm.action === 'retry'
            ? `/api/orders/${confirm.refund.id}/retry-refund`
            : `/api/orders/${confirm.refund.id}/complete-refund`;

        const res = await clientFetch(endpoint, { method: 'POST' });

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

  if (refunds.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-semibold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-foreground)' }}>
          No pending refunds
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
          All buyer refunds have settled.
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
                {['Order ID', 'Buyer', 'Brand', 'Amount', 'Status', 'Razorpay Refund', 'Attempts', 'Initiated', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => {
                const isFailed = r.payment.refundStatus === 'FAILED';
                const initiatedAt = r.payment.refundInitiatedAt ?? r.createdAt;
                return (
                  <tr key={r.id} className="transition-opacity hover:opacity-90"
                    style={{ borderTop: '1px solid var(--color-surface-high)' }}>
                    <td className="px-5 py-3.5 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
                      {formatShortId(r.id)}
                    </td>
                    <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {formatPhone(r.buyer.phone)}
                    </td>
                    <td className="px-5 py-3.5 font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {r.listing.brand.name}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                      {formatCurrency(r.payment.amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      {isFailed ? (
                        <div>
                          <span className="status-badge" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' }}>
                            FAILED
                          </span>
                          {r.payment.refundFailureReason && (
                            <p className="text-xs mt-1 max-w-[200px] truncate" title={r.payment.refundFailureReason}
                              style={{ color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
                              {r.payment.refundFailureReason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="status-badge" style={{ backgroundColor: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                          PROCESSING
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
                      {r.payment.razorpayRefundId ? (
                        <a
                          href={`https://dashboard.razorpay.com/app/refunds/${r.payment.razorpayRefundId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:opacity-80"
                          style={{ color: 'var(--color-primary)' }}
                          title={r.payment.razorpayRefundId}
                        >
                          {r.payment.razorpayRefundId.slice(0, 12)}…
                        </a>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-center" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
                      {r.payment.refundAttempts}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                      {formatDate(initiatedAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5">
                        {isFailed && r.payment.razorpayPaymentId !== null && (
                          <button
                            onClick={() => { setConfirm({ refund: r, action: 'retry' }); }}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                            style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)' }}
                          >
                            Retry
                          </button>
                        )}
                        <button
                          onClick={() => { setConfirm({ refund: r, action: 'mark-paid' }); }}
                          className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                          style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', fontFamily: 'var(--font-body)' }}
                        >
                          Mark Refunded
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
                {confirm.action === 'retry' ? 'Retry Razorpay Refund' : 'Mark Refund Complete'}
              </DialogTitle>
              <DialogDescription style={{ fontFamily: 'var(--font-body)' }}>
                {confirm.action === 'retry'
                  ? <>Re-attempt automatic refund for order {formatShortId(confirm.refund.id)} via Razorpay. Buyer: {formatPhone(confirm.refund.buyer.phone)} — <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', fontWeight: 600 }}>{formatCurrency(confirm.refund.payment.amount)}</span></>
                  : <>Mark refund for order {formatShortId(confirm.refund.id)} as manually completed. Use this only if you&apos;ve already settled the funds out-of-band (e.g. via Razorpay dashboard or bank transfer). Buyer: {formatPhone(confirm.refund.buyer.phone)} — <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', fontWeight: 600 }}>{formatCurrency(confirm.refund.payment.amount)}</span></>
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
                {isPending ? 'Processing…' : confirm.action === 'retry' ? 'Retry Refund' : 'Mark Refunded'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
