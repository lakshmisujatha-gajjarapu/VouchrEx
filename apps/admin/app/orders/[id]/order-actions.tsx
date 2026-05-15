'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clientFetch } from '@/lib/client-fetch';
import { Button } from '@/components/ui/button';

interface OrderActionsProps {
  readonly orderId: string;
  readonly status: string;
}

export function OrderActions({ orderId, status }: OrderActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  if (status !== 'PAYMENT_PENDING') return null;

  const forceCancel = () => {
    setError('');
    startTransition(async () => {
      try {
        const res = await clientFetch(`/api/orders/${orderId}/force-cancel`, { method: 'POST' });
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setError(d.error ?? 'Failed to cancel order.');
          return;
        }
        router.refresh();
      } catch {
        setError('Network error. Please try again.');
      }
    });
  };

  return (
    <section className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
      <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>Support actions</h2>
      <div className="rounded-xl px-4 py-3 text-xs" style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
        <strong style={{ color: 'var(--color-destructive)' }}>Force Cancel</strong> — releases the listing back to ACTIVE and marks the payment as FAILED. The buyer is notified. Use when a payment dropped mid-flow and the cron timeout hasn't triggered yet.
      </div>
      {error && (
        <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-destructive-soft)', color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
          {error}
        </p>
      )}
      <Button variant="destructive" onClick={forceCancel} disabled={isPending}>
        {isPending ? 'Cancelling…' : 'Force Cancel Order'}
      </Button>
    </section>
  );
}
