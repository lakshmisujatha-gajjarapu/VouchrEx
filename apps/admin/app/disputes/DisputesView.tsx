'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Dispute } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
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

function statusVariant(status: string): 'warning' | 'default' | 'secondary' {
  if (status === 'OPEN') return 'warning';
  if (status === 'UNDER_REVIEW') return 'default';
  return 'secondary';
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
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No disputes found</p>
        <p className="text-sm mt-1">All disputes have been resolved.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['ID', 'Brand', 'Buyer', 'Seller', 'Reason', 'Seller Resp.', 'Age', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {disputes.map((d) => (
              <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs">{formatShortId(d.id)}</td>
                <td className="px-4 py-3 font-medium">{d.order?.listing?.brand?.name ?? '—'}</td>
                <td className="px-4 py-3">{formatPhone(d.order?.buyer?.phone ?? '')}</td>
                <td className="px-4 py-3">{formatPhone(d.order?.seller?.phone ?? '')}</td>
                <td className="px-4 py-3 max-w-[180px] truncate" title={d.reason}>
                  {d.reason}
                </td>
                <td className="px-4 py-3 text-center">
                  {d.sellerResponse ? (
                    <span className="text-green-600 font-bold">✓</span>
                  ) : (
                    <span className="text-muted-foreground">✗</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {getRelativeTime(d.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="outline" onClick={() => setSelected(d)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Dispute {formatShortId(selected.id)}</DialogTitle>
              <DialogDescription>
                Review the dispute details and resolve.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Buyer</p>
                  <p className="font-medium">{formatPhone(selected.order?.buyer?.phone ?? '')}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Seller</p>
                  <p className="font-medium">{formatPhone(selected.order?.seller?.phone ?? '')}</p>
                </div>
              </div>

              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Brand & Order</p>
                <p className="font-medium">{selected.order?.listing?.brand?.name}</p>
                <p className="text-xs text-muted-foreground">Order {formatShortId(selected.orderId)}</p>
              </div>

              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Buyer&apos;s Reason</p>
                <p>{selected.reason}</p>
              </div>

              {selected.sellerResponse && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Seller&apos;s Response</p>
                  <p>{selected.sellerResponse}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  Opened {getRelativeTime(selected.createdAt)}
                </span>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => resolve('REFUND_BUYER')}
                disabled={isPending}
              >
                Refund Buyer
              </Button>
              <Button
                variant="success"
                onClick={() => resolve('RELEASE_TO_SELLER')}
                disabled={isPending}
              >
                Release to Seller
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
