import { getDisputes } from '@/lib/api';
import DisputesView from './DisputesView';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Disputes | CouponBazaar Admin' };

export default async function DisputesPage() {
  const disputes = await getDisputes();

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Disputes
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {disputes.length} open / under review
        </p>
      </header>

      <DisputesView disputes={disputes} />
    </div>
  );
}
