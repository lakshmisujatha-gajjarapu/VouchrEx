import { getOrders } from '@/lib/api';
import { formatShortId, formatCurrency, formatDate, formatPhone } from '@/lib/utils';
import type { Metadata } from 'next';
import type { Order } from '@/lib/types';

export const metadata: Metadata = { title: 'Orders | CouponBazaar Admin' };

const TABS = [
  { label: 'All',           value: undefined },
  { label: 'Escrow Active', value: 'ESCROW_ACTIVE' },
  { label: 'Disputed',      value: 'DISPUTED' },
  { label: 'Cancelled',     value: 'CANCELLED' },
] as const;

function statusStyle(status: string): { bg: string; color: string } {
  if (status === 'ESCROW_ACTIVE') return { bg: 'var(--color-warning-soft)',     color: 'var(--color-warning)' };
  if (status === 'DISPUTED')      return { bg: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' };
  if (status === 'CONFIRMED')     return { bg: 'var(--color-success-soft)',     color: 'var(--color-success)' };
  if (status === 'CANCELLED')     return { bg: 'var(--color-surface-high)',     color: 'var(--color-muted-foreground)' };
  return                                 { bg: 'var(--color-primary-soft)',     color: 'var(--color-primary)' };
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const orders: Order[] = await getOrders(status);

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Orders
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {orders.length} orders
        </p>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <a
              key={tab.label}
              href={tab.value ? `?status=${tab.value}` : '/orders'}
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

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 0 40px rgba(26,27,33,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-raised)' }}>
                {['ID', 'Brand', 'Buyer', 'Seller', 'Amount', 'Status', 'Created'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12"
                    style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                    No orders found.
                  </td>
                </tr>
              )}
              {orders.map((o) => {
                const s = statusStyle(o.status);
                return (
                  <tr key={o.id} className="transition-opacity hover:opacity-90"
                    style={{ borderTop: '1px solid var(--color-surface-high)' }}>
                    <td className="px-5 py-3.5 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
                      {formatShortId(o.id)}
                    </td>
                    <td className="px-5 py-3.5 font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {o.listing.brand.name}
                    </td>
                    <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {formatPhone(o.buyer.phone)}
                    </td>
                    <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {formatPhone(o.seller.phone)}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-foreground)' }}>
                      {o.payment ? formatCurrency(o.payment.amount) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className="status-badge" style={{ backgroundColor: s.bg, color: s.color }}>
                          {o.status.replace('_', ' ')}
                        </span>
                        {o.dispute && (
                          <a href={`/disputes?status=${o.dispute.status}`}
                            className="text-xs underline-offset-2 underline"
                            style={{ color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
                            dispute {o.dispute.status.toLowerCase().replace('_', ' ')}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)' }}>
                      {formatDate(o.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
