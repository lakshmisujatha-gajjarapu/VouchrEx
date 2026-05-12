import { getOrders } from '@/lib/api';
import { formatShortId, formatCurrency, formatDate, formatPhone } from '@/lib/utils';
import TableToolbar from '@/components/table-toolbar';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Orders | VouchrEx Admin' };

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

function tabHref(status: string | undefined, currentQ: string): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (currentQ) params.set('q', currentQ);
  const qs = params.toString();
  return qs ? `/orders?${qs}` : '/orders';
}

const SEARCH_KEYS = [
  { value: 'id',          label: 'Order ID',     placeholder: 'Order id starts with…' },
  { value: 'buyerPhone',  label: 'Buyer phone',  placeholder: '+91…' },
  { value: 'buyerName',   label: 'Buyer name',   placeholder: 'Buyer name contains…' },
  { value: 'sellerPhone', label: 'Seller phone', placeholder: '+91…' },
  { value: 'sellerName',  label: 'Seller name',  placeholder: 'Seller name contains…' },
  { value: 'brand',       label: 'Brand',        placeholder: 'Brand name contains…' },
] as const;

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; qBy?: string; page?: string; pageSize?: string }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = sp.status;
  const q = sp.q ?? '';
  const qBy = sp.qBy ?? '';
  const pageNum = Number.parseInt(sp.page ?? '1', 10) || 1;
  const pageSize = Number.parseInt(sp.pageSize ?? '25', 10) || 25;

  const { data: orders, total, page, pageSize: ps } = await getOrders({ status, q, qBy, page: pageNum, pageSize });

  return (
    <div className="p-8 animate-slide-up">
      <header className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>
          Orders
        </h1>
        <p style={{ color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}>
          {total} orders
        </p>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <a
              key={tab.label}
              href={tabHref(tab.value, q)}
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

      <TableToolbar
        basePath="/orders"
        total={total}
        page={page}
        pageSize={ps}
        q={q}
        qBy={qBy}
        searchKeys={SEARCH_KEYS}
      />

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
                  <tr key={o.id} className="transition-opacity hover:opacity-90 cursor-pointer"
                    style={{ borderTop: '1px solid var(--color-surface-high)' }}>
                    <td className="px-5 py-3.5 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
                      <a href={`/orders/${o.id}`} className="hover:underline">{formatShortId(o.id)}</a>
                    </td>
                    <td className="px-5 py-3.5 font-medium" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-foreground)' }}>
                      {o.listing.brand.name}
                    </td>
                    <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)' }}>
                      <div style={{ color: 'var(--color-foreground)' }}>{o.buyer.name ?? '—'}</div>
                      <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{formatPhone(o.buyer.phone)}</div>
                    </td>
                    <td className="px-5 py-3.5" style={{ fontFamily: 'var(--font-body)' }}>
                      <div style={{ color: 'var(--color-foreground)' }}>{o.seller.name ?? '—'}</div>
                      <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{formatPhone(o.seller.phone)}</div>
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
