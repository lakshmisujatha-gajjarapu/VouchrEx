import Link from 'next/link';
import { getMetrics } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { formatCurrency } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard | VouchrEx Admin' };

export default async function DashboardPage() {
  const metrics = await getMetrics();

  const { orders, disputes, payments, refunds } = metrics;
  const hasUrgent =
    disputes.open > 0 ||
    disputes.underReview > 0 ||
    refunds.failed > 0;

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-10">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          Platform operational metrics
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        <StatCard label="Total Orders" value={orders.total} />
        <StatCard label="Active Escrows" value={orders.escrowActive} />
        <StatCard
          label="Open Disputes"
          value={disputes.open}
          href={disputes.open > 0 ? ROUTES.DISPUTES : undefined}
          highlight={disputes.open > 0}
        />
        <StatCard
          label="Under Review"
          value={disputes.underReview}
          href={disputes.underReview > 0 ? ROUTES.DISPUTES : undefined}
          highlight={disputes.underReview > 0}
        />
        <StatCard
          label="GMV Captured"
          value={formatCurrency(payments.totalCapturedInr)}
          sub="All-time captured payments"
        />
        <StatCard
          label="Total Refunded"
          value={formatCurrency(payments.totalRefundedInr)}
          sub="All-time refunds issued"
        />
        <StatCard
          label="Refunds Processing"
          value={refunds.processing}
          sub="In-flight to Razorpay"
          href={refunds.processing > 0 ? ROUTES.REFUNDS : undefined}
        />
        <StatCard
          label="Refunds Failed"
          value={refunds.failed}
          sub="Need admin intervention"
          href={refunds.failed > 0 ? ROUTES.REFUNDS : undefined}
          highlight={refunds.failed > 0}
        />
      </div>

      {hasUrgent && (
        <div className="rounded-2xl px-6 py-5 mb-8"
          style={{ backgroundColor: 'var(--color-warning-soft)', border: '1px solid rgba(217,119,6,0.2)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-warning)', fontFamily: 'var(--font-headline)' }}>
            Action Required
          </p>
          <div className="flex flex-wrap gap-3">
            {disputes.open > 0 && (
              <Link
                href={ROUTES.DISPUTES}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                style={{ backgroundColor: 'rgba(217,119,6,0.12)', color: 'var(--color-warning)', fontFamily: 'var(--font-body)' }}
              >
                {disputes.open} open dispute{disputes.open !== 1 ? 's' : ''} need triage →
              </Link>
            )}
            {disputes.underReview > 0 && (
              <Link
                href={ROUTES.DISPUTES}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                style={{ backgroundColor: 'rgba(217,119,6,0.12)', color: 'var(--color-warning)', fontFamily: 'var(--font-body)' }}
              >
                {disputes.underReview} dispute{disputes.underReview !== 1 ? 's' : ''} under review →
              </Link>
            )}
            {refunds.failed > 0 && (
              <Link
                href={ROUTES.REFUNDS}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                style={{ backgroundColor: 'rgba(217,119,6,0.12)', color: 'var(--color-warning)', fontFamily: 'var(--font-body)' }}
              >
                {refunds.failed} refund{refunds.failed !== 1 ? 's' : ''} failed →
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Review Disputes', href: ROUTES.DISPUTES, desc: 'Triage and resolve disputes' },
          { label: 'Manage Orders',   href: ROUTES.ORDERS,   desc: 'View all platform orders' },
          { label: 'Manage Users',    href: ROUTES.USERS,    desc: 'Suspend or reactivate accounts' },
          { label: 'Process Payouts', href: ROUTES.PAYOUTS,  desc: 'Mark pending payouts complete' },
          { label: 'Process Refunds', href: ROUTES.REFUNDS,  desc: 'Retry or settle buyer refunds' },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-2xl p-5 transition-all hover:scale-[1.01]"
            style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}
          >
            <p className="font-semibold text-sm mb-1" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-foreground)' }}>
              {action.label}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
              {action.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
