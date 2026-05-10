import { getPendingRefunds } from '@/lib/api';
import RefundsView from './refunds-view';
import { formatCurrency } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Refunds | VouchrEx Admin' };

export default async function RefundsPage() {
  const refunds = await getPendingRefunds();

  const totalPending = refunds.reduce((sum, r) => sum + r.payment.amount, 0);
  const failedCount = refunds.filter((r) => r.payment.refundStatus === 'FAILED').length;

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Pending Refunds
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {refunds.length} pending — {formatCurrency(totalPending)} total
          {failedCount > 0 && (
            <>
              {' · '}
              <span style={{ color: 'var(--color-destructive)', fontWeight: 600 }}>
                {failedCount} failed
              </span>
            </>
          )}
        </p>
      </header>

      <RefundsView refunds={refunds} />
    </div>
  );
}
