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
  const [selectedPayout, setSelectedPayout] = useState<PendingPayout | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [utrRef, setUtrRef] = useState('');

  const handleAction = () => {
    if (!confirm) return;
    setError('');

    startTransition(async () => {
      try {
        const endpoint =
          confirm.action === 'retry'
            ? `/api/orders/${confirm.payout.id}/retry-payout`
            : `/api/orders/${confirm.payout.id}/complete-payout`;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: confirm.action === 'mark-paid' ? JSON.stringify({ utrRef: utrRef.trim() || undefined }) : undefined,
        });

        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setError(d.error ?? 'Action failed.');
          return;
        }

        setConfirm(null);
        setUtrRef('');
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
      <div className="space-y-3 md:hidden">
        {payouts.map((p) => {
          const isFailed = p.payment.payoutStatus === 'FAILED';
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => { setSelectedPayout(p); }}
              className="grid w-full grid-cols-[1fr_auto] gap-3 rounded-2xl px-4 py-3.5 text-left transition-opacity active:opacity-80"
              style={{
                backgroundColor: 'var(--color-card)',
                border: '1px solid var(--color-surface-high)',
                boxShadow: '0 8px 24px rgba(26,27,33,0.05)',
              }}
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold" style={{ color: 'var(--color-foreground)', fontFamily: 'var(--font-body)' }}>
                    {p.listing.brand.name}
                  </span>
                  <span className="shrink-0 text-[11px]" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-mono)' }}>
                    {formatShortId(p.id)}
                  </span>
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-xs" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                  <span className="truncate">{p.seller.name ?? formatPhone(p.seller.phone)}</span>
                  <span className="shrink-0">·</span>
                  <span className="truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                    {p.seller.payoutAccount?.upiId ?? 'No account'}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(p.sellerPayout)}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    backgroundColor: isFailed ? 'var(--color-destructive-soft)' : 'var(--color-warning-soft)',
                    color: isFailed ? 'var(--color-destructive)' : 'var(--color-warning)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {isFailed ? 'Failed' : 'Pending'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedPayout && (
        <Dialog open onOpenChange={(open) => { if (!open) setSelectedPayout(null); }}>
          <DialogContent className="bottom-0 top-auto max-h-[88vh] translate-y-0 overflow-y-auto rounded-b-none rounded-t-[1.75rem] border-0 p-0 shadow-2xl sm:top-1/2 sm:max-w-md sm:-translate-y-1/2 sm:rounded-[1.75rem]">
            <div className="sticky top-0 z-10 rounded-t-[1.75rem] px-5 pb-4 pt-3" style={{ backgroundColor: 'var(--color-card)', borderBottom: '1px solid var(--color-surface-high)', paddingRight: '3.75rem' }}>
              <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: 'var(--color-surface-highest)' }} />
              <div>
                <DialogTitle className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                  Manual payout
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Payout details and manual settlement actions.
                </DialogDescription>
                <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(selectedPayout.sellerPayout)}
                </p>
              </div>
            </div>

            <div className="space-y-3 px-5 py-5">
              <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                  Send to UPI
                </p>
                <p className="mt-0.5 select-all break-all font-semibold" style={{ color: selectedPayout.seller.payoutAccount?.upiId ? 'var(--color-foreground)' : 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>
                  {selectedPayout.seller.payoutAccount?.upiId ?? 'No account'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm" style={{ fontFamily: 'var(--font-body)' }}>
                <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>
                    Seller
                  </p>
                  <p className="mt-0.5 truncate font-semibold" style={{ color: 'var(--color-foreground)' }}>
                    {selectedPayout.seller.name ?? formatPhone(selectedPayout.seller.phone)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                    {formatPhone(selectedPayout.seller.phone)}
                  </p>
                </div>
                <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>
                    Order
                  </p>
                  <p className="mt-0.5 font-semibold" style={{ color: 'var(--color-foreground)', fontFamily: 'var(--font-mono)' }}>
                    {formatShortId(selectedPayout.id)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                    {formatDate(selectedPayout.createdAt)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-surface-raised)', fontFamily: 'var(--font-body)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>
                  Voucher
                </p>
                <p className="mt-0.5 font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  {selectedPayout.listing.brand.name}
                </p>
              </div>

              {selectedPayout.payment.payoutStatus === 'FAILED' && selectedPayout.payment.payoutFailureReason && (
                <p className="rounded-2xl px-4 py-3 text-xs" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
                  {selectedPayout.payment.payoutFailureReason}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                {selectedPayout.payment.payoutStatus === 'FAILED' && (
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => {
                      setConfirm({ payout: selectedPayout, action: 'retry' });
                      setSelectedPayout(null);
                    }}
                  >
                    Retry
                  </Button>
                )}
                <Button
                  variant="success"
                  className={selectedPayout.payment.payoutStatus === 'FAILED' ? 'h-11' : 'col-span-2 h-11'}
                  onClick={() => {
                    setConfirm({ payout: selectedPayout, action: 'mark-paid' });
                    setSelectedPayout(null);
                  }}
                >
                  Mark Paid
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="hidden overflow-hidden rounded-2xl md:block" style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                {['Order ID', 'Seller', 'UPI / Payout Account', 'Brand', 'Payout', 'Status', 'Confirmed At', ''].map((h) => (
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
                      <div>{p.seller.name ?? formatPhone(p.seller.phone)}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{formatPhone(p.seller.phone)}</div>
                    </td>
                    <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-foreground)' }}>
                      {p.seller.payoutAccount?.upiId ?? (
                        <span style={{ color: 'var(--color-warning)' }}>No account</span>
                      )}
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
        <Dialog open onOpenChange={() => { setConfirm(null); setUtrRef(''); setError(''); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'var(--font-headline)', fontWeight: 800 }}>
                {confirm.action === 'retry' ? 'Retry Razorpay Payout' : 'Mark Payout Complete'}
              </DialogTitle>
              <DialogDescription style={{ fontFamily: 'var(--font-body)' }}>
                {confirm.action === 'retry'
                  ? <>Re-attempt automatic payout for order {formatShortId(confirm.payout.id)} via Razorpay. Seller: {formatPhone(confirm.payout.seller.phone)} — <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', fontWeight: 600 }}>{formatCurrency(confirm.payout.sellerPayout)}</span></>
                  : <>Send <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', fontWeight: 600 }}>{formatCurrency(confirm.payout.sellerPayout)}</span> to the UPI below, then click Mark Paid. The seller will be notified.</>
                }
              </DialogDescription>
            </DialogHeader>
            {confirm.action === 'mark-paid' && (
              <div className="space-y-3">
                <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    Send to UPI
                  </p>
                  <p className="text-base font-semibold select-all" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-foreground)' }}>
                    {confirm.payout.seller.payoutAccount?.upiId ?? '—'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    {confirm.payout.seller.name ?? formatPhone(confirm.payout.seller.phone)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    UTR / Reference (optional)
                  </label>
                  <input
                    type="text"
                    value={utrRef}
                    onChange={(e) => { setUtrRef(e.target.value); }}
                    placeholder="e.g. 401234567890"
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-foreground)', fontFamily: 'var(--font-mono)', border: '1px solid var(--color-surface-high)' }}
                  />
                </div>
              </div>
            )}
            {error && (
              <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setConfirm(null); setUtrRef(''); setError(''); }} disabled={isPending}>
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
