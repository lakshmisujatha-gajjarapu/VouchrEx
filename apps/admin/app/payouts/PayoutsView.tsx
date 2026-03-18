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
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No pending payouts</p>
        <p className="text-sm mt-1">All seller payouts have been processed.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Order ID', 'Seller', 'Brand', 'Seller Payout', 'Confirmed At', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payouts.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs">{formatShortId(p.id)}</td>
                <td className="px-4 py-3">{formatPhone(p.seller?.phone ?? '')}</td>
                <td className="px-4 py-3 font-medium">{p.listing?.brand?.name ?? '—'}</td>
                <td className="px-4 py-3 tabular-nums font-semibold">
                  {formatCurrency(p.sellerPayout)}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatDate(p.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="success" onClick={() => setConfirm(p)}>
                    Mark Paid
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <Dialog open onOpenChange={() => setConfirm(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Payout</DialogTitle>
              <DialogDescription>
                Mark payout for order {formatShortId(confirm.id)} as complete?
                Seller: {formatPhone(confirm.seller?.phone ?? '')} —{' '}
                {formatCurrency(confirm.sellerPayout)}
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
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
