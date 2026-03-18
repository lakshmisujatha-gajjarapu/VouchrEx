import { LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { getMetrics } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { formatCurrency } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard | CouponBazaar Admin' };

export default async function DashboardPage() {
  const metrics = await getMetrics();

  const { orders, disputes, payments } = metrics;
  const hasUrgent = disputes.open > 0 || disputes.underReview > 0;

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Platform operational metrics</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard label="Total Orders" value={orders.total} />
        <StatCard label="Active Escrows" value={orders.escrowActive} />
        <StatCard
          label="Open Disputes"
          value={disputes.open}
          href={disputes.open > 0 ? ROUTES.DISPUTES : undefined}
          highlight={disputes.open > 0}
        />
        <StatCard
          label="Disputes Under Review"
          value={disputes.underReview}
          href={disputes.underReview > 0 ? ROUTES.DISPUTES : undefined}
          highlight={disputes.underReview > 0}
        />
        <StatCard
          label="GMV (Captured)"
          value={formatCurrency(payments.totalCapturedInr)}
          sub="All-time captured payments"
        />
        <StatCard
          label="Total Refunded"
          value={formatCurrency(payments.totalRefundedInr)}
          sub="All-time refunds issued"
        />
      </div>

      {hasUrgent && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
          <h2 className="text-base font-semibold text-amber-900 mb-3">Action Required</h2>
          <div className="flex flex-wrap gap-3">
            {disputes.open > 0 && (
              <Link
                href={ROUTES.DISPUTES}
                className="inline-flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {disputes.open} open dispute{disputes.open !== 1 ? 's' : ''} need triage →
              </Link>
            )}
            {disputes.underReview > 0 && (
              <Link
                href={ROUTES.DISPUTES}
                className="inline-flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {disputes.underReview} dispute{disputes.underReview !== 1 ? 's' : ''} under review →
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Review Disputes', href: ROUTES.DISPUTES, desc: 'Triage and resolve disputes' },
          { label: 'Manage Orders', href: ROUTES.ORDERS, desc: 'View all platform orders' },
          { label: 'Manage Users', href: ROUTES.USERS, desc: 'Suspend or reactivate accounts' },
          { label: 'Process Payouts', href: ROUTES.PAYOUTS, desc: 'Mark pending payouts complete' },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow"
          >
            <p className="font-semibold text-sm">{action.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{action.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
