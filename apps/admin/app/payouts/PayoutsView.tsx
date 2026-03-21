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

export default function PayoutsView({ payouts }: PayoutsViewProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<PendingPayout | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const markPaid = () => {
    if (!confirm) return;
    setError('');

    startTransition(async () => {
      try {
        const res = await fetch(`/api/orders/${confirm.id}/complete-payout`, {
          method: 'POST',
        });

        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setError(d.error ?? 'Failed to mark payout complete.');
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
                {['Order ID', 'Seller', 'Brand', 'Seller Payout', 'Confirmed At', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="transition-opacity hover:opacity-90"
                  style={{ borderTop: '1px solid var(--color-surface-high)' }}>
                  <td className="px-5 py-3.5 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
                    {formatShortId(p.id)}
                  </td>
                  <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                    {formatPhone(p.seller?.phone ?? '')}
                  </td>
                  <td className="px-5 py-3.5 font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                    {p.listing?.brand?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 tabular-nums font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                    {formatCurrency(p.sellerPayout)}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    {formatDate(p.createdAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => setConfirm(p)}
                      className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', fontFamily: 'var(--font-body)' }}
                    >
                      Mark Paid
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && (
        <Dialog open onOpenChange={() => setConfirm(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'var(--font-headline)', fontWeight: 800 }}>
                Confirm Payout
              </DialogTitle>
              <DialogDescription style={{ fontFamily: 'var(--font-body)' }}>
                Mark payout for order {formatShortId(confirm.id)} as complete?{' '}
                Seller: {formatPhone(confirm.seller?.phone ?? '')} —{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', fontWeight: 600 }}>
                  {formatCurrency(confirm.sellerPayout)}
                </span>
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirm(null)} disabled={isPending}>
                Cancel
              </Button>
              <Button variant="success" onClick={markPaid} disabled={isPending}>
                {isPending ? 'Processing…' : 'Mark Paid'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
