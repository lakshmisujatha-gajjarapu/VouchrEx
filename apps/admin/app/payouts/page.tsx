import { getPendingPayouts } from '@/lib/api';
import PayoutsView from './PayoutsView';
import { formatCurrency } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Payouts | CouponBazaar Admin' };

export default async function PayoutsPage() {
  const payouts = await getPendingPayouts();

  const totalPending = payouts.reduce((sum, p) => sum + p.sellerPayout, 0);

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Pending Payouts
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {payouts.length} pending — {formatCurrency(totalPending)} total
        </p>
      </header>

      <PayoutsView payouts={payouts} />
    </div>
  );
}
