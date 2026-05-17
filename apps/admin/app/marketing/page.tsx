import type { Metadata } from 'next';
import MarketingView from './marketing-view';
import { getDealAvailability, getPromotions } from '@/lib/api';

export const metadata: Metadata = { title: 'Marketing | VouchrEx Admin' };

export default async function MarketingPage() {
  const [availability, promotions] = await Promise.all([
    getDealAvailability(),
    getPromotions()
  ]);

  return (
    <div className="animate-slide-up px-4 py-5 sm:px-6 md:p-8">
      <header className="mb-5 md:mb-8">
        <h1 className="text-[1.75rem] md:text-[2rem]" style={{ fontFamily: 'var(--font-headline)', fontWeight: 800, color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Marketing & Promotions
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          Manage promotion windows and track deal availability.
        </p>
      </header>

      <MarketingView initialAvailability={availability} initialPromotions={promotions} />
    </div>
  );
}
