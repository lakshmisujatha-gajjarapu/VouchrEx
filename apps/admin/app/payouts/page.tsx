import { Wallet } from 'lucide-react';
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
      <header className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Pending Payouts</h1>
          <p className="text-muted-foreground text-sm">
            {payouts.length} pending — {formatCurrency(totalPending)} total
          </p>
        </div>
      </header>

      <PayoutsView payouts={payouts} />
    </div>
  );
}
