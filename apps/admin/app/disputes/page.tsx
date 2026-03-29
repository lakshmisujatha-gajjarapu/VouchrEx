import { getDisputes } from '@/lib/api';
import DisputesView from './DisputesView';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Disputes | CouponBazaar Admin' };

const TABS = [
  { label: 'Open',         value: 'OPEN' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Resolved',     value: 'RESOLVED' },
  { label: 'All Active',   value: undefined },
] as const;

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function DisputesPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const disputes = await getDisputes(status);

  const label = status
    ? (TABS.find((t) => t.value === status)?.label ?? status)
    : 'open / under review';

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Disputes
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {disputes.length} {label}
        </p>
      </header>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <a
              key={tab.label}
              href={tab.value ? `?status=${tab.value}` : '/disputes'}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={active
                ? { backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)' }
                : { backgroundColor: 'var(--color-surface-high)', color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }
              }
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      <DisputesView disputes={disputes} />
    </div>
  );
}
